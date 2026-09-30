/**
 * emailNotifications.ts — Issue #112 & Issue #748
 *
 * Email notification service for PromptPurchased and PromptUpdated events.
 * Uses nodemailer with any SMTP provider (SendGrid, Postmark, SES, etc.).
 * Users opt-in/out per notification type via User model preferences or one-click
 * HMAC-signed unsubscribe token link.
 *
 * Configuration (env vars):
 *   EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS
 *   EMAIL_FROM_ADDRESS (e.g. "PromptHash <noreply@prompthash.io>")
 *   APP_URL (e.g. "https://prompthash.io")
 *   UNSUBSCRIBE_TOKEN_SECRET
 */

import nodemailer from "nodemailer";
import User from "../models/User.js";
import { getCircuitBreaker } from "./circuitBreaker.js";
import { createUnsubscribeToken } from "./unsubscribeToken.js";

const smtpBreaker = getCircuitBreaker("email-smtp", {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
});

// ── Types ──────────────────────────────────────────────────────────────────────

export type NotificationEvent = "PromptPurchased" | "PromptUpdated";

export interface PurchasePayload {
  buyerWallet: string;
  promptTitle: string;
  promptId: string;
  txHash?: string;
}

export interface UpdatePayload {
  ownerWallet: string;
  promptTitle: string;
  promptId: string;
  versionIndex: number;
}

export interface WeeklyCreatorDigestPayload {
  weekStart: string;
  weekEnd: string;
  salesCount: number;
  revenueStroops: number;
  buyerCount: number;
  topPromptTitle: string;
}

// ── Transport ─────────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
    secure: process.env.EMAIL_SMTP_PORT === "465",
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
  });
}

const FROM = process.env.EMAIL_FROM_ADDRESS ?? "PromptHash <noreply@prompthash.io>";
const APP_URL = process.env.APP_URL ?? "https://prompthash.io";

// ── Template builders ─────────────────────────────────────────────────────────

export function buildPurchaseEmail(payload: PurchasePayload, wallet: string): {
  subject: string;
  html: string;
  unsubscribeUrl: string;
} {
  const token = createUnsubscribeToken(wallet, "PromptPurchased");
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${token}&event=PromptPurchased`;

  return {
    subject: `🎉 Your prompt "${payload.promptTitle}" was purchased`,
    unsubscribeUrl,
    html: `
      <h2>Congratulations!</h2>
      <p>A buyer (<code>${payload.buyerWallet.slice(0, 8)}…</code>) just purchased
         your prompt <strong>${payload.promptTitle}</strong>.</p>
      ${payload.txHash ? `<p>Transaction: <code>${payload.txHash}</code></p>` : ""}
      <p><a href="${APP_URL}/prompts/${payload.promptId}">
        View prompt
      </a></p>
      <hr/>
      <p style="font-size: 12px; color: #888;">
        To stop receiving purchase notification emails, <a href="${unsubscribeUrl}">unsubscribe with one click</a> or visit your account settings.
      </p>
    `,
  };
}

export function buildUpdateEmail(payload: UpdatePayload, wallet: string): {
  subject: string;
  html: string;
  unsubscribeUrl: string;
} {
  const token = createUnsubscribeToken(wallet, "PromptUpdated");
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${token}&event=PromptUpdated`;

  return {
    subject: `📦 Prompt updated: "${payload.promptTitle}" (v${payload.versionIndex + 1})`,
    unsubscribeUrl,
    html: `
      <h2>Prompt Updated</h2>
      <p>The prompt <strong>${payload.promptTitle}</strong> you purchased has been updated
         to version ${payload.versionIndex + 1}.</p>
      <p><a href="${APP_URL}/prompts/${payload.promptId}">
        View updated prompt
      </a></p>
      <hr/>
      <p style="font-size: 12px; color: #888;">
        To stop receiving prompt update emails, <a href="${unsubscribeUrl}">unsubscribe with one click</a> or visit your account settings.
      </p>
    `,
  };
}

// ── Core send helper ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.EMAIL_SMTP_HOST) {
    console.warn("[email] SMTP not configured — skipping email to", to);
    return false;
  }
  await smtpBreaker.execute(async () => {
    const transport = createTransport();
    const headers: Record<string, string> = {};
    if (unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    await transport.sendMail({
      from: FROM,
      to,
      subject,
      html,
      headers,
    });
  });
  console.log(`[email] Sent "${subject}" to ${to}`);
  return true;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export async function sendWeeklyCreatorMetricsDigest(
  to: string,
  payload: WeeklyCreatorDigestPayload,
): Promise<boolean> {
  const revenueXlm = (payload.revenueStroops / 10_000_000)
    .toFixed(7)
    .replace(/\.?0+$/, "") || "0";
  const subject = `Your weekly PromptHash creator metrics: ${payload.weekStart}`;
  const html = `
    <h2>Your creator metrics for ${escapeHtml(payload.weekStart)} to ${escapeHtml(payload.weekEnd)}</h2>
    <ul>
      <li>Sales: ${payload.salesCount}</li>
      <li>Revenue: ${revenueXlm} XLM</li>
      <li>Unique buyers: ${payload.buyerCount}</li>
      <li>Top listing: ${escapeHtml(payload.topPromptTitle)}</li>
    </ul>
    <p>Manage this digest in your notification preferences.</p>
  `;
  return sendEmail(to, subject, html);
}

// ── User preference helpers ───────────────────────────────────────────────────

async function getEmailForWallet(wallet: string): Promise<string | null> {
  const user = await User.findOne({ walletAddress: wallet.toLowerCase() }).lean();
  return (user as { email?: string } | null)?.email ?? null;
}

async function hasOptedIn(wallet: string, event: NotificationEvent): Promise<boolean> {
  const user = await User.findOne({ walletAddress: wallet.toLowerCase() }).lean();
  if (!user) return false;
  const prefs = (user as { notificationPreferences?: Partial<Record<NotificationEvent, boolean>> })
    .notificationPreferences;
  // Default opt-in when prefs not explicitly set
  return prefs?.[event] !== false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Notify a prompt creator when their prompt is purchased.
 * Looks up the creator wallet from the User collection.
 */
export async function notifyPromptPurchased(
  creatorWallet: string,
  payload: PurchasePayload
): Promise<void> {
  try {
    if (!(await hasOptedIn(creatorWallet, "PromptPurchased"))) return;
    const email = await getEmailForWallet(creatorWallet);
    if (!email) return;
    const { subject, html, unsubscribeUrl } = buildPurchaseEmail(payload, creatorWallet);
    await sendEmail(email, subject, html, unsubscribeUrl);
  } catch (err) {
    console.error("[email] notifyPromptPurchased failed:", err);
  }
}

/**
 * Notify buyers of a prompt that a new version has been published.
 */
export async function notifyPromptUpdated(
  buyerWallets: string[],
  payload: UpdatePayload
): Promise<void> {
  await Promise.allSettled(
    buyerWallets.map(async (wallet) => {
      try {
        if (!(await hasOptedIn(wallet, "PromptUpdated"))) return;
        const email = await getEmailForWallet(wallet);
        if (!email) return;
        const { subject, html, unsubscribeUrl } = buildUpdateEmail(payload, wallet);
        await sendEmail(email, subject, html, unsubscribeUrl);
      } catch (err) {
        console.error(`[email] notifyPromptUpdated failed for ${wallet}:`, err);
      }
    })
  );
}
