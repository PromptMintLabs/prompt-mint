// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import {
  checkUnlockReplayProtection,
  resetReplayProtectionState,
} from "./replayProtection";

describe("unlock replay protection", () => {
  beforeEach(() => {
    resetReplayProtectionState();
  });

  it("accepts the first use of a challenge nonce", async () => {
    const result = await checkUnlockReplayProtection(
      {
        nonce: "nonce-abc",
        expiresAt: 1_700_000_300_000,
        address: "GBUYER123",
      },
      {},
      1_700_000_000_000,
    );

    expect(result).toEqual({ valid: true });
  });

  it("rejects replay of the same nonce for the same wallet", async () => {
    const input = {
      nonce: "nonce-replay",
      expiresAt: 1_700_000_300_000,
      address: "GBUYER123",
      token: "token-value",
      signedMessage: "signed-value",
    };

    expect(await checkUnlockReplayProtection(input, {}, 1_700_000_000_000)).toEqual({
      valid: true,
    });

    expect(await checkUnlockReplayProtection(input, {}, 1_700_000_000_000)).toEqual({
      valid: false,
      reason: "nonce_reused",
    });
  });

  it("allows the same nonce for a different wallet address", async () => {
    const expiresAt = 1_700_000_300_000;
    const now = 1_700_000_000_000;

    expect(
      await checkUnlockReplayProtection(
        { nonce: "shared-nonce", expiresAt, address: "GBUYER_A" },
        {},
        now,
      ),
    ).toEqual({ valid: true });

    expect(
      await checkUnlockReplayProtection(
        { nonce: "shared-nonce", expiresAt, address: "GBUYER_B" },
        {},
        now,
      ),
    ).toEqual({ valid: true });
  });

  it("rejects expired challenges before reserving the nonce", async () => {
    const result = await checkUnlockReplayProtection(
      {
        nonce: "expired-nonce",
        expiresAt: 1_700_000_000_000,
        address: "GBUYER123",
      },
      {},
      1_700_000_100_000,
    );

    expect(result).toEqual({ valid: false, reason: "challenge_expired" });
  });
});
