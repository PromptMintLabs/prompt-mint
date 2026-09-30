/**
 * reactivationEmailService.ts — Issue #722
 *
 * Email service for re-activating delisted creators.
 * Notifies creators when their prompts are delisted and helps them reactivate.
 */

import { createUnsubscribeToken } from "./unsubscribeToken.js";
import User from "../models/User.js";
import Prompt from "../models/Prompt.js";
import nodemailer from "nodemailer";
import { getCircuitBreaker } from "./circuitBreaker.js";

const smtpBreaker = getCircuitBreaker("email-reactivation", {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
});

const FROM = process.env.EMAIL_FROM_ADDRESS ?? "PromptHash <noreply@prompthash.io>";
const APP_URL = process.env.APP_URL ?? "https://prompthash.io";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@prompthash.io";

export interface ReactivationPayload {
  creatorWallet: string;
  delistedPromptCount: number;
  delistReason?: string;
  promptIds?: string[];
}

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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  unsubscribeUrl?: string
): Promise<void> {
  if (!process.env.EMAIL_SMTP_HOST) {
    console.warn("[reactivation] SMTP not configured — skipping email to", to);
    return;
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
  console.log(`[reactivation] Sent "${subject}" to ${to}`);
}

export function buildReactivationEmail(payload: ReactivationPayload, wallet: string): {
  subject: string;
  html: string;
  unsubscribeUrl: string;
} {
  const token = createUnsubscribeToken(wallet, "ReactivationCampaign");
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${token}&event=ReactivationCampaign`;

  const reasonText = payload.delistReason
    ? `<p><strong>Reason:</strong> ${payload.delistReason}</p>`
    : "";

  const actionText =
    payload.delistedPromptCount === 1
      ? "Your prompt has been delisted from the marketplace."
      : `${payload.delistedPromptCount} of your prompts have been delisted from the marketplace.`;

  return {
    subject: "⚠️ Action needed: Reactivate your delisted prompts",
    unsubscribeUrl,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Prompts Have Been Delisted</h2>
        <p>${actionText}</p>
        ${reasonText}
        <p>You can review the details and reactivate your prompts by visiting your dashboard.</p>
        <p><a href="${APP_URL}/dashboard/prompts" style="display: inline-block; padding: 10px 20px; background-color: #ff6600; color: white; text-decoration: none; border-radius: 4px;">Go to Dashboard</a></p>
        <p>If you believe this was done in error or have questions, please <a href="mailto:${SUPPORT_EMAIL}">contact our support team</a>.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">
          <a href="${unsubscribeUrl}">Unsubscribe from reactivation emails</a>
        </p>
      </div>
    `,
  };
}

async function getEmailForWallet(wallet: string): Promise<string | null> {
  const user = await User.findOne({ walletAddress: wallet.toLowerCase() }).lean();
  return (user as { email?: string } | null)?.email ?? null;
}

async function hasOptedIn(wallet: string): Promise<boolean> {
  const user = await User.findOne({ walletAddress: wallet.toLowerCase() }).lean();
  if (!user) return false;
  const prefs = (user as { notificationPreferences?: { emailNotifications?: boolean } })
    .notificationPreferences;
  return prefs?.emailNotifications !== false;
}

export async function sendReactivationEmail(payload: ReactivationPayload): Promise<void> {
  try {
    if (!(await hasOptedIn(payload.creatorWallet))) return;
    const email = await getEmailForWallet(payload.creatorWallet);
    if (!email) return;
    const { subject, html, unsubscribeUrl } = buildReactivationEmail(payload, payload.creatorWallet);
    await sendEmail(email, subject, html, unsubscribeUrl);
  } catch (err) {
    console.error("[reactivation] sendReactivationEmail failed:", err);
  }
}

/**
 * Find recently delisted creators and send reactivation emails.
 * Threshold is configurable via REACTIVATION_DELIST_LOOKBACK_DAYS env var (default: 7)
 */
export async function enqueueDeistedCreatorCampaign(): Promise<{ processed: number; sent: number }> {
  const lookbackDays = Number(process.env.REACTIVATION_DELIST_LOOKBACK_DAYS ?? 7);
  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  try {
    const delistedPrompts = await Prompt.find({
      isActive: false,
      listingStatus: "archived",
      updatedAt: { $gte: cutoffDate },
    });

    const creatorMap = new Map<string, { count: number; ids: string[] }>();

    for (const prompt of delistedPrompts) {
      const owner = String(prompt.owner).toLowerCase();
      if (!creatorMap.has(owner)) {
        creatorMap.set(owner, { count: 0, ids: [] });
      }
      const entry = creatorMap.get(owner)!;
      entry.count += 1;
      entry.ids.push(String(prompt._id));
    }

    let sentCount = 0;
    for (const [creatorWallet, data] of creatorMap.entries()) {
      await sendReactivationEmail({
        creatorWallet,
        delistedPromptCount: data.count,
        promptIds: data.ids,
      });
      sentCount++;
    }

    console.log(`[reactivation] Processed ${creatorMap.size} delisted creators, sent ${sentCount} emails`);
    return { processed: creatorMap.size, sent: sentCount };
  } catch (err) {
    console.error("[reactivation] enqueueDeistedCreatorCampaign failed:", err);
    return { processed: 0, sent: 0 };
  }
}
