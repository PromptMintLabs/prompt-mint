import { describe, it, expect } from "vitest";
import {
  estimateSingleFee,
  estimateBulkFee,
  estimateMultiItemPurchase,
  formatFeeEstimate,
} from "@/lib/checkout/feeEstimation";

describe("feeEstimation", () => {
  describe("estimateSingleFee", () => {
    it("returns a fee estimate with expected shape", async () => {
      const fee = await estimateSingleFee();
      expect(fee).toHaveProperty("baseFeeStroops");
      expect(fee).toHaveProperty("resourceFeeStroops");
      expect(fee).toHaveProperty("totalFeeStroops");
      expect(fee).toHaveProperty("totalFeeXlm");
    });

    it("returns a positive total fee", async () => {
      const fee = await estimateSingleFee();
      expect(fee.totalFeeStroops).toBeGreaterThan(0);
    });

    it("returns totalFeeXlm as a string representing the stroops value", async () => {
      const fee = await estimateSingleFee();
      const parsed = parseFloat(fee.totalFeeXlm);
      expect(Number.isFinite(parsed)).toBe(true);
      expect(parsed).toBeGreaterThan(0);
    });
  });

  describe("estimateBulkFee", () => {
    it("scales with item count", async () => {
      const single = await estimateBulkFee(1);
      const triple = await estimateBulkFee(3);
      expect(triple.totalFeeStroops).toBeGreaterThan(single.totalFeeStroops);
    });

    it("returns zero fee for zero items", async () => {
      const fee = await estimateBulkFee(0);
      expect(fee.totalFeeStroops).toBe(0);
      expect(fee.totalFeeXlm).toBe("0.0000000");
    });
  });

  describe("estimateMultiItemPurchase", () => {
    const items = [
      { promptId: "1", priceStroops: 50_000_000n },
      { promptId: "2", priceStroops: 120_000_000n },
      { promptId: "3", priceStroops: 7n },
    ];

    it("sums item prices into the subtotal", () => {
      const estimate = estimateMultiItemPurchase(items);
      expect(estimate.itemCount).toBe(3);
      expect(estimate.subtotalStroops).toBe(170_000_007n);
    });

    it("adds the bulk network fee to the grand total", () => {
      const estimate = estimateMultiItemPurchase(items);
      expect(estimate.networkFee.totalFeeStroops).toBe(2_600);
      expect(estimate.totalStroops).toBe(170_000_007n + 2_600n);
    });

    it("pays the base fee once for the whole cart", () => {
      const estimate = estimateMultiItemPurchase(items);
      expect(estimate.networkFee.baseFeeStroops).toBe(100);
      expect(estimate.networkFee.resourceFeeStroops).toBe(1_000 + 500 * 3);
    });

    it("matches the single-item fee for a one-item cart", async () => {
      const single = await estimateSingleFee();
      const estimate = estimateMultiItemPurchase([items[0]]);
      expect(estimate.networkFee).toEqual(single);
      expect(estimate.savingsStroops).toBe(0);
    });

    it("reports savings versus buying each item separately", () => {
      const estimate = estimateMultiItemPurchase(items);
      expect(estimate.individualFeeStroops).toBe(1_600 * 3);
      expect(estimate.savingsStroops).toBe(1_600 * 3 - 2_600);
    });

    it("rounds the per-item fee share up", () => {
      const estimate = estimateMultiItemPurchase(items);
      expect(estimate.perItemFeeStroops).toBe(Math.ceil(2_600 / 3));
    });

    it("returns zeros for an empty cart", () => {
      const estimate = estimateMultiItemPurchase([]);
      expect(estimate.subtotalStroops).toBe(0n);
      expect(estimate.totalStroops).toBe(0n);
      expect(estimate.networkFee.totalFeeStroops).toBe(0);
      expect(estimate.perItemFeeStroops).toBe(0);
      expect(estimate.savingsStroops).toBe(0);
    });

    it("keeps bigint precision for very large subtotals", () => {
      const huge = 9_007_199_254_740_993n; // > Number.MAX_SAFE_INTEGER
      const estimate = estimateMultiItemPurchase([
        { promptId: "big", priceStroops: huge },
      ]);
      expect(estimate.totalStroops).toBe(huge + 1_600n);
    });

    it("honours custom fee options", () => {
      const estimate = estimateMultiItemPurchase(items, {
        baseFeeStroops: 200,
        resourceFeeOverheadStroops: 0,
        resourceFeePerItemStroops: 1_000,
      });
      expect(estimate.networkFee.totalFeeStroops).toBe(200 + 3_000);
    });

    it("rejects negative prices", () => {
      expect(() =>
        estimateMultiItemPurchase([{ promptId: "bad", priceStroops: -1n }]),
      ).toThrow(RangeError);
    });
  });

  describe("formatFeeEstimate", () => {
    it("formats a fee estimate as a human-readable string", async () => {
      const fee = await estimateSingleFee();
      const formatted = formatFeeEstimate(fee);
      expect(formatted).toContain("XLM");
      expect(formatted).toMatch(/^~\d/);
    });
  });
});
