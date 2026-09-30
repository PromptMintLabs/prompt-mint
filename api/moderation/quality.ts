import { negotiateVersion } from "../../src/lib/api/versionGuard";
import { withVersion } from "../../src/lib/api/payloadVersion";
import { apiError, ErrorCode } from "../../src/lib/api/errorCodes";
import { metrics } from "../../src/lib/observability/metrics";
import {
  getModerationLogById,
  setModerationLogOutcome,
  verifyModeratorAuth,
  type ModerationOutcome,
} from "./data";

function isModerationOutcome(value: unknown): value is ModerationOutcome {
  return value === "correct" || value === "incorrect" || value === "disputed";
}

/**
 * POST /api/moderation/quality
 *
 * Records a quality outcome for a moderation log entry, identified by its
 * log ID.  Requires moderator authentication (address + signed timestamp).
 *
 * Body:
 *   moderatorAddress   string   – wallet address of the reviewing moderator
 *   moderatorTimestamp number   – Unix ms timestamp included in the signature
 *   moderatorSignature string   – base64 Ed25519 signature over the auth message
 *   logId              string   – ID of the ModerationLogEntry being reviewed
 *   outcome            string   – "correct" | "incorrect" | "disputed"
 *   qualityScore?      number   – optional override in [0.0, 1.0]
 *
 * Emits two observability metrics on success:
 *   moderation_quality_score          (gauge)
 *   moderation_outcome_recorded_total (counter)
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const version = negotiateVersion(req, res);
  if (!version) return;

  const {
    moderatorAddress,
    moderatorTimestamp,
    moderatorSignature,
    logId,
    outcome,
    qualityScore,
  } = req.body ?? {};

  // ── Moderator authentication ─────────────────────────────────────────────
  const auth = verifyModeratorAuth({
    address: moderatorAddress,
    timestamp: typeof moderatorTimestamp === "number" ? moderatorTimestamp : parseInt(moderatorTimestamp, 10),
    signature: moderatorSignature,
    purpose: "moderation-quality",
  });
  if (!auth.ok) {
    res.status(auth.status).json({ apiVersion: version, error: auth.error });
    return;
  }

  // ── Input validation ──────────────────────────────────────────────────────
  if (!logId || typeof logId !== "string") {
    res.status(400).json({ apiVersion: version, error: "logId is required" });
    return;
  }

  if (!isModerationOutcome(outcome)) {
    res
      .status(400)
      .json({ apiVersion: version, error: "outcome must be correct, incorrect, or disputed" });
    return;
  }

  let parsedScore: number | undefined;
  if (qualityScore !== undefined) {
    parsedScore = typeof qualityScore === "number" ? qualityScore : parseFloat(qualityScore);
    if (Number.isNaN(parsedScore) || parsedScore < 0 || parsedScore > 1) {
      res
        .status(400)
        .json({ apiVersion: version, error: "qualityScore must be a number between 0 and 1" });
      return;
    }
  }

  // ── Business logic ────────────────────────────────────────────────────────
  const existing = getModerationLogById(logId);
  if (!existing) {
    res.status(404).json({ apiVersion: version, error: "Moderation log entry not found" });
    return;
  }

  try {
    const updated = setModerationLogOutcome(logId, outcome, parsedScore);
    if (!updated) {
      // Should not happen given the existence check above, but guards against a
      // race with in-memory state being reset between the two calls.
      res.status(404).json({ apiVersion: version, error: "Moderation log entry not found" });
      return;
    }

    // Emit observability metrics so quality trends are visible in Prometheus /
    // Datadog dashboards without having to query the audit log directly.
    metrics.trackModerationQuality(updated.targetType, outcome, updated.qualityScore!);

    res.status(200).json(
      withVersion(
        {
          success: true,
          entry: {
            id: updated.id,
            action: updated.action,
            targetId: updated.targetId,
            targetType: updated.targetType,
            outcome: updated.outcome,
            qualityScore: updated.qualityScore,
            createdAt: updated.createdAt,
          },
        },
        version,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record quality outcome";
    console.error("Moderation quality error:", message);
    res.status(500).json(apiError(ErrorCode.TEMPORARY_FAILURE, message, undefined, version));
  }
}
