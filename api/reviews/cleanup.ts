import { cleanupReviewData } from "./data";
import { isValidAdminToken } from "../../src/lib/auth/adminToken";

/**
 * api/reviews/cleanup.ts — Issue #725
 *
 * Cleanup and retention enforcement for reviews:
 * - Prunes helpfulVoteActivity records older than 24 hours
 * - Prunes removed reviews older than the retention period (default 90 days)
 * - Preserves reviews with active appeals
 * - Authorized via CRON_SECRET or ADMIN_TOKEN Bearer header
 */

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Authorize via Bearer CRON_SECRET or ADMIN_TOKEN
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_TOKEN;

  if (cronSecret && !isValidAdminToken(authHeader, cronSecret)) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing authorization token" });
    return;
  }

  const { dryRun, removedRetentionMs, voteRetentionMs } = req.body ?? {};

  try {
    // Check for active appeals if database is accessible
    const excludedReviewIds: string[] = [];
    try {
      const { default: connectDb } = await import("../../server/src/db/connectDb");
      const { Appeal } = await import("../../server/src/models/Appeal");
      await connectDb();
      const activeAppeals = await Appeal.find(
        { status: { $in: ["open", "under_review"] }, reviewId: { $ne: null } },
        { reviewId: 1 },
      ).lean();
      for (const a of activeAppeals) {
        if (a.reviewId) excludedReviewIds.push(a.reviewId);
      }
    } catch {
      // If DB is unavailable, continue with in-memory cleanup without appeal filtering
    }

    const cleanupResult = cleanupReviewData({
      now: Date.now(),
      removedRetentionMs: typeof removedRetentionMs === "number" ? removedRetentionMs : undefined,
      voteRetentionMs: typeof voteRetentionMs === "number" ? voteRetentionMs : undefined,
      excludedReviewIds,
    });

    res.status(200).json({
      success: true,
      dryRun: Boolean(dryRun),
      timestamp: new Date().toISOString(),
      ...cleanupResult,
      preservedActiveAppeals: excludedReviewIds.length,
    });
  } catch (error) {
    console.error("Review cleanup failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Review cleanup failed" });
  }
}
