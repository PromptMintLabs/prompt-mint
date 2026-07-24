import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPriceLabel,
  formatXLM,
  formatUSD,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  stroopsToXlmNumber,
} from "./formatters";

describe("Currency & Number Formatting Utilities", () => {
  describe("stroopsToXlmNumber", () => {
    it("converts bigint stroops to XLM number accurately", () => {
      expect(stroopsToXlmNumber(10_000_000n)).toBe(1);
      expect(stroopsToXlmNumber(25_000_000n)).toBe(2.5);
    });

    it("returns null for invalid inputs", () => {
      expect(stroopsToXlmNumber(null)).toBeNull();
      expect(stroopsToXlmNumber(undefined)).toBeNull();
      expect(stroopsToXlmNumber("")).toBeNull();
    });
  });

  describe("formatCurrency", () => {
    it("formats XLM currency with default symbol", () => {
      expect(formatCurrency(10.5, "XLM")).toBe("10.50 XLM");
    });

    it("formats XLM currency from stroops bigint when specified", () => {
      expect(formatCurrency(100_000_000n, "XLM", { inputUnit: "stroops" })).toBe("10.00 XLM");
    });

    it("formats USD currency with dollar symbol", () => {
      expect(formatCurrency(49.99, "USD")).toBe("$49.99");
    });

    it("handles null, undefined, and NaN with fallback", () => {
      expect(formatCurrency(null)).toBe("-");
      expect(formatCurrency(undefined, "USD", { fallback: "N/A" })).toBe("N/A");
      expect(formatCurrency(NaN, "XLM")).toBe("-");
    });
  });

  describe("formatPriceLabel", () => {
    it("formats stroops bigint to XLM decimal string", () => {
      expect(formatPriceLabel(50_000_000n)).toBe("5.00");
    });

    it("formats string stroops", () => {
      expect(formatPriceLabel("10000000")).toBe("1.00");
    });

    it("handles zero and fallback for empty input", () => {
      expect(formatPriceLabel(0n)).toBe("0.00");
      expect(formatPriceLabel(null)).toBe("-");
    });
  });

  describe("formatXLM", () => {
    it("formats XLM with default unit suffix", () => {
      expect(formatXLM(20_000_000n)).toBe("2.00 XLM");
    });

    it("formats XLM without unit when requested", () => {
      expect(formatXLM(20_000_000n, { showUnit: false })).toBe("2.00");
    });
  });

  describe("formatUSD", () => {
    it("formats USD amount", () => {
      expect(formatUSD(123.45)).toBe("$123.45");
    });
  });

  describe("formatNumber", () => {
    it("formats general numbers with locale grouping", () => {
      expect(formatNumber(1000000)).toBe("1,000,000");
    });

    it("returns fallback on invalid number", () => {
      expect(formatNumber(null)).toBe("-");
    });
  });

  describe("formatCompactNumber", () => {
    it("formats thousands and millions compactly", () => {
      expect(formatCompactNumber(1500)).toBe("1.5K");
      expect(formatCompactNumber(2500000)).toBe("2.5M");
    });

    it("returns fallback on invalid values", () => {
      expect(formatCompactNumber(undefined)).toBe("-");
    });
  });

  describe("formatPercent", () => {
    it("formats numbers as percentage strings", () => {
      expect(formatPercent(12.5)).toBe("12.50%");
      expect(formatPercent(0.05, 2, { isDecimalRatio: true })).toBe("5.00%");
    });

    it("returns fallback for invalid input", () => {
      expect(formatPercent(null)).toBe("-");
    });
  });
});
