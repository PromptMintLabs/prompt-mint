import type { Request, Response } from "express";
import connectDb from "../db/connectDb";
import {
  getListingAnalyticsForPromptIds,
  MAX_PROMPT_IDS,
} from "../services/creatorListingAnalytics";

/**
 * GET /api/analytics/listings?ids=1,2,3
 *
 * Returns per-listing views, purchases, unlocks, conversion rate, and unlock
 * rate for the given on-chain prompt ids. Intended for the creator analytics
 * dashboard (issue #502).
 */
export default async function creatorListingAnalyticsHandler(
  req: Request,
  res: Response,
) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const raw = String(req.query.ids ?? "");
  const promptIds = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (promptIds.length === 0) {
    res.status(400).json({
      error: "Query parameter 'ids' is required (comma-separated prompt ids).",
    });
    return;
  }

  if (promptIds.length > MAX_PROMPT_IDS) {
    res.status(400).json({
      error: `At most ${MAX_PROMPT_IDS} prompt ids may be requested at once.`,
    });
    return;
  }

  await connectDb();
  const listings = await getListingAnalyticsForPromptIds(promptIds);
  res.status(200).json({ listings });
}
