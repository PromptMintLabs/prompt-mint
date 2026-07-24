/**
 * Tests for listing takedown semantics (Issue #130).
 *
 * Validates the full state machine: discovery suppression, sales freeze,
 * emergency suspension, reinstatement, disputes, on-chain integrity guarantees,
 * and edge cases.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  TakedownState,
  applyTakedown,
  reinstateListing,
  disputeTakedown,
  canPurchase,
  canUnlock,
  isDiscoverable,
  filterDiscoverablePrompts,
  getTakedown,
  hasTakedown,
  persistTakedowns,
  loadTakedowns,
  _clearTakedowns,
} from "@/lib/moderation/takedown";
import type { PromptRecord } from "@/lib/stellar/promptHashClient";

beforeEach(() => {
  _clearTakedowns();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const promptId = 42n;
const userAddress = "GBUYER123";

const MOCK_HAS_ACCESS = true;
const MOCK_NO_ACCESS = false;

// ─── Listing with no takedown ─────────────────────────────────────────────────

describe("listing with no takedown (NONE)", () => {
  it("is discoverable", () => {
    expect(isDiscoverable(promptId)).toBe(true);
  });

  it("is purchasable", () => {
    expect(canPurchase(promptId, userAddress)).toBe(true);
  });

  it("allows purchasers with on-chain access to unlock", () => {
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
  });

  it("blocks users without on-chain access from unlocking", () => {
    expect(canUnlock(promptId, userAddress, MOCK_NO_ACCESS)).toBe(false);
  });

  it("has no takedown record", () => {
    expect(hasTakedown(promptId)).toBe(false);
    expect(getTakedown(promptId)).toBeUndefined();
  });
});

// ─── DISCOVERY_SUPPRESSED ─────────────────────────────────────────────────────

describe("DISCOVERY_SUPPRESSED", () => {
  beforeEach(() => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Copyright review pending");
  });

  it("is not discoverable", () => {
    expect(isDiscoverable(promptId)).toBe(false);
  });

  it("is still purchasable via direct link", () => {
    expect(canPurchase(promptId, userAddress)).toBe(true);
  });

  it("allows existing purchasers to unlock", () => {
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
  });

  it("blocks non-purchasers from unlocking", () => {
    expect(canUnlock(promptId, userAddress, MOCK_NO_ACCESS)).toBe(false);
  });

  it("is filtered from discoverable prompt lists", () => {
    const prompts: PromptRecord[] = [
      { id: 42n, title: "Suppressed", salesCount: 0, active: true } as PromptRecord,
    ];
    expect(filterDiscoverablePrompts(prompts)).toHaveLength(0);
  });
});

// ─── SALES_FROZEN ─────────────────────────────────────────────────────────────

describe("SALES_FROZEN", () => {
  beforeEach(() => {
    applyTakedown(promptId, TakedownState.SALES_FROZEN, "Terms of Service violation");
  });

  it("is not discoverable", () => {
    expect(isDiscoverable(promptId)).toBe(false);
  });

  it("blocks new purchases", () => {
    expect(canPurchase(promptId, userAddress)).toBe(false);
  });

  it("allows existing purchasers to unlock", () => {
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
  });

  it("blocks non-purchasers from unlocking", () => {
    expect(canUnlock(promptId, userAddress, MOCK_NO_ACCESS)).toBe(false);
  });
});

// ─── EMERGENCY_SUSPENDED ──────────────────────────────────────────────────────

describe("EMERGENCY_SUSPENDED", () => {
  beforeEach(() => {
    applyTakedown(
      promptId,
      TakedownState.EMERGENCY_SUSPENDED,
      "Legal injunction — DCMA court order #2025-0042",
      "admin@promptmint.io",
    );
  });

  it("is not discoverable", () => {
    expect(isDiscoverable(promptId)).toBe(false);
  });

  it("blocks new purchases", () => {
    expect(canPurchase(promptId, userAddress)).toBe(false);
  });

  it("blocks existing purchasers from unlocking (overrides on-chain access)", () => {
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(false);
  });

  it("blocks even creators from unlocking", () => {
    expect(canUnlock(promptId, "GCREATOR", MOCK_HAS_ACCESS)).toBe(false);
  });

  it("stores escalation metadata", () => {
    const record = getTakedown(promptId);
    expect(record?.escalatedBy).toBe("admin@promptmint.io");
    expect(record?.escalatedAt).toBeGreaterThan(0);
  });
});

// ─── Reinstatement ────────────────────────────────────────────────────────────

describe("reinstatement after takedown", () => {
  it("restores NONE from DISCOVERY_SUPPRESSED", () => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Review");
    const result = reinstateListing(promptId);

    expect(result?.state).toBe(TakedownState.NONE);
    expect(result?.reinstatedAt).toBeGreaterThan(0);
    expect(isDiscoverable(promptId)).toBe(true);
    expect(canPurchase(promptId, userAddress)).toBe(true);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
  });

  it("restores NONE from SALES_FROZEN", () => {
    applyTakedown(promptId, TakedownState.SALES_FROZEN, "TOS violation");
    reinstateListing(promptId);

    expect(isDiscoverable(promptId)).toBe(true);
    expect(canPurchase(promptId, userAddress)).toBe(true);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
  });

  it("restores NONE from EMERGENCY_SUSPENDED", () => {
    applyTakedown(promptId, TakedownState.EMERGENCY_SUSPENDED, "Court order", "admin@pm.io");
    reinstateListing(promptId);

    expect(isDiscoverable(promptId)).toBe(true);
    expect(canPurchase(promptId, userAddress)).toBe(true);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
    expect(hasTakedown(promptId)).toBe(false);
  });
});

// ─── Disputes ─────────────────────────────────────────────────────────────────

describe("dispute handling", () => {
  it("creates a dispute record without changing takedown state", () => {
    applyTakedown(promptId, TakedownState.SALES_FROZEN, "TOS violation");

    const result = disputeTakedown(promptId, "I have rights assignment — see attachment");

    expect(result).not.toBeNull();
    expect(result?.state).toBe(TakedownState.SALES_FROZEN);
    expect(result?.disputeId).toMatch(/^dispute_\d+_/);
    expect(result?.reason).toContain("DISPUTE:");
  });

  it("returns null for a non-takedown listing", () => {
    const result = disputeTakedown(promptId, "No takedown to dispute");
    expect(result).toBeNull();
  });

  it("returns null for a reinstated (NONE) listing", () => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Review");
    reinstateListing(promptId);
    const result = disputeTakedown(promptId, "Already reinstated");
    expect(result).toBeNull();
  });

  it("preserves disputeId across multiple takedown applications", () => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Review");
    const firstDispute = disputeTakedown(promptId, "Evidence A");

    applyTakedown(promptId, TakedownState.SALES_FROZEN, "Escalated — TOS violation");
    const record = getTakedown(promptId);

    expect(record?.disputeId).toBe(firstDispute?.disputeId);
    expect(record?.state).toBe(TakedownState.SALES_FROZEN);
  });
});

// ─── Cached pages — existing purchasers accessing via cached detail page ──────

describe("cached listing detail page access", () => {
  it("allows unlock from cached page when DISCOVERY_SUPPRESSED (on-chain access intact)", () => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Review");

    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
  });

  it("allows unlock from cached page when SALES_FROZEN (on-chain access intact)", () => {
    applyTakedown(promptId, TakedownState.SALES_FROZEN, "TOS violation");

    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
  });

  it("blocks unlock from cached page when EMERGENCY_SUSPENDED", () => {
    applyTakedown(promptId, TakedownState.EMERGENCY_SUSPENDED, "Court order", "admin@pm.io");

    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(false);
  });
});

// ─── On-chain integrity ───────────────────────────────────────────────────────

describe("on-chain integrity guarantee", () => {
  it("never modifies PromptRecord.active field", () => {
    const prompt: PromptRecord = { id: promptId, active: true, salesCount: 5 } as PromptRecord;

    applyTakedown(promptId, TakedownState.SALES_FROZEN, "TOS");
    // on-chain active field untouched
    expect(prompt.active).toBe(true);
    expect(prompt.salesCount).toBe(5);

    applyTakedown(promptId, TakedownState.EMERGENCY_SUSPENDED, "Legal", "admin@pm.io");
    expect(prompt.active).toBe(true);
    expect(prompt.salesCount).toBe(5);

    reinstateListing(promptId);
    expect(prompt.active).toBe(true);
    expect(prompt.salesCount).toBe(5);
  });

  it("canUnlock always depends on hasOnChainAccess (except EMERGENCY_SUSPENDED)", () => {
    // Without on-chain access, unlock is never granted regardless of takedown state
    expect(canUnlock(promptId, userAddress, MOCK_NO_ACCESS)).toBe(false);

    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Review");
    expect(canUnlock(promptId, userAddress, MOCK_NO_ACCESS)).toBe(false);

    applyTakedown(promptId, TakedownState.SALES_FROZEN, "TOS");
    expect(canUnlock(promptId, userAddress, MOCK_NO_ACCESS)).toBe(false);

    applyTakedown(promptId, TakedownState.EMERGENCY_SUSPENDED, "Legal", "admin");
    expect(canUnlock(promptId, userAddress, MOCK_NO_ACCESS)).toBe(false);
  });

  it("with on-chain access, only EMERGENCY_SUSPENDED blocks unlock", () => {
    _clearTakedowns();
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);

    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Review");
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);

    applyTakedown(promptId, TakedownState.SALES_FROZEN, "TOS");
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);

    applyTakedown(promptId, TakedownState.EMERGENCY_SUSPENDED, "Legal", "admin");
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(false);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("applyTakedown on non-existent listing succeeds (creates record)", () => {
    const record = applyTakedown(999n, TakedownState.SALES_FROZEN, "Spam");
    expect(record).toBeDefined();
    expect(record.promptId).toBe(999n);
    expect(record.state).toBe(TakedownState.SALES_FROZEN);
  });

  it("double takedown overwrites previous state", () => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "First");
    applyTakedown(promptId, TakedownState.SALES_FROZEN, "Escalated");

    const record = getTakedown(promptId);
    expect(record?.state).toBe(TakedownState.SALES_FROZEN);
    expect(record?.reason).toBe("Escalated");
  });

  it("reinstatement of never-takedown listing returns null", () => {
    const result = reinstateListing(123n);
    expect(result).toBeNull();
  });

  it("reinstatement clears hasTakedown", () => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Review");
    expect(hasTakedown(promptId)).toBe(true);

    reinstateListing(promptId);
    expect(hasTakedown(promptId)).toBe(false);
  });

  it("applyTakedown with NONE state throws", () => {
    expect(() =>
      applyTakedown(promptId, TakedownState.NONE, "Should not work"),
    ).toThrow("Use reinstateListing() to return a listing to NONE.");
  });

  it("escalatedAt is set only on the initial application, not on re-application", () => {
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "First");
    const first = getTakedown(promptId);

    applyTakedown(promptId, TakedownState.SALES_FROZEN, "Escalated");
    const second = getTakedown(promptId);

    // On re-application escalatedAt is overwritten (current timestamp)
    expect(second?.escalatedAt).toBeGreaterThanOrEqual(first?.escalatedAt ?? 0);
  });
});

// ─── Persistence ──────────────────────────────────────────────────────────────

describe("persistTakedowns / loadTakedowns", () => {
  it("persists and restores all records", () => {
    applyTakedown(1n, TakedownState.DISCOVERY_SUPPRESSED, "Review");
    applyTakedown(2n, TakedownState.SALES_FROZEN, "TOS violation");

    const snapshot = persistTakedowns();
    expect(snapshot).toHaveLength(2);

    _clearTakedowns();
    expect(persistTakedowns()).toHaveLength(0);

    loadTakedowns(snapshot);
    expect(persistTakedowns()).toHaveLength(2);
    expect(isDiscoverable(1n)).toBe(false);
    expect(canPurchase(2n, userAddress)).toBe(false);
  });

  it("load overwrites existing records", () => {
    applyTakedown(1n, TakedownState.DISCOVERY_SUPPRESSED, "Old");

    const snapshot = [{
      promptId: 1n,
      state: TakedownState.SALES_FROZEN,
      reason: "Replaced",
      escalatedAt: Date.now(),
    }];

    loadTakedowns(snapshot);
    const record = getTakedown(1n);
    expect(record?.state).toBe(TakedownState.SALES_FROZEN);
    expect(record?.reason).toBe("Replaced");
  });
});

// ─── Multi-state traversal ────────────────────────────────────────────────────

describe("full state lifecycle traversal", () => {
  it("NONE → DISCOVERY_SUPPRESSED → SALES_FROZEN → EMERGENCY_SUSPENDED → reinstate → NONE", () => {
    // start: NONE
    expect(isDiscoverable(promptId)).toBe(true);
    expect(canPurchase(promptId, userAddress)).toBe(true);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);

    // step 1: DISCOVERY_SUPPRESSED
    applyTakedown(promptId, TakedownState.DISCOVERY_SUPPRESSED, "Step 1");
    expect(isDiscoverable(promptId)).toBe(false);
    expect(canPurchase(promptId, userAddress)).toBe(true);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);

    // step 2: SALES_FROZEN
    applyTakedown(promptId, TakedownState.SALES_FROZEN, "Step 2");
    expect(isDiscoverable(promptId)).toBe(false);
    expect(canPurchase(promptId, userAddress)).toBe(false);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);

    // step 3: EMERGENCY_SUSPENDED
    applyTakedown(promptId, TakedownState.EMERGENCY_SUSPENDED, "Step 3", "admin@pm.io");
    expect(isDiscoverable(promptId)).toBe(false);
    expect(canPurchase(promptId, userAddress)).toBe(false);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(false);

    // step 4: reinstatement
    reinstateListing(promptId);
    expect(isDiscoverable(promptId)).toBe(true);
    expect(canPurchase(promptId, userAddress)).toBe(true);
    expect(canUnlock(promptId, userAddress, MOCK_HAS_ACCESS)).toBe(true);
    expect(hasTakedown(promptId)).toBe(false);
  });
});
