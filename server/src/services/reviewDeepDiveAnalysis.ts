/**
 * reviewDeepDiveAnalysis.ts — Issue #724
 *
 * Deep-dive analysis tools for moderation admins.
 * Provides detailed review patterns, metrics, and insights.
 */

import { AnalyticsEvent } from "../models/AnalyticsEvent.js";
import { ModerationDecision } from "../models/ModerationDecision.js";
import { ReviewResponse } from "../models/ReviewResponse.js";
import Purchase from "../models/Purchase.js";
import Prompt from "../models/Prompt.js";

export interface ReviewPatternMetrics {
  promptId: string;
  title?: string;
  totalReviews: number;
  averageRating?: number;
  responseRate: number;
  flaggedCount: number;
  moderationActions: number;
  lastReviewDate: Date | null;
  creatorResponseCount: number;
  trendDirection: "increasing" | "decreasing" | "stable";
}

export interface CreatorReviewProfile {
  creatorWallet: string;
  promptsCount: number;
  averageReviewCount: number;
  averageResponseRate: number;
  moderationRiskScore: number;
  delistCount: number;
  suspensionCount: number;
}

export interface ReviewDeepDiveReport {
  generatedAt: Date;
  promptId?: string;
  creatorWallet?: string;
  metrics: ReviewPatternMetrics[];
  patterns: string[];
  recommendations: string[];
}

/**
 * Get detailed review pattern for a specific prompt.
 */
export async function getPromptReviewDeepDive(promptId: string): Promise<ReviewPatternMetrics> {
  const reviewsData = await AnalyticsEvent.aggregate([
    {
      $match: {
        eventType: "prompt_reviewed",
        promptId,
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        lastReviewDate: { $max: "$timestamp" },
      },
    },
  ]);

  const totalReviews = reviewsData[0]?.totalReviews ?? 0;
  const lastReviewDate = reviewsData[0]?.lastReviewDate ?? null;

  // Get prompt info
  const prompt = await Prompt.findById(promptId).lean();
  const title = (prompt as any)?.title;

  // Get response data
  const responses = await ReviewResponse.countDocuments({ promptId });

  // Get moderation actions
  const modActions = await ModerationDecision.countDocuments({ promptId });

  // Get flagged reports
  const flaggedCount = await AnalyticsEvent.countDocuments({
    eventType: "prompt_flagged",
    promptId,
  });

  // Calculate trend (compare last 30 days to previous 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentReviews = await AnalyticsEvent.countDocuments({
    eventType: "prompt_reviewed",
    promptId,
    timestamp: { $gte: thirtyDaysAgo },
  });

  const previousReviews = await AnalyticsEvent.countDocuments({
    eventType: "prompt_reviewed",
    promptId,
    timestamp: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
  });

  let trendDirection: "increasing" | "decreasing" | "stable" = "stable";
  if (recentReviews > previousReviews * 1.2) {
    trendDirection = "increasing";
  } else if (recentReviews < previousReviews * 0.8) {
    trendDirection = "decreasing";
  }

  const responseRate = totalReviews > 0 ? Math.round((responses / totalReviews) * 100 * 10) / 10 : 0;

  return {
    promptId,
    title,
    totalReviews,
    responseRate,
    flaggedCount,
    moderationActions: modActions,
    lastReviewDate,
    creatorResponseCount: responses,
    trendDirection,
  };
}

/**
 * Get comprehensive review profile for a creator.
 */
export async function getCreatorReviewProfile(creatorWallet: string): Promise<CreatorReviewProfile> {
  // Get all prompts from creator
  const prompts = await Prompt.find({ owner: creatorWallet }).select("_id");
  const promptIds = prompts.map((p) => String(p._id));

  if (promptIds.length === 0) {
    return {
      creatorWallet: creatorWallet.toLowerCase(),
      promptsCount: 0,
      averageReviewCount: 0,
      averageResponseRate: 0,
      moderationRiskScore: 0,
      delistCount: 0,
      suspensionCount: 0,
    };
  }

  // Get reviews per prompt
  const reviewMetrics = await AnalyticsEvent.aggregate([
    {
      $match: {
        eventType: "prompt_reviewed",
        promptId: { $in: promptIds },
      },
    },
    {
      $group: {
        _id: "$promptId",
        count: { $sum: 1 },
      },
    },
  ]);

  const averageReviewCount = reviewMetrics.length > 0
    ? Math.round((reviewMetrics.reduce((sum, m) => sum + m.count, 0) / promptIds.length) * 10) / 10
    : 0;

  // Get response rates
  const responses = await ReviewResponse.countDocuments({
    promptId: { $in: promptIds },
  });

  const totalReviews = reviewMetrics.reduce((sum, m) => sum + m.count, 0);
  const averageResponseRate = totalReviews > 0
    ? Math.round((responses / totalReviews) * 100 * 10) / 10
    : 0;

  // Get moderation metrics
  const delistCount = await ModerationDecision.countDocuments({
    promptId: { $in: promptIds },
    decisionType: "listing_suspended",
  });

  const suspensionCount = await ModerationDecision.countDocuments({
    moderatorAddress: creatorWallet.toLowerCase(),
    decisionType: "account_restricted",
  });

  // Calculate risk score (0-100)
  const flagCount = await AnalyticsEvent.countDocuments({
    eventType: "prompt_flagged",
    promptId: { $in: promptIds },
  });

  const riskFactors = {
    lowResponseRate: averageResponseRate < 30 ? 25 : 0,
    flags: Math.min(flagCount * 5, 25),
    delistings: Math.min(delistCount * 15, 25),
    suspensions: suspensionCount * 25,
  };

  const moderationRiskScore = Math.min(
    100,
    Object.values(riskFactors).reduce((sum, score) => sum + score, 0)
  );

  return {
    creatorWallet: creatorWallet.toLowerCase(),
    promptsCount: promptIds.length,
    averageReviewCount,
    averageResponseRate,
    moderationRiskScore,
    delistCount,
    suspensionCount,
  };
}

/**
 * Generate comprehensive deep-dive report for a prompt.
 */
export async function generatePromptDeepDiveReport(promptId: string): Promise<ReviewDeepDiveReport> {
  const metrics = await getPromptReviewDeepDive(promptId);
  const patterns: string[] = [];
  const recommendations: string[] = [];

  // Identify patterns
  if (metrics.totalReviews === 0) {
    patterns.push("No reviews received");
    recommendations.push("Prompt may not have enough visibility or engagement");
  } else if (metrics.responseRate < 20) {
    patterns.push("Very low creator response rate");
    recommendations.push("Encourage creator to engage with reviewers");
  } else if (metrics.responseRate > 80) {
    patterns.push("Excellent creator engagement with reviews");
    recommendations.push("This is a positive signal; creator is responsive");
  }

  if (metrics.trendDirection === "increasing") {
    patterns.push("Growing review volume");
    recommendations.push("Monitor for quality degradation as popularity increases");
  } else if (metrics.trendDirection === "decreasing") {
    patterns.push("Declining review volume");
    recommendations.push("Prompt may be losing market interest");
  }

  if (metrics.flaggedCount > 3) {
    patterns.push("Multiple user flags");
    recommendations.push("Review for moderation violations");
  }

  if (metrics.moderationActions > 0) {
    patterns.push("Previous moderation actions taken");
    recommendations.push("Review moderation history; consider additional monitoring");
  }

  return {
    generatedAt: new Date(),
    promptId,
    metrics: [metrics],
    patterns,
    recommendations,
  };
}

/**
 * Generate comprehensive deep-dive report for a creator.
 */
export async function generateCreatorDeepDiveReport(creatorWallet: string): Promise<ReviewDeepDiveReport> {
  const profile = await getCreatorReviewProfile(creatorWallet);
  const patterns: string[] = [];
  const recommendations: string[] = [];

  // Identify patterns
  if (profile.promptsCount === 0) {
    patterns.push("No prompts published");
    recommendations.push("Creator needs to publish prompts to receive reviews");
  } else if (profile.averageReviewCount < 5) {
    patterns.push("Low average review volume per prompt");
    recommendations.push("Prompts may lack market traction");
  }

  if (profile.averageResponseRate < 30) {
    patterns.push("Creator rarely responds to reviews");
    recommendations.push("Flag for engagement outreach");
  } else if (profile.averageResponseRate > 75) {
    patterns.push("Creator actively engages with reviewers");
    recommendations.push("High-quality contributor");
  }

  if (profile.moderationRiskScore > 70) {
    patterns.push("High moderation risk score");
    recommendations.push("Schedule for moderation review");
  } else if (profile.moderationRiskScore > 40) {
    patterns.push("Moderate moderation risk");
    recommendations.push("Monitor future submissions closely");
  }

  if (profile.delistCount > 2) {
    patterns.push("Multiple delisted prompts");
    recommendations.push("Review compliance; consider account restrictions");
  }

  return {
    generatedAt: new Date(),
    creatorWallet,
    metrics: [],
    patterns,
    recommendations,
  };
}

/**
 * Get top flagged prompts for moderation review.
 */
export async function getTopFlaggedPrompts(limit: number = 10): Promise<ReviewPatternMetrics[]> {
  const flaggedPrompts = await AnalyticsEvent.aggregate([
    {
      $match: { eventType: "prompt_flagged" },
    },
    {
      $group: {
        _id: "$promptId",
        flagCount: { $sum: 1 },
      },
    },
    {
      $sort: { flagCount: -1 },
    },
    {
      $limit: limit,
    },
  ]);

  const metrics: ReviewPatternMetrics[] = [];
  for (const flagged of flaggedPrompts) {
    const metric = await getPromptReviewDeepDive(flagged._id);
    metrics.push(metric);
  }

  return metrics;
}

/**
 * Get creators with highest moderation risk scores.
 */
export async function getHighRiskCreators(limit: number = 10): Promise<CreatorReviewProfile[]> {
  const creatorWallets = await Prompt.aggregate([
    {
      $group: {
        _id: "$owner",
      },
    },
  ]);

  const profiles = await Promise.all(
    creatorWallets.slice(0, limit).map((doc) => getCreatorReviewProfile(String(doc._id)))
  );

  return profiles.sort((a, b) => b.moderationRiskScore - a.moderationRiskScore).slice(0, limit);
}
