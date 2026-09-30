import { describe, expect, it } from "vitest";
import {
  buildListingAnalyticsRows,
  computeListingMetrics,
  formatRate,
  ratePercent,
  roundRate,
} from "./listingMetrics";

describe("roundRate / ratePercent", () => {
  it("rounds to one decimal place", () => {
    expect(roundRate(12.34)).toBe(12.3);
    expect(roundRate(12.35)).toBe(12.4);
  });

  it("returns 0 for empty denominators and non-finite inputs", () => {
    expect(ratePercent(5, 0)).toBe(0);
    expect(ratePercent(0, 0)).toBe(0);
    expect(ratePercent(Number.NaN, 10)).toBe(0);
  });

  it("computes a percentage of numerator/denominator", () => {
    expect(ratePercent(1, 4)).toBe(25);
    expect(ratePercent(3, 10)).toBe(30);
  });
});

describe("computeListingMetrics", () => {
  it("derives conversion (purchases/views) and unlock (unlocks/purchases) rates", () => {
    const metrics = computeListingMetrics({ views: 100, purchases: 25, unlocks: 20 });
    expect(metrics).toEqual({
      views: 100,
      purchases: 25,
      unlocks: 20,
      conversionRate: 25,
      unlockRate: 80,
    });
  });

  it("clamps negative / fractional junk to non-negative integers", () => {
    const metrics = computeListingMetrics({
      views: -3.7 as unknown as number,
      purchases: 2.9 as unknown as number,
      unlocks: -1 as unknown as number,
    });
    expect(metrics.views).toBe(0);
    expect(metrics.purchases).toBe(2);
    expect(metrics.unlocks).toBe(0);
    expect(metrics.conversionRate).toBe(0);
    expect(metrics.unlockRate).toBe(0);
  });

  it("returns zero rates when there are views but no purchases", () => {
    const metrics = computeListingMetrics({ views: 50, purchases: 0, unlocks: 0 });
    expect(metrics.conversionRate).toBe(0);
    expect(metrics.unlockRate).toBe(0);
  });
});

describe("buildListingAnalyticsRows", () => {
  it("includes every requested promptId with zero defaults for missing counts", () => {
    const rows = buildListingAnalyticsRows(["1", "2"], {
      "1": { views: 10, purchases: 2, unlocks: 1 },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      promptId: "1",
      views: 10,
      purchases: 2,
      unlocks: 1,
      conversionRate: 20,
      unlockRate: 50,
    });
    expect(rows[1]).toMatchObject({
      promptId: "2",
      views: 0,
      purchases: 0,
      unlocks: 0,
      conversionRate: 0,
      unlockRate: 0,
    });
  });
});

describe("formatRate", () => {
  it("formats with a single decimal and percent sign", () => {
    expect(formatRate(12)).toBe("12.0%");
    expect(formatRate(33.333)).toBe("33.3%");
  });
});
