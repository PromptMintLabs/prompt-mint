/**
 * Currency and Number Formatting Utilities
 *
 * Provides safe, locale-aware formatting for XLM, USD, percentages,
 * compact numbers, and general numeric values with complete edge-case handling.
 */

export interface FormatCurrencyOptions {
  decimals?: number;
  showSymbol?: boolean;
  fallback?: string;
  inputUnit?: "stroops" | "xlm";
}

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
  fallback?: string;
}

export interface FormatCompactOptions {
  decimals?: number;
  fallback?: string;
}

const STROOPS_PER_XLM = 10_000_000n;

/**
 * Safely converts string, number, or bigint to a number or bigint value.
 */
function parseNumericValue(
  value: number | bigint | string | null | undefined
): { num: number | null; isBigInt: boolean; rawBigInt?: bigint } {
  if (value === null || value === undefined || value === "") {
    return { num: null, isBigInt: false };
  }

  if (typeof value === "bigint") {
    return { num: Number(value), isBigInt: true, rawBigInt: value };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { num: null, isBigInt: false };
    }
    return { num: value, isBigInt: false };
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return { num: null, isBigInt: false };
  }

  // Try parsing integer for bigint representation if needed
  try {
    const parsedNum = Number(trimmed);
    if (!Number.isFinite(parsedNum)) {
      return { num: null, isBigInt: false };
    }
    return { num: parsedNum, isBigInt: false };
  } catch {
    return { num: null, isBigInt: false };
  }
}

/**
 * Converts stroops (bigint/number/string) to XLM number
 */
export function stroopsToXlmNumber(
  stroops: bigint | number | string | null | undefined
): number | null {
  if (stroops === null || stroops === undefined || stroops === "") {
    return null;
  }

  if (typeof stroops === "bigint") {
    return Number(stroops) / Number(STROOPS_PER_XLM);
  }

  const parsed = parseNumericValue(stroops);
  if (parsed.num === null) return null;
  return parsed.num / Number(STROOPS_PER_XLM);
}

/**
 * Formats a value as a currency string (default XLM).
 */
export function formatCurrency(
  amount: number | bigint | string | null | undefined,
  currency = "XLM",
  options: FormatCurrencyOptions = {}
): string {
  const { decimals = 2, showSymbol = true, fallback = "-", inputUnit } = options;

  if (currency.toUpperCase() === "XLM") {
    let xlmVal: number | null = null;
    if (inputUnit === "stroops" || typeof amount === "bigint") {
      xlmVal = stroopsToXlmNumber(amount);
    } else {
      const parsed = parseNumericValue(amount);
      xlmVal = parsed.num;
    }

    if (xlmVal === null || isNaN(xlmVal)) return fallback;

    const formatted = xlmVal.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return showSymbol ? `${formatted} XLM` : formatted;
  }

  // Standard ISO currencies (USD, EUR, GBP, etc.)
  const parsed = parseNumericValue(amount);
  if (parsed.num === null || isNaN(parsed.num)) return fallback;

  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: showSymbol ? "currency" : "decimal",
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return formatter.format(parsed.num);
  } catch {
    const formatted = parsed.num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return showSymbol ? `${currency.toUpperCase()} ${formatted}` : formatted;
  }
}

/**
 * Formats a prompt price (in stroops or XLM) into a clean string label for UI elements.
 */
export function formatPriceLabel(
  stroopsOrXlm: bigint | number | string | null | undefined,
  unit: "stroops" | "xlm" = "stroops"
): string {
  if (stroopsOrXlm === null || stroopsOrXlm === undefined || stroopsOrXlm === "") {
    return "-";
  }

  let xlmValue: number | null = null;
  if (unit === "stroops" || typeof stroopsOrXlm === "bigint") {
    xlmValue = stroopsToXlmNumber(stroopsOrXlm);
  } else {
    const parsed = parseNumericValue(stroopsOrXlm);
    xlmValue = parsed.num;
  }

  if (xlmValue === null || isNaN(xlmValue)) return "-";

  return xlmValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

/**
 * Formats XLM amount with optional unit suffix.
 */
export function formatXLM(
  amount: bigint | number | string | null | undefined,
  options: { showUnit?: boolean; decimals?: number; inputUnit?: "stroops" | "xlm" } = {}
): string {
  const { showUnit = true, decimals = 2, inputUnit = "stroops" } = options;
  return formatCurrency(amount, "XLM", {
    decimals,
    showSymbol: showUnit,
    inputUnit,
  });
}

/**
 * Formats USD amount with dollar symbol.
 */
export function formatUSD(
  amount: number | string | null | undefined,
  options: { showSymbol?: boolean; decimals?: number } = {}
): string {
  const { showSymbol = true, decimals = 2 } = options;
  return formatCurrency(amount, "USD", {
    decimals,
    showSymbol,
  });
}

/**
 * General number formatter with Intl.NumberFormat and safe fallback.
 */
export function formatNumber(
  value: number | bigint | string | null | undefined,
  options: FormatNumberOptions = {}
): string {
  const { fallback = "-", ...intlOptions } = options;
  const parsed = parseNumericValue(value);
  if (parsed.num === null || isNaN(parsed.num)) return fallback;

  try {
    return new Intl.NumberFormat("en-US", intlOptions).format(parsed.num);
  } catch {
    return parsed.num.toString();
  }
}

/**
 * Formats large numbers compactly (e.g. 1.2K, 3.4M).
 */
export function formatCompactNumber(
  value: number | bigint | string | null | undefined,
  options: FormatCompactOptions = {}
): string {
  const { decimals = 1, fallback = "-" } = options;
  const parsed = parseNumericValue(value);
  if (parsed.num === null || isNaN(parsed.num)) return fallback;

  try {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: decimals,
    }).format(parsed.num);
  } catch {
    return parsed.num.toString();
  }
}

/**
 * Formats a percentage value (e.g. 0.05 -> "5.00%" or 12.5 -> "12.50%").
 */
export function formatPercent(
  value: number | string | null | undefined,
  decimals = 2,
  options: { fallback?: string; isDecimalRatio?: boolean } = {}
): string {
  const { fallback = "-", isDecimalRatio = false } = options;
  const parsed = parseNumericValue(value);
  if (parsed.num === null || isNaN(parsed.num)) return fallback;

  const pctValue = isDecimalRatio ? parsed.num * 100 : parsed.num;
  return `${pctValue.toFixed(decimals)}%`;
}
