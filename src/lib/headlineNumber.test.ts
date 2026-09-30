import { describe, it, expect } from "vitest";
import { formatHeadlineNumber, getHeadlineNumber } from "./formatters";

// Pin locale to "en-US" so results are deterministic on any machine.
const en = { locale: "en-US" };

describe("formatHeadlineNumber", () => {
  it("keeps small numbers in full with grouping", () => {
    expect(formatHeadlineNumber(0, en)).toBe("0");
    expect(formatHeadlineNumber(42, en)).toBe("42");
    expect(formatHeadlineNumber(9_999, en)).toBe("9,999");
  });

  it("abbreviates numbers at or above the threshold", () => {
    expect(formatHeadlineNumber(10_000, en)).toBe("10K");
    expect(formatHeadlineNumber(12_345, en)).toBe("12.3K");
    expect(formatHeadlineNumber(1_234_567, en)).toBe("1.2M");
    expect(formatHeadlineNumber(4_500_000_000, en)).toBe("4.5B");
    expect(formatHeadlineNumber(1_200_000_000_000, en)).toBe("1.2T");
  });

  it("rolls over to the next magnitude when rounding", () => {
    expect(formatHeadlineNumber(999_950, en)).toBe("1M");
  });

  it("handles negative values", () => {
    expect(formatHeadlineNumber(-2_500_000, en)).toBe("-2.5M");
    expect(formatHeadlineNumber(-500, en)).toBe("-500");
  });

  it("accepts bigint and numeric strings", () => {
    expect(formatHeadlineNumber(3_000_000n, en)).toBe("3M");
    expect(formatHeadlineNumber("15000", en)).toBe("15K");
  });

  it("supports a custom threshold and fraction digits", () => {
    expect(
      formatHeadlineNumber(1_500, { ...en, compactThreshold: 1_000 }),
    ).toBe("1.5K");
    expect(
      formatHeadlineNumber(1_234_567, { ...en, maxFractionDigits: 2 }),
    ).toBe("1.23M");
    expect(formatHeadlineNumber(12.345, { ...en, maxFractionDigits: 2 })).toBe(
      "12.35",
    );
  });

  it("appends a unit", () => {
    expect(formatHeadlineNumber(2_500_000, { ...en, unit: "XLM" })).toBe(
      "2.5M XLM",
    );
  });

  it("respects the locale", () => {
    expect(formatHeadlineNumber(9_999, { locale: "de-DE" })).toBe("9.999");
    expect(formatHeadlineNumber(1_500_000, { locale: "de-DE" })).toMatch(
      /^1,5\s?Mio\.$/,
    );
  });

  it("returns the fallback for invalid input", () => {
    expect(formatHeadlineNumber(null, en)).toBe("-");
    expect(formatHeadlineNumber(undefined, en)).toBe("-");
    expect(formatHeadlineNumber("", en)).toBe("-");
    expect(formatHeadlineNumber("abc", en)).toBe("-");
    expect(formatHeadlineNumber(Number.NaN, en)).toBe("-");
    expect(formatHeadlineNumber(Infinity, { ...en, fallback: "—" })).toBe("—");
  });
});

describe("getHeadlineNumber", () => {
  it("returns compact text alongside the full value", () => {
    expect(getHeadlineNumber(1_234_567, en)).toEqual({
      text: "1.2M",
      fullText: "1,234,567",
      isCompact: true,
    });
  });

  it("marks small numbers as not compact", () => {
    expect(getHeadlineNumber(512, en)).toEqual({
      text: "512",
      fullText: "512",
      isCompact: false,
    });
  });

  it("keeps full bigint precision beyond Number.MAX_SAFE_INTEGER", () => {
    const result = getHeadlineNumber(9_007_199_254_740_993n, en);
    expect(result.fullText).toBe("9,007,199,254,740,993");
    expect(result.text).toBe("9007.2T");
  });
});
