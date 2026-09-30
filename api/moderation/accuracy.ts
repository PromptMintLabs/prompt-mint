import { negotiateVersion } from "../../src/lib/api/versionGuard";
import { withVersion } from "../../src/lib/api/payloadVersion";
import { apiError, ErrorCode } from "../../src/lib/api/errorCodes";
import {
  ACCURACY_SAMPLE_DEFAULT_SEED,
  getAccuracyEligibleItems,
  getModerationLogById,
  selectAccuracyReviewSample,
  verifyModeratorAuth,
  type AccuracySampleActionFilter,
  type AccuracySampleItem,
} from "./data";

/**
 * Derives an accuracy summary from the sampled items that already have a
 * quality outcome recorded.  Only items that are log entries with an outcome
 * contribute to the percentages; items without outcomes are counted separately
 * so callers know how much of the sample remains un-reviewed.
 */
function buildAccuracySummary(sample: AccuracySampleItem[]): {
  reviewed: number;
  correct: number;
  incorrect: number;
  disputed: number;
  pending: number;
  correctPct: number | null;
} {
  let correct = 0;
  let incorrect = 0;
  let disputed = 0;
  let pending = 0;

  for (const item of sample) {
    if (item.kind !== "log") {
      // Reports don't carry outcome data yet — count as pending.
      pending += 1;
      continue;
    }
    const entry = getModerationLogById(item.id);
    if (!entry?.outcome) {
      pending += 1;
      continue;
    }
    if (entry.outcome === "correct") correct += 1;
    else if (entry.outcome === "incorrect") incorrect += 1;
    else disputed += 1;
  }

  const reviewed = correct + incorrect + disputed;
  // correctPct is null when nothing has been reviewed yet — avoids serving
  // a fictional percentage (the original guard this block replaces).
  const correctPct = reviewed > 0 ? Math.round((correct / reviewed) * 10000) / 100 : null;

  return { reviewed, correct, incorrect, disputed, pending, correctPct };
}

function isAccuracyAction(value: unknown): value is AccuracySampleActionFilter {
  return value === "takedown" || value === "dismiss" || value === "all";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const version = negotiateVersion(req, res);
  if (!version) return;

  const moderatorAddress = (req.query.moderatorAddress as string) ?? "";
  const moderatorTimestamp = req.query.moderatorTimestamp
    ? parseInt(req.query.moderatorTimestamp as string, 10)
    : undefined;
  const moderatorSignature = (req.query.moderatorSignature as string) ?? undefined;

  if (!moderatorAddress) {
    res.status(401).json({ apiVersion: version, error: "Moderator address is required" });
    return;
  }

  const auth = verifyModeratorAuth({
    address: moderatorAddress,
    timestamp: moderatorTimestamp,
    signature: moderatorSignature,
    purpose: "moderation-accuracy",
  });
  if (!auth.ok) {
    res.status(auth.status).json({ apiVersion: version, error: auth.error });
    return;
  }

  const rawSampleSize = parseInt(req.query.sampleSize as string, 10);
  const sampleSize = Number.isNaN(rawSampleSize) ? 10 : rawSampleSize;
  if (sampleSize < 1 || sampleSize > 50) {
    res.status(400).json({ apiVersion: version, error: "sampleSize must be between 1 and 50" });
    return;
  }

  const rawAction = req.query.action as string | undefined;
  const action: AccuracySampleActionFilter = rawAction ?? "all";
  if (!isAccuracyAction(action)) {
    res.status(400).json({ apiVersion: version, error: "action must be takedown, dismiss, or all" });
    return;
  }

  const seed = (req.query.seed as string) || ACCURACY_SAMPLE_DEFAULT_SEED;
  const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;

  try {
    const eligible = getAccuracyEligibleItems({ action, since });
    const sample = selectAccuracyReviewSample(eligible, sampleSize, seed);

    // Build an accuracy summary from log entries that already have an outcome
    // recorded via POST /api/moderation/quality.  correctPct is null when no
    // entries in the sample have been reviewed yet, preventing fictional stats.
    const accuracySummary = buildAccuracySummary(sample);

    res.status(200).json(
      withVersion(
        {
          sample,
          accuracySummary,
          meta: {
            sampleSize,
            seed,
            totalEligible: eligible.length,
            generatedAt: Date.now(),
          },
        },
        version,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build accuracy sample";
    console.error("Moderation accuracy error:", message);
    res.status(500).json(apiError(ErrorCode.TEMPORARY_FAILURE, message, undefined, version));
  }
}
