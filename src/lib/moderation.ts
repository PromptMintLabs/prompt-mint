import { buildReportAuthMessage } from "./auth/challenge";
import type { SignMessageFn } from "./auth/moderatorAuth";
import type {
  ReportListingInput,
  ReportedListingSnapshot,
} from "./moderation/listingSnapshot";

export type { ReportListingInput, ReportedListingSnapshot } from "./moderation/listingSnapshot";

export type ReportTargetType = "prompt" | "review" | "user";
export type ReportStatus = "pending" | "under_review" | "resolved" | "dismissed";
export type ReportReason =
  | "copyright"
  | "spam"
  | "inappropriate"
  | "scam"
  | "misinformation"
  | "other";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "copyright", label: "Copyright infringement" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "scam", label: "Scam / fraud" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

export interface AbuseReport {
  id: string;
  reporterAddress: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: number;
  updatedAt: number;
  resolvedBy?: string;
  resolution?: string;
  /**
   * Frozen copy of the reported listing's public fields, captured when the
   * report was filed (#737) so moderators can review what was reported even if
   * the listing is later edited or deleted.
   */
  listingSnapshot?: ReportedListingSnapshot;
}

export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export type ModerationActionType =
  | "review_removed"
  | "review_approved"
  | "user_warned"
  | "report_resolved"
  | "report_dismissed"
  | "prompt_takedown"
  | "prompt_reinstated";

export interface ModerationBulkAction {
  action: ModerationActionType;
  targetId: string;
  targetType: "review" | "user" | "report" | "prompt";
  reason: string;
  details?: string;
}

function extractSignedMessage(
  signature: { signedMessage?: string } | string,
): string {
  if (typeof signature === "string") return signature;
  if (!signature?.signedMessage) throw new Error("Wallet did not return a signed message.");
  return signature.signedMessage;
}

/**
 * Signs a reporter-auth message so a report request proves the caller controls
 * the reporting wallet, not merely knows its (often public) address.
 */
export async function signReportAuth(
  address: string,
  targetType: ReportTargetType,
  targetId: string,
  signMessage: SignMessageFn,
): Promise<{ reporterTimestamp: number; reporterSignature: string }> {
  const reporterTimestamp = Date.now();
  const message = buildReportAuthMessage(address, targetType, targetId, reporterTimestamp);
  const signature = await signMessage(message);
  return {
    reporterTimestamp,
    reporterSignature: extractSignedMessage(signature),
  };
}

export async function submitReport(params: {
  reporterAddress: string;
  signMessage: SignMessageFn;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
  /**
   * Public listing fields as they are at report time. The server normalizes and
   * freezes them; it is ignored for non-listing targets.
   */
  listingSnapshot?: ReportListingInput;
  apiBase?: string;
}): Promise<AbuseReport> {
  const {
    reporterAddress,
    signMessage,
    targetType,
    targetId,
    reason,
    details,
    listingSnapshot,
    apiBase = "/api/moderation/report",
  } = params;

  const { reporterTimestamp, reporterSignature } = await signReportAuth(
    reporterAddress,
    targetType,
    targetId,
    signMessage,
  );

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reporterAddress,
      reporterTimestamp,
      reporterSignature,
      targetType,
      targetId,
      reason,
      details,
      ...(listingSnapshot !== undefined && { listingSnapshot }),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Failed to submit report (${response.status})`);
  }
  return data.report as AbuseReport;
}

export async function fetchModerationQueue(params: {
  moderatorAddress: string;
  signMessage: SignMessageFn;
  filters?: {
    status?: ReportStatus;
    targetType?: ReportTargetType;
    reason?: ReportReason;
    search?: string;
    page?: number;
    limit?: number;
  };
  apiBase?: string;
}): Promise<{ entries: AbuseReport[]; pagination: ReportPagination }> {
  const { moderatorAddress, signMessage, filters = {}, apiBase = "/api/moderation/queue" } = params;
  const { signModeratorAuth } = await import("./auth/moderatorAuth");
  const { moderatorTimestamp, moderatorSignature } = await signModeratorAuth(
    moderatorAddress,
    "moderation-queue",
    signMessage,
  );

  const query = new URLSearchParams({
    moderatorAddress,
    moderatorTimestamp: String(moderatorTimestamp),
    moderatorSignature,
  });
  if (filters.status) query.set("status", filters.status);
  if (filters.targetType) query.set("targetType", filters.targetType);
  if (filters.reason) query.set("reason", filters.reason);
  if (filters.search) query.set("search", filters.search);
  if (filters.page) query.set("page", String(filters.page));
  if (filters.limit) query.set("limit", String(filters.limit));

  const response = await fetch(`${apiBase}?${query}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch moderation queue (${response.status})`);
  }
  const data = await response.json();
  return { entries: data.entries ?? [], pagination: data.pagination };
}

export async function moderationAction(params: {
  moderatorAddress: string;
  signMessage: SignMessageFn;
  actions: ModerationBulkAction[];
  apiBase?: string;
}): Promise<{ success: boolean; applied: unknown[]; errors: unknown[] }> {
  const { moderatorAddress, signMessage, actions, apiBase = "/api/moderation/actions" } = params;
  const { signModeratorAuth } = await import("./auth/moderatorAuth");
  const { moderatorTimestamp, moderatorSignature } = await signModeratorAuth(
    moderatorAddress,
    "moderation-action",
    signMessage,
  );

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      moderatorAddress,
      moderatorTimestamp,
      moderatorSignature,
      confirmed: true,
      actions,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Failed to apply moderation action (${response.status})`);
  }
  return data;
}

export async function fetchPromptStatus(
  promptId: string,
  apiBase = "/api/moderation/status",
): Promise<{ promptId: string; takenDown: boolean; reason: string | null; updatedAt: number }> {
  const query = new URLSearchParams({ promptId });
  const response = await fetch(`${apiBase}?${query}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch prompt status (${response.status})`);
  }
  return response.json();
}

/**
 * Outcome of a moderation quality spot-check, mirroring the server-side type.
 * - "correct"   – the original decision was the right call.
 * - "incorrect" – the decision was wrong (e.g. false-positive takedown).
 * - "disputed"  – reviewer is uncertain; needs escalation.
 */
export type ModerationOutcome = "correct" | "incorrect" | "disputed";

export interface ModerationQualityEntry {
  id: string;
  action: string;
  targetId: string;
  targetType: string;
  outcome: ModerationOutcome;
  qualityScore: number;
  createdAt: number;
}

/**
 * Records a quality outcome for an existing moderation log entry.
 *
 * Requires the caller to hold a moderator wallet — `signMessage` is used to
 * produce a short-lived signed auth token scoped to `"moderation-quality"`.
 *
 * @param logId        ID of the ModerationLogEntry to annotate.
 * @param outcome      Reviewer verdict: "correct" | "incorrect" | "disputed".
 * @param qualityScore Optional explicit score in [0.0, 1.0]; derived from
 *                     `outcome` when omitted.
 */
export async function recordModerationQuality(params: {
  moderatorAddress: string;
  signMessage: SignMessageFn;
  logId: string;
  outcome: ModerationOutcome;
  qualityScore?: number;
  apiBase?: string;
}): Promise<{ success: boolean; entry: ModerationQualityEntry }> {
  const {
    moderatorAddress,
    signMessage,
    logId,
    outcome,
    qualityScore,
    apiBase = "/api/moderation/quality",
  } = params;

  const { signModeratorAuth } = await import("./auth/moderatorAuth");
  const { moderatorTimestamp, moderatorSignature } = await signModeratorAuth(
    moderatorAddress,
    "moderation-quality",
    signMessage,
  );

  const response = await fetch(apiBase, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      moderatorAddress,
      moderatorTimestamp,
      moderatorSignature,
      logId,
      outcome,
      ...(qualityScore !== undefined && { qualityScore }),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Failed to record moderation quality (${response.status})`);
  }
  return data as { success: boolean; entry: ModerationQualityEntry };
}
