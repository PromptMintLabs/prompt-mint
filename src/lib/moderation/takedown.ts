import type { PromptRecord } from "@/lib/stellar/promptHashClient";

/**
 * Takedown state machine controlling listing visibility, sales, and unlock.
 *
 * **Critical invariant**: On-chain entitlements (Prompt.active, Purchase records)
 * are NEVER modified by off-chain takedown flags. The `canUnlock` function always
 * honours on-chain access except for EMERGENCY_SUSPENDED, which requires
 * documented legal/safety escalation before application.
 */
export enum TakedownState {
  /** Listing is active and fully discoverable. */
  NONE = "NONE",
  /** Not shown in browse/search but accessible by direct URL. */
  DISCOVERY_SUPPRESSED = "DISCOVERY_SUPPRESSED",
  /** Discovery suppressed + new purchases blocked (existing purchasers retain access). */
  SALES_FROZEN = "SALES_FROZEN",
  /** All access suspended including unlock for existing purchasers (legal/safety escalation only). */
  EMERGENCY_SUSPENDED = "EMERGENCY_SUSPENDED",
}

export interface TakedownRecord {
  promptId: bigint;
  state: TakedownState;
  reason: string;
  escalatedBy?: string;
  escalatedAt?: number;
  reinstatedAt?: number;
  disputeId?: string;
}

const takedownMap = new Map<string, TakedownRecord>();

function key(promptId: bigint): string {
  return promptId.toString();
}

// ─── Core operations ──────────────────────────────────────────────────────────

export function applyTakedown(
  promptId: bigint,
  state: TakedownState,
  reason: string,
  escalatedBy?: string,
): TakedownRecord {
  if (state === TakedownState.NONE) {
    throw new Error("Use reinstateListing() to return a listing to NONE.");
  }

  const id = key(promptId);
  const existing = takedownMap.get(id);

  const record: TakedownRecord = {
    promptId,
    state,
    reason,
    escalatedBy,
    escalatedAt: Date.now(),
    disputeId: existing?.disputeId,
  };

  takedownMap.set(id, record);
  return record;
}

export function reinstateListing(promptId: bigint): TakedownRecord | null {
  const id = key(promptId);
  const existing = takedownMap.get(id);
  if (!existing) return null;

  const record: TakedownRecord = {
    ...existing,
    state: TakedownState.NONE,
    reinstatedAt: Date.now(),
  };

  takedownMap.set(id, record);
  return record;
}

export function disputeTakedown(
  promptId: bigint,
  evidence: string,
): TakedownRecord | null {
  const id = key(promptId);
  const existing = takedownMap.get(id);
  if (!existing || existing.state === TakedownState.NONE) return null;

  const disputeId = `dispute_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: TakedownRecord = {
    ...existing,
    disputeId,
    reason: `${existing.reason} | DISPUTE: ${evidence}`,
  };

  takedownMap.set(id, record);
  return record;
}

// ─── Access-control checks ────────────────────────────────────────────────────

/**
 * Whether a new purchase is allowed.
 * Blocked at SALES_FROZEN and EMERGENCY_SUSPENDED.
 */
export function canPurchase(promptId: bigint, _userAddress: string): boolean {
  const record = takedownMap.get(key(promptId));
  if (!record) return true;
  return (
    record.state === TakedownState.NONE ||
    record.state === TakedownState.DISCOVERY_SUPPRESSED
  );
}

/**
 * Whether a user can unlock prompt content.
 *
 * **Critical invariant**: On-chain entitlements are NEVER modified by off-chain
 * takedown flags. The `hasOnChainAccess` parameter is honoured in every state
 * except EMERGENCY_SUSPENDED, which requires documented legal/safety escalation.
 *
 * @param promptId - The listing identifier.
 * @param _userAddress - The wallet address attempting to unlock.
 * @param hasOnChainAccess - Whether the user has an active on-chain Purchase or is the creator.
 */
export function canUnlock(
  promptId: bigint,
  _userAddress: string,
  hasOnChainAccess: boolean,
): boolean {
  const record = takedownMap.get(key(promptId));

  if (!record) return hasOnChainAccess;

  if (record.state === TakedownState.EMERGENCY_SUSPENDED) {
    return false;
  }

  return hasOnChainAccess;
}

/**
 * Whether the listing appears in browse/search/discovery surfaces.
 */
export function isDiscoverable(promptId: bigint): boolean {
  const record = takedownMap.get(key(promptId));
  if (!record) return true;
  return record.state === TakedownState.NONE;
}

// ─── Filter helpers for batch operations ──────────────────────────────────────

/**
 * Filter a list of PromptRecords, removing those suppressed from discovery.
 * On-chain data (active, salesCount, etc.) is never modified — only filtered.
 */
export function filterDiscoverablePrompts(prompts: PromptRecord[]): PromptRecord[] {
  return prompts.filter((p) => isDiscoverable(p.id));
}

// ─── Read-only accessors ──────────────────────────────────────────────────────

export function getTakedown(promptId: bigint): TakedownRecord | undefined {
  return takedownMap.get(key(promptId));
}

export function hasTakedown(promptId: bigint): boolean {
  const record = takedownMap.get(key(promptId));
  return record != null && record.state !== TakedownState.NONE;
}

// ─── Persistence interface ────────────────────────────────────────────────────

/**
 * Serialize all takedown records for storage (e.g. localStorage, Redis, DB).
 * Returns a plain JSON-serializable array.
 */
export function persistTakedowns(): TakedownRecord[] {
  return Array.from(takedownMap.values());
}

/**
 * Hydrate the in-memory takedown map from a previously persisted snapshot.
 * Existing in-memory entries are replaced.
 */
export function loadTakedowns(records: TakedownRecord[]): void {
  takedownMap.clear();
  for (const record of records) {
    takedownMap.set(key(record.promptId), record);
  }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** @internal Remove all in-memory takedown state — used in test teardowns. */
export function _clearTakedowns(): void {
  takedownMap.clear();
}
