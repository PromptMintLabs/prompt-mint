import {
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
}

/**
 * Converts an XLM decimal value to stroops without floating-point rounding.
 */
export function xlmToStroops(xlm: number | string): bigint {
  return BigInt(Math.round(Number(xlm) * 10_000_000));
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
  formatCurrency,
  formatXLM,
  formatUSD,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  stroopsToXlmNumber,
};
