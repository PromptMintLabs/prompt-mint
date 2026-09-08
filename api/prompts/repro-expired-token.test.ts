// @vitest-environment node

import { Buffer } from "buffer";
import { describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { createChallengeToken } from "../../src/lib/auth/challenge";
import handler from "./unlock";
import { ErrorCode } from "../../src/lib/api/errorCodes";

// Mock dependencies
vi.mock("../../src/lib/stellar/promptHashClient", () => ({
  hasAccess: vi.fn().mockResolvedValue(true),
  getPrompt: vi.fn().mockResolvedValue({
      id: 42n,
      title: "Test prompt",
      encryptionVersion: 1,
      creator: "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
      encryptedPrompt: "encrypted",
      encryptionIv: "iv",
      wrappedKey: "wrapped",
      contentHash: "hash",
  }),
  getPurchaseDetails: vi.fn().mockResolvedValue({encryptionVersion: 1}),
  getPromptEncryptionVersion: vi.fn(),
}));
vi.mock("../../src/lib/crypto/promptCrypto", () => ({
  unwrapPromptKey: vi.fn().mockResolvedValue(Buffer.from("key")),
  decryptPromptCiphertext: vi.fn().mockResolvedValue("plaintext"),
  hashPromptPlaintext: vi.fn().mockResolvedValue("hash"),
  normalizeContentHash: (hash: string) => hash.toLowerCase(),
}));
vi.mock("../../src/lib/observability/wrapper", () => ({
  withObservability: (handler: unknown) => handler,
}));
vi.mock("../../src/lib/observability/rateLimiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../../src/lib/observability/metrics", () => ({
  metrics: {
    trackUnlockSuccess: vi.fn(),
    trackUnlockFailure: vi.fn(),
    trackRateLimitHit: vi.fn(),
  },
}));
vi.mock("../../server/src/services/auditTrail", () => ({
  recordAuditEvent: vi.fn(),
}));
vi.mock("../../server/src/services/webhookDispatcher", () => ({
  dispatchEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/lib/auth/abuseProtection", () => ({
  isAccountLocked: vi.fn().mockResolvedValue({ locked: false }),
  isCaptchaRequired: vi.fn().mockResolvedValue(false),
  recordFailedAuthAttempt: vi.fn(),
  recordSuccessfulAuth: vi.fn(),
  verifyCaptchaToken: vi.fn(),
}));

describe("unlock API - expired challenge", () => {
  it("returns 401 when the challenge token is expired", async () => {
    vi.resetModules();
    process.env.CHALLENGE_TOKEN_SECRET = "super-secret-challenge-token-secret";
    process.env.UNLOCK_PUBLIC_KEY = Buffer.from("d".repeat(32)).toString("base64");
    process.env.UNLOCK_PRIVATE_KEY = Buffer.from("e".repeat(32)).toString("base64");
    process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID = "C".repeat(56);
    process.env.PUBLIC_STELLAR_SIMULATION_ACCOUNT = "S".repeat(56);
    process.env.PUBLIC_STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
    
    // Import handler inside the test to ensure it picks up the environment variables
    const { default: handler } = await import("./unlock");

    const buyer = Keypair.random();
    const promptId = "42";
    
    // Create an expired token (expires 10 seconds ago)
    const now = Date.now();
    const expiredToken = createChallengeToken(
      process.env.CHALLENGE_TOKEN_SECRET!,
      buyer.publicKey(),
      promptId,
      now - 10000, 
      5000, // TTL of 5 seconds
    );
    // So expiresAt = (now - 10000) + 5000 = now - 5000

    const signedMessage = Buffer.from(
      buyer.sign(Buffer.from(expiredToken.challenge, "utf8")),
    ).toString("base64");

    const req = {
      method: "POST",
      headers: { "x-version": "1" },
      body: {
        token: expiredToken.token,
        promptId,
        address: buyer.publicKey(),
        signedMessage,
      },
      logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      socket: { remoteAddress: "127.0.0.1" },
    };
    
    // We can't pass 'now' to the handler, but the handler calls verifyChallengeToken(..., now=Date.now()).
    // So if the token is already expired based on Date.now(), it *should* work.
    // Let me check my token generation again.
    // expiredToken.expiresAt = now - 5000.
    // The handler uses Date.now().
    // So now - 5000 < Date.now() is true!
    // Why did it NOT expire?
    // Maybe verifyChallengeToken's `now` default parameter is not what I think?
    // Oh, I see! `now = Date.now()` is in the *function signature*. 
    // If it's called with fewer arguments, it uses `Date.now()` at the *time of call*.
    // Okay, that should be correct!
    // Why is it not expiring?
    // Let me log `payload` in `verifyChallengeToken` too!
    // Add debug for handler body
    console.log("req.body:", req.body);
    
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    await handler(req, res);
    console.log("res.status calls:", res.status.mock.calls);
    console.log("res.json calls:", res.json.mock.calls);
    // Log the logger error calls to see the error message
    console.log("logger.error calls:", req.logger.error.mock.calls);

    // Currently it returns 400, we want it to return 401
    expect(res.status).toHaveBeenCalledWith(401);

  });
});
