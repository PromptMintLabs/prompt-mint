// @vitest-environment node

import { Buffer } from "buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { buildModeratorAuthMessage } from "../../src/lib/auth/challenge";
import { addModerationLog } from "./data";
import { metrics } from "../../src/lib/observability/metrics";

const moderator = Keypair.random();

function sign(message: string, kp: Keypair): string {
  return Buffer.from(kp.sign(Buffer.from(message, "utf8"))).toString("base64");
}

function signedBody(
  kp: Keypair,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const ts = Date.now();
  return {
    moderatorAddress: kp.publicKey(),
    moderatorTimestamp: ts,
    moderatorSignature: sign(
      buildModeratorAuthMessage(kp.publicKey(), "moderation-quality", ts),
      kp,
    ),
    ...extra,
  };
}

async function invokeQuality(body: Record<string, unknown>, method = "POST") {
  let statusCode = 0;
  let responseData: Record<string, unknown> = {};
  const req = {
    method,
    headers: { "content-type": "application/json" },
    body,
    query: {},
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    requestId: "test",
    socket: { remoteAddress: "127.0.0.1" },
  };
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: Record<string, unknown>) {
      responseData = data;
      return this;
    },
    setHeader: vi.fn(),
  };
  const handler = (await import("./quality")).default;
  // @ts-expect-error test handler invocation
  await handler(req, res);
  return { statusCode, responseData };
}

describe("moderation quality endpoint", () => {
  let logId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    metrics._resetForTests();
    process.env.MODERATOR_ADDRESSES = moderator.publicKey();

    const entry = addModerationLog({
      action: "prompt_takedown",
      moderatorAddress: moderator.publicKey(),
      targetId: "prompt_q_1",
      targetType: "prompt",
      reason: "spam test",
    });
    logId = entry.id;
  });

  it("rejects non-POST methods", async () => {
    const { statusCode } = await invokeQuality({}, "GET");
    expect(statusCode).toBe(405);
  });

  it("rejects requests without a moderator address", async () => {
    const { statusCode, responseData } = await invokeQuality({
      logId,
      outcome: "correct",
    });
    expect(statusCode).toBe(401);
    expect(responseData.error).toMatch(/address/i);
  });

  it("rejects requests from a non-moderator", async () => {
    const stranger = Keypair.random();
    const { statusCode } = await invokeQuality(
      signedBody(stranger, { logId, outcome: "correct" }),
    );
    expect(statusCode).toBe(403);
  });

  it("rejects an invalid outcome value", async () => {
    const { statusCode, responseData } = await invokeQuality(
      signedBody(moderator, { logId, outcome: "unsure" }),
    );
    expect(statusCode).toBe(400);
    expect(responseData.error).toMatch(/outcome/i);
  });

  it("rejects a qualityScore outside [0, 1]", async () => {
    const { statusCode, responseData } = await invokeQuality(
      signedBody(moderator, { logId, outcome: "correct", qualityScore: 1.5 }),
    );
    expect(statusCode).toBe(400);
    expect(responseData.error).toMatch(/qualityScore/i);
  });

  it("returns 404 for an unknown logId", async () => {
    const { statusCode } = await invokeQuality(
      signedBody(moderator, { logId: "nonexistent_id", outcome: "correct" }),
    );
    expect(statusCode).toBe(404);
  });

  it("records a correct outcome with the default score", async () => {
    const { statusCode, responseData } = await invokeQuality(
      signedBody(moderator, { logId, outcome: "correct" }),
    );
    expect(statusCode).toBe(200);
    expect(responseData.success).toBe(true);

    const entry = (responseData as any).entry;
    expect(entry.id).toBe(logId);
    expect(entry.outcome).toBe("correct");
    expect(entry.qualityScore).toBe(1.0);
  });

  it("records an incorrect outcome with default score 0", async () => {
    const { statusCode, responseData } = await invokeQuality(
      signedBody(moderator, { logId, outcome: "incorrect" }),
    );
    expect(statusCode).toBe(200);
    const entry = (responseData as any).entry;
    expect(entry.outcome).toBe("incorrect");
    expect(entry.qualityScore).toBe(0.0);
  });

  it("records a disputed outcome with the provided qualityScore override", async () => {
    const { statusCode, responseData } = await invokeQuality(
      signedBody(moderator, { logId, outcome: "disputed", qualityScore: 0.4 }),
    );
    expect(statusCode).toBe(200);
    const entry = (responseData as any).entry;
    expect(entry.outcome).toBe("disputed");
    expect(entry.qualityScore).toBeCloseTo(0.4);
  });

  it("emits moderation quality metrics on success", async () => {
    await invokeQuality(signedBody(moderator, { logId, outcome: "correct" }));

    const names = metrics.snapshot().map((s) => s.name);
    expect(names).toContain("moderation_quality_score");
    expect(names).toContain("moderation_outcome_recorded_total");

    const scoreSample = metrics.snapshot().find((s) => s.name === "moderation_quality_score");
    expect(scoreSample?.value).toBe(1.0);
    expect(scoreSample?.labels.outcome).toBe("correct");
    expect(scoreSample?.labels.targetType).toBe("prompt");
  });
});
