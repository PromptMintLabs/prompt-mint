import { describe, expect, it } from "vitest";
import {
  AnalyticsEventEnvelope,
  containsRawWalletAddress,
  isKnownEvent,
  validateEventProperties,
} from "./taxonomy";

const VALID_WALLET_HASH = "a".repeat(64);
// Matches the taxonomy's STELLAR_ADDRESS_PATTERN (^G[A-Z2-7]{55}$) exactly.
const RAW_STELLAR_ADDRESS = "G" + "A".repeat(55);

describe("isKnownEvent", () => {
  it("accepts every registered taxonomy event", () => {
    expect(isKnownEvent("wallet_connected")).toBe(true);
    expect(isKnownEvent("prompt_purchase_completed")).toBe(true);
  });

  it("rejects an unregistered event name", () => {
    expect(isKnownEvent("totally_made_up_event")).toBe(false);
  });
});

describe("validateEventProperties — success paths", () => {
  it("accepts a minimal valid payload with no optional fields", () => {
    const result = validateEventProperties("prompt_purchase_initiated", {});
    expect(result.success).toBe(true);
  });

  it("accepts a payload with a valid walletHash and promptId", () => {
    const result = validateEventProperties("prompt_unlocked", {
      walletHash: VALID_WALLET_HASH,
      promptId: "42",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.walletHash).toBe(VALID_WALLET_HASH);
      expect(result.data.promptId).toBe("42");
    }
  });

  it("accepts marketplace_search_performed with only numeric aggregates", () => {
    const result = validateEventProperties("marketplace_search_performed", {
      queryLength: 12,
      resultCount: 3,
      category: "writing",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a snake_case reasonCode on failure events", () => {
    const result = validateEventProperties("prompt_purchase_failed", {
      reasonCode: "insufficient_balance",
    });
    expect(result.success).toBe(true);
  });
});

describe("validateEventProperties — failure paths", () => {
  it("rejects a walletHash that is not a 64-char hex digest", () => {
    const result = validateEventProperties("wallet_connected", {
      walletHash: "not-a-hash",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a raw wallet address passed as walletHash", () => {
    const result = validateEventProperties("wallet_connected", {
      walletHash: RAW_STELLAR_ADDRESS,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra fields (schemas are strict)", () => {
    const result = validateEventProperties("prompt_viewed", {
      previewText: "leaked prompt content",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a reasonCode containing free text instead of a short code", () => {
    const result = validateEventProperties("prompt_purchase_failed", {
      reasonCode: "The user's card was declined by their bank at 3pm",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative resultCount", () => {
    const result = validateEventProperties("marketplace_search_performed", {
      queryLength: 5,
      resultCount: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("containsRawWalletAddress", () => {
  it("detects a raw address at the top level", () => {
    expect(containsRawWalletAddress(RAW_STELLAR_ADDRESS)).toBe(true);
  });

  it("detects a raw address nested inside an object", () => {
    expect(containsRawWalletAddress({ nested: { deep: RAW_STELLAR_ADDRESS } })).toBe(true);
  });

  it("detects a raw address inside an array", () => {
    expect(containsRawWalletAddress([1, "fine", RAW_STELLAR_ADDRESS])).toBe(true);
  });

  it("does not flag a valid walletHash digest", () => {
    expect(containsRawWalletAddress({ walletHash: VALID_WALLET_HASH })).toBe(false);
  });

  it("does not flag ordinary strings", () => {
    expect(containsRawWalletAddress({ category: "writing", promptId: "7" })).toBe(false);
  });
});

describe("AnalyticsEventEnvelope", () => {
  it("accepts a well-formed envelope", () => {
    const result = AnalyticsEventEnvelope.safeParse({
      event: "wallet_connected",
      occurredAt: Date.now(),
      properties: { walletHash: VALID_WALLET_HASH },
    });
    expect(result.success).toBe(true);
  });

  it("parses an envelope with an unregistered event name (shape is still well-formed)", () => {
    // The envelope only validates *shape* — whether the event name is part
    // of the taxonomy is a separate check via isKnownEvent, so the API layer
    // can return a distinct UNKNOWN_EVENT (vs. MISSING_FIELDS) error code.
    const result = AnalyticsEventEnvelope.safeParse({
      event: "not_a_real_event",
      occurredAt: Date.now(),
      properties: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(isKnownEvent(result.data.event)).toBe(false);
    }
  });

  it("rejects an envelope with an empty event name", () => {
    const result = AnalyticsEventEnvelope.safeParse({
      event: "",
      occurredAt: Date.now(),
      properties: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects an envelope missing occurredAt", () => {
    const result = AnalyticsEventEnvelope.safeParse({
      event: "wallet_connected",
      properties: {},
    });
    expect(result.success).toBe(false);
  });

  it("defaults properties to an empty object when omitted", () => {
    const result = AnalyticsEventEnvelope.safeParse({
      event: "prompt_purchase_initiated",
      occurredAt: Date.now(),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.properties).toEqual({});
    }
  });
});
