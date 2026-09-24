/**
 * Per-listing prompt analytics for creators.
 *
 * Conversion = purchases / views (view → purchase funnel).
 * Unlock rate = unlocks / purchases (purchase → unlock funnel).
 * Both rates are percentages in [0, 100]; a zero denominator yields 0.
 */

export interface ListingEventCounts {
  views: number;
  purchases: number;
  unlocks: number;
}

export interface ListingMetrics extends ListingEventCounts {
  conversionRate: number;
  unlockRate: number;
}

export interface ListingAnalyticsRow extends ListingMetrics {
  promptId: string;
}

/** Round to one decimal place without floating-point surprises. */
export function roundRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

export function ratePercent(numerator: number, denominator: number): number {
  const n = Math.max(0, Number(numerator) || 0);
  const d = Math.max(0, Number(denominator) || 0);
  if (d === 0) return 0;
  return roundRate((n / d) * 100);
}

export function computeListingMetrics(counts: ListingEventCounts): ListingMetrics {
  const views = Math.max(0, Math.floor(Number(counts.views) || 0));
  const purchases = Math.max(0, Math.floor(Number(counts.purchases) || 0));
  const unlocks = Math.max(0, Math.floor(Number(counts.unlocks) || 0));

  return {
    views,
    purchases,
    unlocks,
    conversionRate: ratePercent(purchases, views),
    unlockRate: ratePercent(unlocks, purchases),
  };
}

/**
 * Merge sparse event-count maps into a complete row list for every promptId.
 * Missing ids default to zero counts so the creator table always shows all listings.
 */
export function buildListingAnalyticsRows(
  promptIds: string[],
  countsByPromptId: Record<string, Partial<ListingEventCounts>>,
): ListingAnalyticsRow[] {
  return promptIds.map((promptId) => {
    const partial = countsByPromptId[promptId] ?? {};
    return {
      promptId,
      ...computeListingMetrics({
        views: partial.views ?? 0,
        purchases: partial.purchases ?? 0,
        unlocks: partial.unlocks ?? 0,
      }),
    };
  });
}

/** Format a rate for UI display (always one decimal + %). */
export function formatRate(rate: number): string {
  return `${roundRate(rate).toFixed(1)}%`;
}
