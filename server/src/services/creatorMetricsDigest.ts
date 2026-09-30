import connectDb from "../db/connectDb";
import CreatorDigestDelivery from "../models/CreatorDigestDelivery";
import Prompt from "../models/Prompt";
import Purchase from "../models/Purchase";
import User from "../models/User";
import { sendWeeklyCreatorMetricsDigest } from "./emailNotifications";

const DAY_MS = 24 * 60 * 60 * 1000;
const CLAIM_TIMEOUT_MS = 30 * 60 * 1000;

interface UtcWeekWindow {
  weekStart: string;
  weekEnd: string;
  start: Date;
  endExclusive: Date;
}

export function getPreviousUtcWeek(now = new Date()): UtcWeekWindow {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  const endExclusive = new Date(today - daysSinceMonday * DAY_MS);
  const start = new Date(endExclusive.getTime() - 7 * DAY_MS);
  const weekEnd = new Date(endExclusive.getTime() - DAY_MS);

  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    start,
    endExclusive,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

async function claimDigest(creatorWallet: string, weekStart: string, now: Date): Promise<boolean> {
  try {
    const delivery = await CreatorDigestDelivery.findOneAndUpdate(
      {
        creatorWallet,
        weekStart,
        $or: [
          { status: "failed" },
          { status: "sending", claimedAt: { $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
        ],
      },
      {
        $set: { status: "sending", claimedAt: now },
        $setOnInsert: { creatorWallet, weekStart },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return Boolean(delivery);
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

export async function sendWeeklyCreatorMetricsDigests(now = new Date()): Promise<{ sent: number; skipped: number }> {
  await connectDb();
  const week = getPreviousUtcWeek(now);
  const users = await User.find({
    email: { $type: "string", $ne: "" },
    "notificationPreferences.emailNotifications": { $ne: false },
    "notificationPreferences.weeklyCreatorDigest": true,
  }).select("_id walletAddress email").lean();

  if (users.length === 0) return { sent: 0, skipped: 0 };

  const creatorIds = users.map((user: any) => user._id);
  const prompts = await Prompt.find({ owner: { $in: creatorIds } })
    .select("_id owner title price")
    .lean();
  const promptsById = new Map<string, any>(prompts.map((prompt: any) => [String(prompt._id), prompt]));
  if (promptsById.size === 0) return { sent: 0, skipped: 0 };

  const purchases = await Purchase.find({
    promptId: { $in: Array.from(promptsById.keys()) },
    createdAt: { $gte: week.start, $lt: week.endExclusive },
  }).select("promptId buyerWallet").lean();

  const metricsByCreator = new Map<string, {
    salesCount: number;
    revenueStroops: number;
    buyers: Set<string>;
    promptSales: Map<string, { title: string; salesCount: number }>;
  }>();

  for (const purchase of purchases as any[]) {
    const prompt = promptsById.get(String(purchase.promptId));
    if (!prompt) continue;

    const creatorId = String(prompt.owner);
    const metrics = metricsByCreator.get(creatorId) ?? {
      salesCount: 0,
      revenueStroops: 0,
      buyers: new Set<string>(),
      promptSales: new Map<string, { title: string; salesCount: number }>(),
    };
    metrics.salesCount += 1;
    metrics.revenueStroops += Number(prompt.price) || 0;
    if (purchase.buyerWallet) metrics.buyers.add(String(purchase.buyerWallet).toLowerCase());
    const promptId = String(prompt._id);
    const promptMetrics = metrics.promptSales.get(promptId) ?? { title: String(prompt.title), salesCount: 0 };
    promptMetrics.salesCount += 1;
    metrics.promptSales.set(promptId, promptMetrics);
    metricsByCreator.set(creatorId, metrics);
  }

  let sent = 0;
  let skipped = 0;
  for (const user of users as any[]) {
    const metrics = metricsByCreator.get(String(user._id));
    if (!metrics || metrics.salesCount === 0) continue;

    const topPrompt = Array.from(metrics.promptSales.values())
      .sort((left, right) => right.salesCount - left.salesCount || left.title.localeCompare(right.title))[0];
    const wallet = String(user.walletAddress).toLowerCase();
    if (!(await claimDigest(wallet, week.weekStart, now))) {
      skipped += 1;
      continue;
    }

    try {
      const delivered = await sendWeeklyCreatorMetricsDigest(String(user.email), {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        salesCount: metrics.salesCount,
        revenueStroops: metrics.revenueStroops,
        buyerCount: metrics.buyers.size,
        topPromptTitle: topPrompt.title,
      });
      if (!delivered) {
        await CreatorDigestDelivery.updateOne(
          { creatorWallet: wallet, weekStart: week.weekStart },
          { $set: { status: "failed" }, $unset: { claimedAt: 1 } },
        );
        skipped += 1;
        continue;
      }
      await CreatorDigestDelivery.updateOne(
        { creatorWallet: wallet, weekStart: week.weekStart },
        { $set: { status: "sent", sentAt: now }, $unset: { claimedAt: 1 } },
      );
      sent += 1;
    } catch (error) {
      await CreatorDigestDelivery.updateOne(
        { creatorWallet: wallet, weekStart: week.weekStart },
        { $set: { status: "failed" }, $unset: { claimedAt: 1 } },
      );
      skipped += 1;
      console.error(`[creatorMetricsDigest] Failed to send digest to ${wallet}`, error);
    }
  }

  return { sent, skipped };
}