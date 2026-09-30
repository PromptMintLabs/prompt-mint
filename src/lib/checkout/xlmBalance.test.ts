import { describe, it, expect } from "vitest";
import {
  assessCheckoutXlmSufficiency,
  computeMinimumReserveStroops,
  parseHorizonNativeBalanceToStroops,
  CHECKOUT_FEE_BUFFER_STROOPS,
  DEFAULT_BASE_RESERVE_STROOPS,
} from "./xlmBalance";

describe("parseHorizonNativeBalanceToStroops", () => {
  it("parses whole and fractional native balances", () => {
    expect(parseHorizonNativeBalanceToStroops("10")).toBe(100_000_000n);
    expect(parseHorizonNativeBalanceToStroops("1.5")).toBe(15_000_000n);
    expect(parseHorizonNativeBalanceToStroops("0.0000001")).toBe(1n);
  });
});

describe("computeMinimumReserveStroops", () => {
  it("uses Stellar minimum balance formula", () => {
    const reserve = computeMinimumReserveStroops(3, 1, 0, DEFAULT_BASE_RESERVE_STROOPS);
    // (2 + 3 + 1 - 0) * 0.5 XLM = 3 XLM
    expect(reserve).toBe(30_000_000n);
  });
});

describe("assessCheckoutXlmSufficiency", () => {
  const minimumReserve = 10_000_000n; // 1 XLM reserve

  it("passes when balance covers purchase, fee buffer, and reserve", () => {
    const result = assessCheckoutXlmSufficiency({
      nativeBalanceStroops: 25_000_000n,
      minimumReserveStroops: minimumReserve,
      purchaseTotalStroops: 10_000_000n,
      feeBufferStroops: CHECKOUT_FEE_BUFFER_STROOPS,
    });

    expect(result.sufficient).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("fails when balance cannot cover cart total after reserve and fees", () => {
    const result = assessCheckoutXlmSufficiency({
      nativeBalanceStroops: 15_000_000n,
      minimumReserveStroops: minimumReserve,
      purchaseTotalStroops: 10_000_000n,
      feeBufferStroops: CHECKOUT_FEE_BUFFER_STROOPS,
    });

    expect(result.sufficient).toBe(false);
    expect(result.message).toMatch(/insufficient xlm/i);
  });

  it("fails when balance is below the account reserve", () => {
    const result = assessCheckoutXlmSufficiency({
      nativeBalanceStroops: 5_000_000n,
      minimumReserveStroops: minimumReserve,
      purchaseTotalStroops: 1_000_000n,
    });

    expect(result.sufficient).toBe(false);
    expect(result.message).toMatch(/reserve/i);
  });

  it("treats zero cart total as reserve-only check", () => {
    const funded = assessCheckoutXlmSufficiency({
      nativeBalanceStroops: 12_000_000n,
      minimumReserveStroops: minimumReserve,
      purchaseTotalStroops: 0n,
    });
    expect(funded.sufficient).toBe(true);

    const underReserve = assessCheckoutXlmSufficiency({
      nativeBalanceStroops: 9_000_000n,
      minimumReserveStroops: minimumReserve,
      purchaseTotalStroops: 0n,
    });
    expect(underReserve.sufficient).toBe(false);
  });
});
