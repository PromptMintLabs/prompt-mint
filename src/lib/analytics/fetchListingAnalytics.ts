import type { ListingAnalyticsRow } from "./listingMetrics";

/**
 * Fetch per-listing views / conversion / unlock rates for the creator dashboard.
 * Returns an empty map on network failure so the UI can still render sales data.
 */
export async function fetchListingAnalytics(
  promptIds: string[],
): Promise<Record<string, ListingAnalyticsRow>> {
  const ids = Array.from(new Set(promptIds.map(String).filter(Boolean)));
  if (ids.length === 0) return {};

  try {
    const params = new URLSearchParams({ ids: ids.join(",") });
    const res = await fetch(`/api/analytics/listings?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { listings?: ListingAnalyticsRow[] };
    const map: Record<string, ListingAnalyticsRow> = {};
    for (const row of body.listings ?? []) {
      if (row?.promptId) map[row.promptId] = row;
    }
    return map;
  } catch {
    return {};
  }
}
