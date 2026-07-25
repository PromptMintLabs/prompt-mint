/**
 * Tests for the analytics event service and AnalyticsEvent model.
 *
 * Uses jest mocking so no live MongoDB connection is required, mirroring the
 * pattern in auditTrail.test.ts.
 */

jest.mock("../models/AnalyticsEvent", () => {
  const mockCreate = jest.fn();
  const mockFind = jest.fn();

  const mockChain = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  };
  mockFind.mockReturnValue(mockChain);

  return {
    AnalyticsEvent: {
      create: mockCreate,
      find: mockFind,
      __chain: mockChain,
    },
  };
});

import { AnalyticsEvent } from "../models/AnalyticsEvent";
import { recordAnalyticsEvent, queryAnalyticsEvents } from "../services/analyticsEvents";

const mockCreate = AnalyticsEvent.create as jest.MockedFunction<typeof AnalyticsEvent.create>;
const mockFind = AnalyticsEvent.find as jest.MockedFunction<typeof AnalyticsEvent.find>;
const mockChain = (AnalyticsEvent as any).__chain;

beforeEach(() => {
  jest.clearAllMocks();
  mockFind.mockReturnValue(mockChain);
  mockChain.sort.mockReturnValue(mockChain);
  mockChain.limit.mockReturnValue(mockChain);
  mockChain.lean.mockResolvedValue([]);
});

describe("recordAnalyticsEvent", () => {
  it("persists a wallet_connected event with all fields", async () => {
    mockCreate.mockResolvedValueOnce({} as never);
    const occurredAt = new Date();

    await recordAnalyticsEvent({
      event: "wallet_connected",
      walletHash: "a".repeat(64),
      promptId: null,
      occurredAt,
      requestId: "req-001",
      properties: { walletKind: "freighter" },
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      event: "wallet_connected",
      walletHash: "a".repeat(64),
      promptId: null,
      occurredAt,
      requestId: "req-001",
      properties: { walletKind: "freighter" },
    });
  });

  it("defaults optional fields to null/empty when omitted", async () => {
    mockCreate.mockResolvedValueOnce({} as never);
    const occurredAt = new Date();

    await recordAnalyticsEvent({
      event: "prompt_purchase_initiated",
      occurredAt,
      properties: {},
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ walletHash: null, promptId: null, requestId: null }),
    );
  });

  it("does not reject when the DB write fails (fire-and-forget)", async () => {
    mockCreate.mockRejectedValueOnce(new Error("DB down"));

    await expect(
      recordAnalyticsEvent({
        event: "prompt_unlocked",
        occurredAt: new Date(),
        properties: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("does NOT store a raw wallet address, plaintext, or free-text fields", async () => {
    mockCreate.mockResolvedValueOnce({} as never);

    await recordAnalyticsEvent({
      event: "prompt_viewed",
      occurredAt: new Date(),
      properties: { category: "writing" },
    });

    const callArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("walletAddress");
    expect(callArg).not.toHaveProperty("plaintext");
    expect(callArg).not.toHaveProperty("previewText");
    expect(callArg).not.toHaveProperty("ip");
  });
});

describe("queryAnalyticsEvents", () => {
  it("queries by event name", async () => {
    mockChain.lean.mockResolvedValueOnce([]);

    await queryAnalyticsEvents({ event: "wallet_connected" });

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ event: "wallet_connected" }));
  });

  it("queries by walletHash and promptId together", async () => {
    mockChain.lean.mockResolvedValueOnce([]);

    await queryAnalyticsEvents({ walletHash: "a".repeat(64), promptId: "42" });

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ walletHash: "a".repeat(64), promptId: "42" }),
    );
  });

  it("applies since/until date range", async () => {
    mockChain.lean.mockResolvedValueOnce([]);
    const since = new Date("2025-01-01");
    const until = new Date("2025-12-31");

    await queryAnalyticsEvents({ since, until });

    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ createdAt: { $gte: since, $lte: until } }),
    );
  });

  it("defaults limit to 100", async () => {
    mockChain.lean.mockResolvedValueOnce([]);

    await queryAnalyticsEvents({});

    expect(mockChain.limit).toHaveBeenCalledWith(100);
  });

  it("respects a custom limit", async () => {
    mockChain.lean.mockResolvedValueOnce([]);

    await queryAnalyticsEvents({ limit: 10 });

    expect(mockChain.limit).toHaveBeenCalledWith(10);
  });
});
