// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import {
  isAccountLocked,
  isCaptchaRequired,
  recordFailedAuthAttempt,
  recordSuccessfulAuth,
  resetAbuseProtectionState,
  unlockAccount,
  verifyCaptchaToken,
} from "./abuseProtection";

describe("abuseProtection service", () => {
  beforeEach(() => {
    resetAbuseProtectionState();
  });

  describe("account lockout after 5 failed attempts", () => {
    const testWallet = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFDAGORAcTESTACCOUNT1";

    it("does not lock account on fewer than 5 failures", async () => {
      for (let i = 1; i <= 4; i++) {
        const result = await recordFailedAuthAttempt(testWallet);
        expect(result.attempts).toBe(i);
        expect(result.locked).toBe(false);
      }

      const status = await isAccountLocked(testWallet);
      expect(status.locked).toBe(false);
    });

    it("locks account upon the 5th failed auth attempt", async () => {
      for (let i = 1; i <= 4; i++) {
        await recordFailedAuthAttempt(testWallet);
      }

      const result = await recordFailedAuthAttempt(testWallet);
      expect(result.attempts).toBe(5);
      expect(result.locked).toBe(true);
      expect(result.lockedUntil).toBeGreaterThan(Date.now());

      const status = await isAccountLocked(testWallet);
      expect(status.locked).toBe(true);
      expect(status.lockedUntil).toBe(result.lockedUntil);
      expect(status.remainingMs).toBeGreaterThan(0);
    });

    it("resets failure counter and unlocks account upon successful auth", async () => {
      for (let i = 1; i <= 5; i++) {
        await recordFailedAuthAttempt(testWallet);
      }
      expect((await isAccountLocked(testWallet)).locked).toBe(true);

      await recordSuccessfulAuth(testWallet);

      const status = await isAccountLocked(testWallet);
      expect(status.locked).toBe(false);
    });

    it("unlocks account via unlockAccount helper", async () => {
      for (let i = 1; i <= 5; i++) {
        await recordFailedAuthAttempt(testWallet);
      }
      expect((await isAccountLocked(testWallet)).locked).toBe(true);

      await unlockAccount(testWallet);
      expect((await isAccountLocked(testWallet)).locked).toBe(false);
    });
  });

  describe("CAPTCHA requirement for repeated failures", () => {
    const testWallet = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFDAGORAcTESTACCOUNT2";
    const testIp = "192.168.1.50";

    it("does not require CAPTCHA before 3 failures", async () => {
      await recordFailedAuthAttempt(testWallet, testIp);
      await recordFailedAuthAttempt(testWallet, testIp);

      expect(await isCaptchaRequired(testWallet, testIp)).toBe(false);
    });

    it("requires CAPTCHA after 3 repeated failures", async () => {
      for (let i = 0; i < 3; i++) {
        await recordFailedAuthAttempt(testWallet, testIp);
      }

      expect(await isCaptchaRequired(testWallet, testIp)).toBe(true);
      expect(await isCaptchaRequired(testWallet)).toBe(true);
      expect(await isCaptchaRequired(undefined, testIp)).toBe(true);
    });

    it("clears CAPTCHA requirement upon successful auth", async () => {
      for (let i = 0; i < 3; i++) {
        await recordFailedAuthAttempt(testWallet, testIp);
      }
      expect(await isCaptchaRequired(testWallet, testIp)).toBe(true);

      await recordSuccessfulAuth(testWallet, testIp);
      expect(await isCaptchaRequired(testWallet, testIp)).toBe(false);
    });
  });

  describe("CAPTCHA token verification", () => {
    it("rejects missing or empty tokens", async () => {
      expect((await verifyCaptchaToken(undefined)).valid).toBe(false);
      expect((await verifyCaptchaToken("")).valid).toBe(false);
      expect((await verifyCaptchaToken("   ")).valid).toBe(false);
    });

    it("accepts valid test bypass tokens", async () => {
      expect((await verifyCaptchaToken("test-captcha-token-valid")).valid).toBe(true);
      expect((await verifyCaptchaToken("valid-captcha-abc123456")).valid).toBe(true);
      expect((await verifyCaptchaToken("mock-valid-captcha")).valid).toBe(true);
    });

    it("rejects invalid test tokens", async () => {
      expect((await verifyCaptchaToken("test-captcha-token-invalid")).valid).toBe(false);
      expect((await verifyCaptchaToken("invalid")).valid).toBe(false);
      expect((await verifyCaptchaToken("invalid-captcha-test")).valid).toBe(false);
    });

    it("validates token length in test environment when no secret is configured", async () => {
      expect((await verifyCaptchaToken("valid-token-with-sufficient-length")).valid).toBe(true);
      expect((await verifyCaptchaToken("short")).valid).toBe(false);
    });
  });
});
