import { AnalyticsEvent } from "../models/AnalyticsEvent";

export interface ListingAnalyticsRow {
  promptId: string;
  views: number;
  purchases: number;
  unlocks: number;
  /** purchases / views * 100 */
  conversionRate: number;
  /** unlocks / purchases * 100 */
  unlockRate: number;
}

interface ListingEventCounts {
  views: number;
  purchases: number;
  unlocks: number;
}

const LISTING_EVENTS = [
  "prompt_viewed",
  "prompt_purchase_completed",
  "prompt_unlocked",
] as const;

const EVENT_TO_FIELD: Record<(typeof LISTING_EVENTS)[number], keyof ListingEventCounts> = {
  prompt_viewed: "views",
  prompt_purchase_completed: "purchases",
  prompt_unlocked: "unlocks",
};

export const MAX_PROMPT_IDS = 100;

function roundRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

function ratePercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return roundRate((numerator / denominator) * 100);
}

function toMetrics(promptId: string, counts: ListingEventCounts): ListingAnalyticsRow {
  const views = Math.max(0, Math.floor(counts.views || 0));
  const purchases = Math.max(0, Math.floor(counts.purchases || 0));
  const unlocks = Math.max(0, Math.floor(counts.unlocks || 0));
  return {
    promptId,
    views,
    purchases,
    unlocks,
    conversionRate: ratePercent(purchases, views),
    unlockRate: ratePercent(unlocks, purchases),
  };
}

/**
 * Aggregate privacy-safe analytics events into per-listing view / purchase /
 * unlock counts, then derive conversion and unlock rates for creators.
 *
 * `promptIds` are the on-chain listing ids used when the browser fires
 * `prompt_viewed` / `prompt_purchase_completed` / `prompt_unlocked`.
 */
export async function getListingAnalyticsForPromptIds(
  promptIds: string[],
): Promise<ListingAnalyticsRow[]> {
  const uniqueIds = Array.from(
    new Set(
      promptIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0 && id.length <= 64),
    ),
  ).slice(0, MAX_PROMPT_IDS);

  if (uniqueIds.length === 0) {
    return [];
  }

  const buckets = await AnalyticsEvent.aggregate<{
    _id: { promptId: string; event: string };
    count: number;
  }>([
    {
      $match: {
        promptId: { $in: uniqueIds },
        event: { $in: [...LISTING_EVENTS] },
      },
    },
    {
      $group: {
        _id: { promptId: "$promptId", event: "$event" },
        count: { $sum: 1 },
      },
    },
  ]);

  const countsByPromptId: Record<string, ListingEventCounts> = {};
  for (const id of uniqueIds) {
    countsByPromptId[id] = { views: 0, purchases: 0, unlocks: 0 };
  }

  for (const bucket of buckets) {
    const promptId = String(bucket._id?.promptId ?? "");
    const event = bucket._id?.event as (typeof LISTING_EVENTS)[number] | undefined;
    if (!promptId || !event || !(event in EVENT_TO_FIELD)) continue;
    const entry = countsByPromptId[promptId];
    if (!entry) continue;
    const field = EVENT_TO_FIELD[event];
    entry[field] += Number(bucket.count ?? 0);
  }

  return uniqueIds.map((id) => toMetrics(id, countsByPromptId[id]));
}

export { LISTING_EVENTS };
