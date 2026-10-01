import { describe, it, expect, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  detectMinimumBalance,
  evaluateMinimumBalance,
} from "@/lib/wallet/minimumBalance";

const ADDRESS = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 5)).publicKey();
const XLM = 10_000_000n;

/** Minimal account snapshot: a base account (2 entries) holds 1 XLM reserve. */
const snapshot =
  (xlm: bigint, reserve = XLM) =>
  async () => ({
    nativeBalanceStroops: xlm,
    minimumReserveStroops: reserve,
    subentryCount: 0,
  });

describe("evaluateMinimumBalance", () => {
  it("reports ok when the balance covers the reserve", () => {
    expect(
      evaluateMinimumBalance({
        nativeBalanceStroops: 3n * XLM,
        minimumReserveStroops: XLM,
      }),
    ).toEqual({
      status: "ok",
      nativeBalanceStroops: 3n * XLM,
      minimumReserveStroops: XLM,
      shortfallStroops: 0n,
    });
  });

  it("treats a balance exactly equal to the reserve as sufficient", () => {
    expect(
      evaluateMinimumBalance({
        nativeBalanceStroops: XLM,
        minimumReserveStroops: XLM,
      }).status,
    ).toBe("ok");
  });

  it("reports the shortfall when the balance is below the reserve", () => {
    expect(
      evaluateMinimumBalance({
        nativeBalanceStroops: 2_500_000n,
        minimumReserveStroops: XLM,
      }),
    ).toEqual({
      status: "below-reserve",
      nativeBalanceStroops: 2_500_000n,
      minimumReserveStroops: XLM,
      shortfallStroops: 7_500_000n,
    });
  });

  it("flags an empty wallet as below reserve", () => {
    expect(
      evaluateMinimumBalance({
        nativeBalanceStroops: 0n,
        minimumReserveStroops: XLM,
      }).status,
    ).toBe("below-reserve");
  });
});

describe("detectMinimumBalance", () => {
  it("passes the address through to the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      nativeBalanceStroops: 5n * XLM,
      minimumReserveStroops: XLM,
      subentryCount: 0,
    });

    const result = await detectMinimumBalance(ADDRESS, fetcher);

    expect(fetcher).toHaveBeenCalledWith(ADDRESS);
    expect(result.status).toBe("ok");
  });

  it("reports below-reserve when the account dips under the reserve", async () => {
    const result = await detectMinimumBalance(ADDRESS, snapshot(1_000_000n));

    expect(result.status).toBe("below-reserve");
    expect(result.shortfallStroops).toBe(9_000_000n);
  });

  it("reports an unfunded account instead of a transport error", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not Found"), { response: { status: 404 } }),
      );

    const result = await detectMinimumBalance(ADDRESS, fetcher);

    expect(result.status).toBe("unfunded");
    expect(result.nativeBalanceStroops).toBe(0n);
  });

  it("propagates lookup failures so they are not shown as a low balance", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(detectMinimumBalance(ADDRESS, fetcher)).rejects.toThrow(
      "network down",
    );
  });
});
