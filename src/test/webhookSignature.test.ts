import { describe, it, expect } from "vitest";
import {
  evaluateWebhookSignature,
  timingSafeEqual,
  computeHmacSha256Hex,
} from "../lib/api/webhookSignature";

describe("Webhook Signature Verification (#755)", () => {
  const testSecret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const rawBody = JSON.stringify({
    event: "PromptPurchased",
    timestamp: new Date().toISOString(),
    data: { promptId: "42", buyer: "GABC..." },
  });

  it("performs constant-time string comparison safely", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("computes HMAC-SHA256 hex correctly", async () => {
    const hex = await computeHmacSha256Hex(testSecret, rawBody);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns verified status when signature and timestamp are valid", async () => {
    const hex = await computeHmacSha256Hex(testSecret, rawBody);
    const signature = `sha256=${hex}`;

    const result = await evaluateWebhookSignature({
      secret: testSecret,
      rawBody,
      signature,
      timestamp: Date.now(),
    });

    expect(result.status).toBe("verified");
    expect(result.isValid).toBe(true);
  });

  it("returns invalid status when signature does not match", async () => {
    const result = await evaluateWebhookSignature({
      secret: testSecret,
      rawBody,
      signature: "sha256=invalidhex0000000000000000000000000000000000000000000000000000000000",
      timestamp: Date.now(),
    });

    expect(result.status).toBe("invalid");
    expect(result.isValid).toBe(false);
  });

  it("returns expired status when timestamp exceeds acceptance window", async () => {
    const hex = await computeHmacSha256Hex(testSecret, rawBody);
    const signature = `sha256=${hex}`;
    const oldTimestamp = Date.now() - 600 * 1000; // 10 mins ago (> 5 mins tolerance)

    const result = await evaluateWebhookSignature({
      secret: testSecret,
      rawBody,
      signature,
      timestamp: oldTimestamp,
      toleranceSeconds: 300,
    });

    expect(result.status).toBe("expired");
    expect(result.isValid).toBe(false);
  });

  it("returns missing_secret when secret is not provided", async () => {
    const result = await evaluateWebhookSignature({
      secret: undefined,
      rawBody,
      signature: "sha256=somehash",
    });

    expect(result.status).toBe("missing_secret");
    expect(result.isValid).toBe(false);
  });

  it("returns missing_signature when signature header is missing", async () => {
    const result = await evaluateWebhookSignature({
      secret: testSecret,
      rawBody,
      signature: undefined,
    });

    expect(result.status).toBe("missing_signature");
    expect(result.isValid).toBe(false);
  });
});
