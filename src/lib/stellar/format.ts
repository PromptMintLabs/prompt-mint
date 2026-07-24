import {
  formatPriceLabel,
  formatCurrency,
  formatXLM,
  formatUSD,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  stroopsToXlmNumber,
} from "../formatters";

/**
 * Converts stroops (smallest unit) to XLM string
 * 1 XLM = 10,000,000 stroops
 */
export function stroopsToXlmString(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return xlm.toLocaleString("en-US", { maximumFractionDigits: 7 });
}

export function formatPriceLabel(value: bigint | number): string {
  const xlm = typeof value === "bigint"
    ? stroopsToXlmString(value)
    : value.toLocaleString("en-US", { maximumFractionDigits: 7 });
  return `${xlm} XLM`;
  const negative = stroops < 0n;
  const absolute = negative ? -stroops : stroops;
  const whole = absolute / 10_000_000n;
  const fraction = (absolute % 10_000_000n)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Converts an XLM decimal value to stroops without floating-point rounding.
 */
export function xlmToStroops(xlm: number | string): bigint {
  return BigInt(Math.round(Number(xlm) * 10_000_000));
  const value = String(xlm).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) {
    throw new Error("Enter a valid XLM amount with up to 7 decimal places.");
  }

  const [, sign, whole, fraction = ""] = match;
  const stroops = BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));
  return sign === "-" ? -stroops : stroops;
}

/**
 * Formats an address for display (truncated)
 */
export function formatAddress(address: string, prefixLength = 8, suffixLength = 4): string {
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

export {
  formatPriceLabel,
  formatCurrency,
  formatXLM,
  formatUSD,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  stroopsToXlmNumber,
};
