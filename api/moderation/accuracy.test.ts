// @vitest-environment node

import { Buffer } from "buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { buildModeratorAuthMessage } from "../../src/lib/auth/challenge";
import { addModerationLog, addReport, updateReportStatus } from "./data";

const moderator = Keypair.random();

function sign(message: string, kp: Keypair): string {
  return Buffer.from(kp.sign(Buffer.from(message, "utf8"))).toString("base64");
}

function signedQuery(
  kp: Keypair,
  extra: Record<string, string> = {},
): Record<string, string> {
  const ts = Date.now();
  return {
    moderatorAddress: kp.publicKey(),
    moderatorTimestamp: String(ts),
    moderatorSignature: sign(
      buildModeratorAuthMessage(kp.publicKey(), "moderation-accuracy", ts),
      kp,
    ),
    ...extra,
  };
}

async function invokeAccuracy(query: Record<string, string>, method = "GET") {
  let statusCode = 0;
  let responseData: Record<string, unknown> = {};
  const req = {
    method,
    headers: {},
    query,
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
  const handler = (await import("./accuracy")).default;
  // @ts-expect-error test handler invocation
  await handler(req, res);
  return { statusCode, responseData };
}

describe("moderation accuracy endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MODERATOR_ADDRESSES = moderator.publicKey();
    const resolved = addReport({
      reporterAddress: "GREPORTER1",
      targetType: "prompt",
      targetId: "prompt_accuracy_1",
      reason: "spam",
    });
    updateReportStatus(resolved.id, "resolved", { resolvedBy: moderator.publicKey() });
    const dismissed = addReport({
      reporterAddress: "GREPORTER2",
      targetType: "review",
      targetId: "review_accuracy_2",
      reason: "copyright",
    });
    updateReportStatus(dismissed.id, "dismissed", { resolvedBy: moderator.publicKey() });
    addModerationLog({
      action: "prompt_takedown",
      moderatorAddress: moderator.publicKey(),
      targetId: "prompt_accuracy_1",
      targetType: "prompt",
      reason: "takedown after review",
    });
  });

  it("rejects requests without a moderator address", async () => {
    const { statusCode } = await invokeAccuracy({});
    expect(statusCode).toBe(401);
  });

  it("rejects requests from a non-moderator", async () => {
    const stranger = Keypair.random();
    const { statusCode } = await invokeAccuracy(signedQuery(stranger));
    expect(statusCode).toBe(403);
  });

  it("returns a sample with meta and no fictional accuracy summary", async () => {
    const { statusCode, responseData } = await invokeAccuracy(
      signedQuery(moderator, { sampleSize: "2", seed: "accuracy-seed-1" }),
    );
    expect(statusCode).toBe(200);
    const sample = (responseData as any).sample as unknown[];
    const meta = (responseData as any).meta as Record<string, unknown>;
    expect(Array.isArray(sample)).toBe(true);
    expect(sample.length).toBeLessThanOrEqual(2);
    expect(meta.sampleSize).toBe(2);
    expect(meta.seed).toBe("accuracy-seed-1");
    expect(meta.totalEligible).toBeGreaterThanOrEqual(sample.length);
    expect(meta.generatedAt).toBeGreaterThan(0);
    expect((responseData as any).accuracySummary).toBeUndefined();
  });

  it("is deterministic for the same seed", async () => {
    const first = await invokeAccuracy(
      signedQuery(moderator, { sampleSize: "10", seed: "deterministic-seed" }),
    );
    const second = await invokeAccuracy(
      signedQuery(moderator, { sampleSize: "10", seed: "deterministic-seed" }),
    );
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const firstIds = ((first.responseData as any).sample as Array<{ id: string }>).map(
      (entry) => entry.id,
    );
    const secondIds = ((second.responseData as any).sample as Array<{ id: string }>).map(
      (entry) => entry.id,
    );
    expect(secondIds).toEqual(firstIds);
  });
});
