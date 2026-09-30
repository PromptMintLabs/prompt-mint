/**
 * reviewAnalyticsControllers.ts
 *
 * Controllers for review analytics endpoints.
 * Issues #723 and #724
 */

import { Router, Request, Response } from "express";
import {
  getCreatorReviewResponseMetrics,
  getMultipleCreatorMetrics,
  getTopRespondingCreators,
  recordReviewResponse,
} from "../services/reviewResponseMetrics.js";
import {
  getPromptReviewDeepDive,
  getCreatorReviewProfile,
  generatePromptDeepDiveReport,
  generateCreatorDeepDiveReport,
  getTopFlaggedPrompts,
  getHighRiskCreators,
} from "../services/reviewDeepDiveAnalysis.js";

const router = Router();

// ── Review Response Rate Metrics (Issue #723) ──────────────────────────────

/**
 * GET /api/review-analytics/response-rate/:creatorWallet
 * Get review response rate metrics for a creator
 */
router.get("/response-rate/:creatorWallet", async (req: Request, res: Response) => {
  try {
    const { creatorWallet } = req.params;
    const daysWindow = req.query.days ? Number(req.query.days) : 30;

    if (!creatorWallet) {
      return res.status(400).json({ error: "creatorWallet is required" });
    }

    const metrics = await getCreatorReviewResponseMetrics(creatorWallet, daysWindow);
    res.json(metrics);
  } catch (err) {
    console.error("[review-analytics] response-rate failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get response rate metrics",
    });
  }
});

/**
 * GET /api/review-analytics/response-rate/batch
 * Get response rate metrics for multiple creators
 */
router.post("/response-rate/batch", async (req: Request, res: Response) => {
  try {
    const { creatorWallets } = req.body;
    const daysWindow = req.query.days ? Number(req.query.days) : 30;

    if (!Array.isArray(creatorWallets) || creatorWallets.length === 0) {
      return res.status(400).json({ error: "creatorWallets array is required" });
    }

    const metrics = await getMultipleCreatorMetrics(creatorWallets, daysWindow);
    res.json({ metrics, count: metrics.length });
  } catch (err) {
    console.error("[review-analytics] batch response-rate failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get batch response rates",
    });
  }
});

/**
 * GET /api/review-analytics/top-responders
 * Get top responding creators
 */
router.get("/top-responders", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const daysWindow = req.query.days ? Number(req.query.days) : 30;

    const creators = await getTopRespondingCreators(limit, daysWindow);
    res.json({ creators, count: creators.length });
  } catch (err) {
    console.error("[review-analytics] top-responders failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get top responders",
    });
  }
});

/**
 * POST /api/review-analytics/record-response
 * Record a creator's response to a review
 */
router.post("/record-response", async (req: Request, res: Response) => {
  try {
    const { promptId, creatorWallet, responseText } = req.body;

    if (!promptId || !creatorWallet || !responseText) {
      return res.status(400).json({
        error: "promptId, creatorWallet, and responseText are required",
      });
    }

    await recordReviewResponse(promptId, creatorWallet, responseText);
    res.json({ status: "success", message: "Review response recorded" });
  } catch (err) {
    console.error("[review-analytics] record-response failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to record response",
    });
  }
});

// ── Review Deep-Dive Analysis (Issue #724) ─────────────────────────────────

/**
 * GET /api/review-analytics/prompt-deepdive/:promptId
 * Get deep-dive analysis for a specific prompt
 * Admin only
 */
router.get("/prompt-deepdive/:promptId", async (req: Request, res: Response) => {
  try {
    const { promptId } = req.params;

    if (!promptId) {
      return res.status(400).json({ error: "promptId is required" });
    }

    const metrics = await getPromptReviewDeepDive(promptId);
    res.json(metrics);
  } catch (err) {
    console.error("[review-analytics] prompt-deepdive failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get prompt analysis",
    });
  }
});

/**
 * GET /api/review-analytics/creator-profile/:creatorWallet
 * Get comprehensive review profile for a creator
 * Admin only
 */
router.get("/creator-profile/:creatorWallet", async (req: Request, res: Response) => {
  try {
    const { creatorWallet } = req.params;

    if (!creatorWallet) {
      return res.status(400).json({ error: "creatorWallet is required" });
    }

    const profile = await getCreatorReviewProfile(creatorWallet);
    res.json(profile);
  } catch (err) {
    console.error("[review-analytics] creator-profile failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get creator profile",
    });
  }
});

/**
 * GET /api/review-analytics/prompt-report/:promptId
 * Generate comprehensive deep-dive report for a prompt
 * Admin only
 */
router.get("/prompt-report/:promptId", async (req: Request, res: Response) => {
  try {
    const { promptId } = req.params;

    if (!promptId) {
      return res.status(400).json({ error: "promptId is required" });
    }

    const report = await generatePromptDeepDiveReport(promptId);
    res.json(report);
  } catch (err) {
    console.error("[review-analytics] prompt-report failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to generate prompt report",
    });
  }
});

/**
 * GET /api/review-analytics/creator-report/:creatorWallet
 * Generate comprehensive deep-dive report for a creator
 * Admin only
 */
router.get("/creator-report/:creatorWallet", async (req: Request, res: Response) => {
  try {
    const { creatorWallet } = req.params;

    if (!creatorWallet) {
      return res.status(400).json({ error: "creatorWallet is required" });
    }

    const report = await generateCreatorDeepDiveReport(creatorWallet);
    res.json(report);
  } catch (err) {
    console.error("[review-analytics] creator-report failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to generate creator report",
    });
  }
});

/**
 * GET /api/review-analytics/flagged-prompts
 * Get top flagged prompts for moderation review
 * Admin only
 */
router.get("/flagged-prompts", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const prompts = await getTopFlaggedPrompts(limit);
    res.json({ prompts, count: prompts.length });
  } catch (err) {
    console.error("[review-analytics] flagged-prompts failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get flagged prompts",
    });
  }
});

/**
 * GET /api/review-analytics/high-risk-creators
 * Get creators with highest moderation risk scores
 * Admin only
 */
router.get("/high-risk-creators", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const creators = await getHighRiskCreators(limit);
    res.json({ creators, count: creators.length });
  } catch (err) {
    console.error("[review-analytics] high-risk-creators failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get high-risk creators",
    });
  }
});

// ── Review Retention & Cleanup Job (Issue #725) ───────────────────────────

/**
 * GET /api/review-analytics/retention/status
 * Get review retention configuration and status
 */
router.get("/retention/status", async (req: Request, res: Response) => {
  try {
    const { getReviewRetentionConfig } = await import("../services/reviewRetentionService.js");
    const config = getReviewRetentionConfig();
    res.json({
      status: "active",
      config,
      cronSchedule: process.env.REVIEW_RETENTION_CRON || "0 2 * * *",
    });
  } catch (err) {
    console.error("[review-analytics] retention/status failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to get retention status",
    });
  }
});

/**
 * POST /api/review-analytics/retention/cleanup
 * Trigger review retention cleanup job (supports dryRun)
 */
router.post("/retention/cleanup", async (req: Request, res: Response) => {
  try {
    const { dryRun, removedReviewRetentionDays, auditLogRetentionDays, appealAttachmentRetentionDays } = req.body || {};
    const { runReviewRetentionCleanup } = await import("../services/reviewRetentionService.js");

    const customConfig: any = {};
    if (typeof removedReviewRetentionDays === "number") customConfig.removedReviewRetentionDays = removedReviewRetentionDays;
    if (typeof auditLogRetentionDays === "number") customConfig.auditLogRetentionDays = auditLogRetentionDays;
    if (typeof appealAttachmentRetentionDays === "number") customConfig.appealAttachmentRetentionDays = appealAttachmentRetentionDays;

    const report = await runReviewRetentionCleanup({
      dryRun: Boolean(dryRun),
      customConfig: Object.keys(customConfig).length > 0 ? customConfig : undefined,
    });

    res.json(report);
  } catch (err) {
    console.error("[review-analytics] retention/cleanup failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Review retention cleanup failed",
    });
  }
});

export default router;

