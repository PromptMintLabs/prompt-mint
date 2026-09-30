import {
  buildModeratorAuthMessage,
  verifyChallengeSignature,
} from "../../src/lib/auth/challenge";
import {
  cloneListingSnapshot,
  type ReportedListingSnapshot,
} from "../../src/lib/moderation/listingSnapshot";

export type ModerationAction =
  | "review_removed"
  | "review_approved"
  | "user_warned"
  | "report_resolved"
  | "report_dismissed"
  | "prompt_takedown"
  | "prompt_reinstated";

export type ModerationTargetType = "review" | "user" | "report" | "prompt";

/**
 * Outcome recorded by a reviewer during a quality spot-check.
 * - "correct"   – the original moderation decision was the right call.
 * - "incorrect" – the decision was wrong (e.g. false-positive takedown).
 * - "disputed"  – reviewer is uncertain; needs escalation.
 */
export type ModerationOutcome = "correct" | "incorrect" | "disputed";

export interface ModerationLogEntry {
  id: string;
  action: ModerationAction;
  moderatorAddress: string;
  targetId: string;
  targetType: ModerationTargetType;
  reason: string;
  details?: string;
  createdAt: number;
  /** Set by a reviewer performing a quality spot-check after the decision. */
  outcome?: ModerationOutcome;
  /**
   * Reviewer-assigned quality score in [0.0, 1.0].
   * 1.0 = perfect decision, 0.0 = completely wrong.
   * Derived from `outcome` when not supplied explicitly.
   */
  qualityScore?: number;
}

// ── Abuse reports ─────────────────────────────────────────────────────────────

export type ReportTargetType = "prompt" | "review" | "user";
export type ReportStatus = "pending" | "under_review" | "resolved" | "dismissed";
export type ReportReason =
  | "copyright"
  | "spam"
  | "inappropriate"
  | "scam"
  | "misinformation"
  | "other";

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
   * report was filed (#737). Listings can be edited or deleted before a
   * moderator reviews the report, so the snapshot preserves what was reported.
   */
  listingSnapshot?: ReportedListingSnapshot;
}

const reports: AbuseReport[] = [];

export const REPORT_REASONS: ReportReason[] = [
  "copyright",
  "spam",
  "inappropriate",
  "scam",
  "misinformation",
  "other",
];

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addReport(
  entry: Omit<AbuseReport, "id" | "createdAt" | "updatedAt" | "status">,
): AbuseReport {
  const now = Date.now();
  const stored: AbuseReport = {
    ...entry,
    id: generateId("rep"),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    // Persist an independent deep copy so later listing edits never mutate the
    // evidence a moderator will review.
    ...(entry.listingSnapshot
      ? { listingSnapshot: cloneListingSnapshot(entry.listingSnapshot) }
      : {}),
  };
  reports.push(stored);
  return stored;
}

export function getReportById(id: string): AbuseReport | undefined {
  return reports.find((report) => report.id === id);
}

export interface ReportQuery {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  reason?: ReportReason;
  reporterAddress?: string;
  search?: string;
  since?: number;
}

export function getReports(query: ReportQuery = {}): AbuseReport[] {
  let filtered = [...reports];
  if (query.status) filtered = filtered.filter((r) => r.status === query.status);
  if (query.targetType) filtered = filtered.filter((r) => r.targetType === query.targetType);
  if (query.reason) filtered = filtered.filter((r) => r.reason === query.reason);
  if (query.reporterAddress)
    filtered = filtered.filter(
      (r) => r.reporterAddress.toLowerCase() === query.reporterAddress!.toLowerCase(),
    );
  if (query.since) filtered = filtered.filter((r) => r.createdAt >= query.since!);
  if (query.search) {
    const needle = query.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.targetId.toLowerCase().includes(needle) ||
        r.details?.toLowerCase().includes(needle) ||
        r.reporterAddress.toLowerCase().includes(needle),
    );
  }
  filtered.sort((a, b) => b.createdAt - a.createdAt);
  return filtered;
}

export function hasOpenReport(
  reporterAddress: string,
  targetType: ReportTargetType,
  targetId: string,
): boolean {
  return reports.some(
    (r) =>
      r.reporterAddress.toLowerCase() === reporterAddress.toLowerCase() &&
      r.targetType === targetType &&
      r.targetId === targetId &&
      r.status !== "resolved" &&
      r.status !== "dismissed",
  );
}

export function updateReportStatus(
  id: string,
  status: ReportStatus,
  options: { resolvedBy?: string; resolution?: string; now?: number } = {},
): AbuseReport | undefined {
  const report = getReportById(id);
  if (!report) return undefined;
  report.status = status;
  report.updatedAt = options.now ?? Date.now();
  if (options.resolvedBy) report.resolvedBy = options.resolvedBy;
  if (options.resolution) report.resolution = options.resolution;
  return report;
}

// ── Prompt takedown state ────────────────────────────────────────────────────

export type PromptModerationStatus = "active" | "taken_down";

export interface PromptModerationState {
  promptId: string;
  status: PromptModerationStatus;
  reason?: string;
  updatedAt: number;
  updatedBy?: string;
}

const promptStates = new Map<string, PromptModerationState>();

export function getPromptModerationState(promptId: string): PromptModerationState {
  return (
    promptStates.get(promptId) ?? {
      promptId,
      status: "active",
      updatedAt: 0,
    }
  );
}

export function setPromptModerationState(
  promptId: string,
  status: PromptModerationStatus,
  options: { reason?: string; updatedBy?: string; now?: number } = {},
): PromptModerationState {
  const state: PromptModerationState = {
    promptId,
    status,
    reason: options.reason,
    updatedAt: options.now ?? Date.now(),
    updatedBy: options.updatedBy,
  };
  promptStates.set(promptId, state);
  return state;
}

export function isPromptTakenDown(promptId: string): boolean {
  return getPromptModerationState(promptId).status === "taken_down";
}

const logs: ModerationLogEntry[] = [];

export function addModerationLog(entry: Omit<ModerationLogEntry, "id" | "createdAt">): ModerationLogEntry {
  const stored = { ...entry, id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() };
  logs.push(stored);
  return stored;
}

export function getModerationLogs(): ModerationLogEntry[] {
  return logs;
}

export function getModerationLogById(id: string): ModerationLogEntry | undefined {
  return logs.find((entry) => entry.id === id);
}

const OUTCOME_DEFAULT_SCORES: Record<ModerationOutcome, number> = {
  correct: 1.0,
  incorrect: 0.0,
  disputed: 0.5,
};

/**
 * Records a quality outcome for an existing moderation log entry.
 * Returns `undefined` if the entry does not exist.
 *
 * @param qualityScore Optional override in [0.0, 1.0]; defaults to the
 *   canonical score for the given outcome when omitted.
 */
export function setModerationLogOutcome(
  id: string,
  outcome: ModerationOutcome,
  qualityScore?: number,
): ModerationLogEntry | undefined {
  const entry = getModerationLogById(id);
  if (!entry) return undefined;

  const clampedScore =
    qualityScore !== undefined
      ? Math.min(1, Math.max(0, qualityScore))
      : OUTCOME_DEFAULT_SCORES[outcome];

  entry.outcome = outcome;
  entry.qualityScore = clampedScore;
  return entry;
}

export function isAuthorizedModerator(address: string): boolean {
  const configured = (process.env.MODERATOR_ADDRESSES ?? "")
    .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  // Failing closed prevents an unconfigured deployment from granting moderation authority.
  return configured.length > 0 && configured.includes(address.toLowerCase());
}

// ── Moderator request authentication ─────────────────────────────────────────
//
// Knowing a moderator's public wallet address is not proof of controlling it —
// Stellar addresses are frequently public (attached to reviews, transactions,
// etc). Every moderation endpoint therefore requires a signature, proving the
// caller holds the matching private key, over a message that is scoped to a
// specific purpose (so a signature captured for one moderation endpoint can't
// be replayed against another) and a timestamp (so it can't be replayed after
// it expires).

const MODERATOR_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export interface ModeratorAuthParams {
  address?: string;
  timestamp?: number;
  signature?: string;
  purpose: string;
  now?: number;
}

export interface ModeratorAuthResult {
  ok: boolean;
  status: number;
  error?: string;
}

export function verifyModeratorAuth({
  address,
  timestamp,
  signature,
  purpose,
  now = Date.now(),
}: ModeratorAuthParams): ModeratorAuthResult {
  if (!address) {
    return { ok: false, status: 401, error: "Moderator address is required" };
  }

  if (!isAuthorizedModerator(address)) {
    return { ok: false, status: 403, error: "Unauthorized: Only authorized moderators can perform this action" };
  }

  if (!timestamp || !signature) {
    return { ok: false, status: 401, error: "Moderator signature is required" };
  }

  if (Math.abs(now - timestamp) > MODERATOR_SIGNATURE_MAX_AGE_MS) {
    return { ok: false, status: 401, error: "Moderator signature has expired" };
  }

  const message = buildModeratorAuthMessage(address, purpose, timestamp);
  if (!verifyChallengeSignature(address, message, signature)) {
    return { ok: false, status: 401, error: "Invalid moderator signature" };
  }

  return { ok: true, status: 200 };
}

// ── Accuracy review sampling ───────────────────────────────────────────────
// Deterministic sampling over resolved/actioned moderation outcomes so a
// reviewer can re-check a reproducible subset. Accuracy percentages are
// intentionally NOT derived here: there is no audited/appealed outcome field
// on reports or logs, so emitting a percentage would be fictional.

export type AccuracySampleActionFilter = "takedown" | "dismiss" | "all";

export interface AccuracySampleItem {
  id: string;
  kind: "report" | "log";
  action: string;
  targetId: string;
  targetType: string;
  createdAt: number;
}

export const ACCURACY_SAMPLE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
export const ACCURACY_SAMPLE_DEFAULT_SEED = "moderation-accuracy-default";

export function hashSeedToUint32(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(randomSeed: number): () => number {
  let state = randomSeed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isTakedownAction(action: string): boolean {
  return action === "prompt_takedown" || action === "review_removed";
}

function isDismissAction(action: string): boolean {
  return action === "report_dismissed";
}

export function getAccuracyEligibleItems(
  options: { action?: AccuracySampleActionFilter; since?: number; now?: number } = {},
): AccuracySampleItem[] {
  const { action = "all", since, now = Date.now() } = options;
  const windowStart = since ?? now - ACCURACY_SAMPLE_WINDOW_MS;

  const eligible: AccuracySampleItem[] = [];

  for (const report of getReports()) {
    const resolved = report.status === "resolved" || report.status === "dismissed";
    if (!resolved) continue;
    if (report.updatedAt < windowStart) continue;
    if (action === "takedown") continue;
    if (action === "dismiss" && report.status !== "dismissed") continue;
    eligible.push({
      id: report.id,
      kind: "report",
      action: report.status === "resolved" ? "report_resolved" : "report_dismissed",
      targetId: report.targetId,
      targetType: report.targetType,
      createdAt: report.updatedAt,
    });
  }

  for (const log of getModerationLogs()) {
    if (log.createdAt < windowStart) continue;
    if (action === "takedown" && !isTakedownAction(log.action)) continue;
    if (action === "dismiss" && !isDismissAction(log.action)) continue;
    eligible.push({
      id: log.id,
      kind: "log",
      action: log.action,
      targetId: log.targetId,
      targetType: log.targetType,
      createdAt: log.createdAt,
    });
  }

  eligible.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return eligible;
}

export function selectAccuracyReviewSample<T>(
  items: readonly T[],
  sampleSize: number,
  seed: string | number,
): T[] {
  if (sampleSize <= 0 || items.length === 0) return [];
  const seedUint32 = typeof seed === "number" ? seed >>> 0 : hashSeedToUint32(seed);
  const random = mulberry32(seedUint32);
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(sampleSize, shuffled.length));
}
