/**
 * emailCampaignControllers.ts
 *
 * Controllers for email campaign endpoints (winback, reactivation).
 * Issues #721 and #722
 */

import { Router, Request, Response } from "express";
import { enqueueInactiveBuyerCampaign } from "../services/winbackEmailService.js";
import { enqueueDeistedCreatorCampaign } from "../services/reactivationEmailService.js";

const router = Router();

/**
 * POST /api/campaigns/winback
 * Trigger winback email campaign for inactive buyers
 * Admin only
 */
router.post("/winback", async (req: Request, res: Response) => {
  try {
    const result = await enqueueInactiveBuyerCampaign();
    res.json({
      status: "success",
      processed: result.processed,
      sent: result.sent,
      message: `Winback campaign complete: ${result.sent} emails sent`,
    });
  } catch (err) {
    console.error("[campaign] winback failed:", err);
    res.status(500).json({
      status: "error",
      message: err instanceof Error ? err.message : "Winback campaign failed",
    });
  }
});

/**
 * POST /api/campaigns/reactivation
 * Trigger reactivation email campaign for delisted creators
 * Admin only
 */
router.post("/reactivation", async (req: Request, res: Response) => {
  try {
    const result = await enqueueDeistedCreatorCampaign();
    res.json({
      status: "success",
      processed: result.processed,
      sent: result.sent,
      message: `Reactivation campaign complete: ${result.sent} emails sent`,
    });
  } catch (err) {
    console.error("[campaign] reactivation failed:", err);
    res.status(500).json({
      status: "error",
      message: err instanceof Error ? err.message : "Reactivation campaign failed",
    });
  }
});

export default router;
