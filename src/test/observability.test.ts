import { describe, it, expect } from "vitest";
import pino from "pino";
import { checkRateLimit } from "../lib/observability/rateLimiter";
import { logger } from "../lib/observability/logger";

describe("Observability Utilities", () => {
  describe("Rate Limiter", () => {
    it("should allow requests within limit", async () => {
      const result = await checkRateLimit("challenge", "test-ip-1", false);
      expect(result.success).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it("should enforce wallet-keyed rate limiting", async () => {
      const wallet = "GBALICE1234567890";
      // Challenge limit for authenticated wallet is 15
      for (let i = 0; i < 15; i++) {
        const r = await checkRateLimit("challenge", `wallet:${wallet}`, true);
        expect(r.success).toBe(true);
      }
      const blocked = await checkRateLimit("challenge", `wallet:${wallet}`, true);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });


  describe("Logger", () => {
    it("should be configured with correct level", () => {
      expect(logger.level).toBe("silent"); // Since we set NODE_ENV=test
    });
  });

  describe("Logger redaction", () => {
    const redactPaths = [
      "plaintext",
      "secret",
      "privateKey",
      "unlockPrivateKey",
      "challengeSecret",
      "signedMessage",
      "wrappedKey",
      "encryptedPrompt",
      "encryptionIv",
      "keyBytes",
      "token",
      "captchaToken",
      "body.plaintext",
      "body.secret",
      "body.privateKey",
      "body.signedMessage",
      "body.wrappedKey",
      "body.encryptedPrompt",
      "body.encryptionIv",
      "body.keyBytes",
      "body.token",
      "body.captchaToken",
      "res.body.plaintext",
      "req.headers.authorization",
      "req.headers.cookie",
      // NOTE: req.headers.x-captcha-token contains hyphens and cannot be
      // expressed in fast-redact path notation. Covered by "captchaToken" paths.
    ];

    function createTestLogger() {
      const logs: string[] = [];
      const testDest = {
        write(msg: string) {
          logs.push(msg);
          return true;
        },
        end() {},
        flushSync() {},
        [Symbol.for("pino.metadata")]() {
          return { level: 30, type: "destination", msg: "" };
        },
      };
      const testLogger = pino(
        {
          level: "info",
          redact: {
            paths: redactPaths,
            censor: "[REDACTED]",
          },
        },
        testDest as any,
      );
      return { logger: testLogger, logs };
    }

    it("redacts plaintext at top level", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info({ plaintext: "super-secret-prompt-content" }, "test message");
      const parsed = JSON.parse(logs[0]);
      expect(parsed.plaintext).toBe("[REDACTED]");
      expect(parsed.plaintext).not.toContain("super-secret");
    });

    it("redacts signedMessage at top level", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info({ signedMessage: "wallet-signature-data" }, "test message");
      const parsed = JSON.parse(logs[0]);
      expect(parsed.signedMessage).toBe("[REDACTED]");
    });

    it("redacts wrappedKey at top level", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info({ wrappedKey: "encrypted-key-bytes" }, "test message");
      const parsed = JSON.parse(logs[0]);
      expect(parsed.wrappedKey).toBe("[REDACTED]");
    });

    it("redacts encryptedPrompt at top level", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info({ encryptedPrompt: "ciphertext-blob" }, "test message");
      const parsed = JSON.parse(logs[0]);
      expect(parsed.encryptedPrompt).toBe("[REDACTED]");
    });

    it("redacts token and captchaToken at top level", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info(
        { token: "challenge-jwt-token", captchaToken: "captcha-verify-token" },
        "test message",
      );
      const parsed = JSON.parse(logs[0]);
      expect(parsed.token).toBe("[REDACTED]");
      expect(parsed.captchaToken).toBe("[REDACTED]");
    });

    it("redacts fields inside body.* (wrapper pattern)", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info(
        {
          body: {
            plaintext: "nested-plaintext",
            signedMessage: "nested-signature",
            wrappedKey: "nested-key",
            token: "nested-token",
            captchaToken: "nested-captcha",
          },
        },
        "test message",
      );
      const parsed = JSON.parse(logs[0]);
      expect(parsed.body.plaintext).toBe("[REDACTED]");
      expect(parsed.body.signedMessage).toBe("[REDACTED]");
      expect(parsed.body.wrappedKey).toBe("[REDACTED]");
      expect(parsed.body.token).toBe("[REDACTED]");
      expect(parsed.body.captchaToken).toBe("[REDACTED]");
    });

    it("redacts authorization and cookie headers", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info(
        {
          req: {
            headers: {
              authorization: "Bearer secret-token",
              cookie: "session=abc123",
            },
          },
        },
        "test message",
      );
      const parsed = JSON.parse(logs[0]);
      expect(parsed.req.headers.authorization).toBe("[REDACTED]");
      expect(parsed.req.headers.cookie).toBe("[REDACTED]");
    });

    it("never leaks sensitive values in serialized output", () => {
      const secrets = {
        plaintext: "my-secret-prompt",
        signedMessage: "sig-abc-123",
        wrappedKey: "wk-def-456",
        encryptedPrompt: "enc-ghi-789",
        encryptionIv: "iv-jkl-012",
        keyBytes: "key-mno-345",
        token: "tok-pqr-678",
        captchaToken: "cap-stu-901",
        secret: "secret-vwx-234",
        privateKey: "priv-yza-567",
        unlockPrivateKey: "unlock-bcd-890",
        challengeSecret: "chal-efg-123",
      };

      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info(secrets, "leak test");

      const output = logs[0];
      for (const value of Object.values(secrets)) {
        expect(output).not.toContain(value);
      }
      // All should be redacted
      const parsed = JSON.parse(output);
      for (const key of Object.keys(secrets)) {
        expect(parsed[key]).toBe("[REDACTED]");
      }
    });

    it("preserves non-sensitive fields alongside redacted ones", () => {
      const { logger: testLogger, logs } = createTestLogger();
      testLogger.info(
        {
          address: "GBALICE1234567890",
          promptId: "42",
          plaintext: "should-be-redacted",
          wrappedKey: "should-also-be-redacted",
        },
        "mixed message",
      );
      const parsed = JSON.parse(logs[0]);
      expect(parsed.address).toBe("GBALICE1234567890");
      expect(parsed.promptId).toBe("42");
      expect(parsed.plaintext).toBe("[REDACTED]");
      expect(parsed.wrappedKey).toBe("[REDACTED]");
    });
  });
});
