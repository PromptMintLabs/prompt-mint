/**
 * winbackEmailService.ts — Issue #721
 *
 * Email service for re-engaging inactive buyers.
 * Tracks last purchase activity and sends winback campaigns.
 */

import { createUnsubscribeToken } from "./unsubscribeToken.js";
import User from "../models/User.js";
import Purchase from "../models/Purchase.js";
import nodemailer from "nodemailer";
import { getCircuitBreaker } from "./circuitBreaker.js";

const smtpBreaker = getCircuitBreaker("email-winback", {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
});

const FROM = process.env.EMAIL_FROM_ADDRESS ?? "PromptHash <noreply@prompthash.io>";
const APP_URL = process.env.APP_URL ?? "https://prompthash.io";

export interface WinbackPayload {
  buyerWallet: string;
  lastPurchaseDate: Date;
  daysSinceActivity: number;
  topCategoryViewed?: string;
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
    console.warn("[winback] SMTP not configured — skipping email to", to);
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
  console.log(`[winback] Sent "${subject}" to ${to}`);
}

export function buildWinbackEmail(payload: WinbackPayload, wallet: string): {
  subject: string;
  html: string;
  unsubscribeUrl: string;
} {
  const token = createUnsubscribeToken(wallet, "WinbackCampaign");
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${token}&event=WinbackCampaign`;

  const categoryText = payload.topCategoryViewed
    ? `Since you've been interested in ${payload.topCategoryViewed} prompts, we've curated some fresh selections just for you.`
    : "We've added many new prompts since your last purchase that match your interests.";

  return {
    subject: `We miss you! 🌟 New prompts you might love`,
    unsubscribeUrl,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>We'd love to see you again!</h2>
        <p>It's been <strong>${payload.daysSinceActivity} days</strong> since your last purchase, and we miss having you in the marketplace.</p>
        <p>${categoryText}</p>
        <p><a href="${APP_URL}/browse" style="display: inline-block; padding: 10px 20px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">Browse New Prompts</a></p>
        <p>Not interested? <a href="${unsubscribeUrl}">Unsubscribe from winback emails</a></p>
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

async function getLastPurchaseDate(wallet: string): Promise<Date | null> {
  const purchase = await Purchase.findOne({ buyerWallet: wallet.toLowerCase() })
    .sort({ createdAt: -1 })
    .lean();
  return purchase ? new Date(purchase.createdAt) : null;
}

export async function sendWinbackEmail(payload: WinbackPayload): Promise<void> {
  try {
    if (!(await hasOptedIn(payload.buyerWallet))) return;
    const email = await getEmailForWallet(payload.buyerWallet);
    if (!email) return;
    const { subject, html, unsubscribeUrl } = buildWinbackEmail(payload, payload.buyerWallet);
    await sendEmail(email, subject, html, unsubscribeUrl);
  } catch (err) {
    console.error("[winback] sendWinbackEmail failed:", err);
  }
}

/**
 * Find and email inactive buyers (no purchases in X days).
 * Threshold is configurable via WINBACK_INACTIVE_DAYS env var (default: 30)
 */
export async function enqueueInactiveBuyerCampaign(): Promise<{ processed: number; sent: number }> {
  const inactiveDays = Number(process.env.WINBACK_INACTIVE_DAYS ?? 30);
  const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  try {
    const inactiveBuyers = await Purchase.aggregate([
      {
        $match: {
          createdAt: { $lt: cutoffDate },
        },
      },
      {
        $group: {
          _id: "$buyerWallet",
          lastPurchase: { $max: "$createdAt" },
          purchaseCount: { $sum: 1 },
        },
      },
      {
        $sort: { lastPurchase: -1 },
      },
    ]);

    let sentCount = 0;
    for (const buyer of inactiveBuyers) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(buyer.lastPurchase).getTime()) / (1000 * 60 * 60 * 24)
      );

      await sendWinbackEmail({
        buyerWallet: buyer._id,
        lastPurchaseDate: new Date(buyer.lastPurchase),
        daysSinceActivity,
      });
      sentCount++;
    }

    console.log(`[winback] Processed ${inactiveBuyers.length} inactive buyers, sent ${sentCount} emails`);
    return { processed: inactiveBuyers.length, sent: sentCount };
  } catch (err) {
    console.error("[winback] enqueueInactiveBuyerCampaign failed:", err);
    return { processed: 0, sent: 0 };
  }
}
