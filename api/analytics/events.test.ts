// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../src/lib/api/errorCodes";

// vi.mock factories below are hoisted above this file's imports, so the
// mocks they reference must be created via vi.hoisted() rather than plain
// top-level consts (otherwise they're accessed before initialization).
const { checkRateLimitMock, recordAnalyticsEventMock, metricsMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(),
  recordAnalyticsEventMock: vi.fn(),
  metricsMock: {
    emit: vi.fn(),
    trackRateLimitHit: vi.fn(),
    trackAnalyticsEvent: vi.fn(),
    trackAnalyticsEventRejected: vi.fn(),
  },
}));

vi.mock("../../src/lib/observability/wrapper", () => ({
  withObservability: (handler: unknown) => handler,
}));

vi.mock("../../src/lib/observability/rateLimiter", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

vi.mock("../../src/lib/observability/metrics", () => ({
  metrics: metricsMock,
}));

vi.mock("../../server/src/services/analyticsEvents", () => ({
  recordAnalyticsEvent: (...args: unknown[]) => recordAnalyticsEventMock(...args),
}));

import handler from "./events";

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: {},
    body: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    requestId: "test-request",
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  };
}

interface FakeRes {
  statusCode: number;
  responseData: Record<string, unknown>;
  status(code: number): FakeRes;
  json(data: Record<string, unknown>): FakeRes;
  setHeader: ReturnType<typeof vi.fn>;
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    responseData: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: Record<string, unknown>) {
      res.responseData = data;
      return res;
    },
    setHeader: vi.fn(),
  };
  return res;
}

describe("POST /api/analytics/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 60_000 });
    recordAnalyticsEventMock.mockResolvedValue(undefined);
  });

  it("rejects non-POST methods", async () => {
    const req = makeReq({ method: "GET" });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.responseData.code).toBe(ErrorCode.METHOD_NOT_ALLOWED);
  });

  it("accepts a valid known event and records it", async () => {
    const req = makeReq({
      body: {
        event: "wallet_connected",
        occurredAt: Date.now(),
        properties: { walletKind: "freighter" },
      },
    });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.responseData.accepted).toBe(true);
    expect(recordAnalyticsEventMock).toHaveBeenCalledTimes(1);
    expect(recordAnalyticsEventMock.mock.calls[0][0]).toMatchObject({
      event: "wallet_connected",
      properties: { walletKind: "freighter" },
    });
    expect(metricsMock.trackAnalyticsEvent).toHaveBeenCalledWith("wallet_connected");
  });

  it("rejects a request missing required envelope fields", async () => {
    const req = makeReq({ body: { event: "wallet_connected" } });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.responseData.code).toBe(ErrorCode.MISSING_FIELDS);
    expect(recordAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("rejects an event name outside the registered taxonomy", async () => {
    const req = makeReq({
      body: { event: "totally_made_up_event", occurredAt: Date.now(), properties: {} },
    });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.responseData.code).toBe(ErrorCode.UNKNOWN_EVENT);
    expect(recordAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("rejects a payload that fails the event's schema", async () => {
    const req = makeReq({
      body: {
        event: "marketplace_search_performed",
        occurredAt: Date.now(),
        // resultCount is required and must be a non-negative int.
        properties: { queryLength: 5 },
      },
    });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.responseData.code).toBe(ErrorCode.INVALID_EVENT_PAYLOAD);
    expect(recordAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("rejects a payload smuggling a raw wallet address", async () => {
    const req = makeReq({
      body: {
        event: "wallet_connected",
        occurredAt: Date.now(),
        properties: {
          // Matches STELLAR_ADDRESS_PATTERN (^G[A-Z2-7]{55}$) exactly.
          walletHash: "G" + "A".repeat(55),
        },
      },
    });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    // Rejected either by the walletHash hex-shape schema or the raw-address
    // guard — both must result in a 400, never a stored event.
    expect(res.statusCode).toBe(400);
    expect(recordAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("returns 429 and skips recording when IP rate limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValueOnce({ success: false, limit: 60, remaining: 0, reset: 60_000 });

    const req = makeReq({
      body: { event: "wallet_connected", occurredAt: Date.now(), properties: {} },
    });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.responseData.code).toBe(ErrorCode.RATE_LIMIT_IP);
    expect(recordAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("clamps occurredAt when client clock drift is excessive", async () => {
    const staleTimestamp = Date.now() - 60 * 60_000; // 1 hour in the past
    const req = makeReq({
      body: { event: "prompt_purchase_initiated", occurredAt: staleTimestamp, properties: {} },
    });
    const res = makeRes();

    // @ts-expect-error test handler invocation
    await handler(req, res);

    expect(res.statusCode).toBe(202);
    const recordedAt = recordAnalyticsEventMock.mock.calls[0][0].occurredAt as Date;
    expect(Math.abs(recordedAt.getTime() - Date.now())).toBeLessThan(5000);
  });
});
