/**
 * reviewResponseMetrics.ts — Issue #723
 *
 * Calculates review response rate metrics for creators.
 * Shows what percentage of reviews creators respond to.
 */

import { ReviewResponse } from "../models/ReviewResponse.js";
import { AnalyticsEvent } from "../models/AnalyticsEvent.js";

export interface ReviewResponseMetrics {
  creatorWallet: string;
  totalReviewsReceived: number;
  responsesCount: number;
  responseRate: number;
  lastResponseDate: Date | null;
  timeRangeStart: Date;
  timeRangeEnd: Date;
}

function roundPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

/**
 * Calculate review response rate for a creator over a time window.
 * Default: last 30 days.
 */
export async function getCreatorReviewResponseMetrics(
  creatorWallet: string,
  daysWindow: number = 30
): Promise<ReviewResponseMetrics> {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  const responsesData = await ReviewResponse.aggregate([
    {
      $match: {
        creatorWallet: creatorWallet.toLowerCase(),
        respondedAt: { $gte: startDate, $lte: now },
      },
    },
    {
      $group: {
        _id: null,
        responsesCount: { $sum: 1 },
        lastResponseDate: { $max: "$respondedAt" },
      },
    },
  ]);

  const responsesCount = responsesData[0]?.responsesCount ?? 0;
  const lastResponseDate = responsesData[0]?.lastResponseDate ?? null;

  // Count total reviews received in the same window
  const reviewsData = await AnalyticsEvent.aggregate([
    {
      $match: {
        eventType: "prompt_reviewed",
        creatorWallet: creatorWallet.toLowerCase(),
        timestamp: { $gte: startDate, $lte: now },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
      },
    },
  ]);

  const totalReviewsReceived = reviewsData[0]?.count ?? 0;

  const responseRate = totalReviewsReceived > 0
    ? roundPercent((responsesCount / totalReviewsReceived) * 100)
    : 0;

  return {
    creatorWallet: creatorWallet.toLowerCase(),
    totalReviewsReceived,
    responsesCount,
    responseRate,
    lastResponseDate,
    timeRangeStart: startDate,
    timeRangeEnd: now,
  };
}

/**
 * Get response metrics for multiple creators.
 */
export async function getMultipleCreatorMetrics(
  creatorWallets: string[],
  daysWindow: number = 30
): Promise<ReviewResponseMetrics[]> {
  return Promise.all(
    creatorWallets.map((wallet) => getCreatorReviewResponseMetrics(wallet, daysWindow))
  );
}

/**
 * Get top responding creators.
 */
export async function getTopRespondingCreators(
  limit: number = 10,
  daysWindow: number = 30
): Promise<ReviewResponseMetrics[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  const topCreators = await ReviewResponse.aggregate<{
    _id: string;
    responsesCount: number;
    lastResponseDate: Date;
  }>([
    {
      $match: {
        respondedAt: { $gte: startDate, $lte: now },
      },
    },
    {
      $group: {
        _id: "$creatorWallet",
        responsesCount: { $sum: 1 },
        lastResponseDate: { $max: "$respondedAt" },
      },
    },
    {
      $sort: { responsesCount: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  const results: ReviewResponseMetrics[] = [];

  for (const creator of topCreators) {
    const metrics = await getCreatorReviewResponseMetrics(creator._id, daysWindow);
    results.push(metrics);
  }

  return results;
}

/**
 * Record a creator's response to a review.
 */
export async function recordReviewResponse(
  promptId: string,
  creatorWallet: string,
  responseText: string
): Promise<void> {
  try {
    await ReviewResponse.create({
      promptId,
      creatorWallet: creatorWallet.toLowerCase(),
      responseText,
      respondedAt: new Date(),
    });
    console.log(`[review-response] Recorded response from ${creatorWallet} for prompt ${promptId}`);
  } catch (err) {
    console.error("[review-response] Failed to record response:", err);
  }
}
