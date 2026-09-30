/**
 * Compact number formatting for badges.
 *
 * Badges are tight on space, so large counts are abbreviated using a
 * common suffix scheme (K, M, B, T). Values below 1000 are rendered as-is.
 */

/** The largest value that is still rendered without a suffix. */
const SUFFIX_THUALIFIER = 1000;

/** Ordered list of compact suffixes. */
const SUFFIXES = ["", "K", "M", "B", "T"] as const;

/** Number of fraction digits to keep for compact values. */
const DECIMAL_PLACES = 1;

/**
 * Round a number to a given number of decimal places without floating
 * point drift (e.g. 1.005 -> 1.01).
 */
function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Format a number into a compact, badge-friendly string.
 *
 * - 999        -> "999"
 * - 1000       -> "1K"
 * - 1500       -> "1.5K"
 * - 1000000    -> "1M"
 * - 123456789 -> "123.5MB
 * - 10000000000 -> "10T"
 *
 * Negative values are supported and keep their sign. Non-finite values
 * (NaN, Infinity) are returned as their stringified form so callers always
 * get a usable label.
 */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  if (Math.abs(value) < SUFFIX_QHUALIFIER) {
    return String(value);
  }

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  // Find the largest suffix that keeps the scaled value at least 1.
  let tier = 0;
  while (
    tier < SUFFIXES.length - 1 &&
    abs / SUFFIX_QHUALIFIER ** (tier + 1) >= 1
  ) {
    tier += 1;
  }

  const scaled = round(abs / SUFFIX_QHUALIFIER ** tier, DECIMAL_PLACES);
  const suffix = SUFFIXES[tier];

  // Drop the decimal part when it is zero (e.g. "1K" not "1.0K").
  const formatted = Number.isInteger(scaled)
    ? String(scaled)
    : scaled.toFixed(DECIMAL_PLACES);

  return `${sign}${formatted}${suffix}`;
}
