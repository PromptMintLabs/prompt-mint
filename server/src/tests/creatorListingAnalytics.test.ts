/**
 * Tests for per-listing creator analytics aggregation (issue #502).
 */

jest.mock("../models/AnalyticsEvent", () => {
  const mockAggregate = jest.fn();
  return {
    AnalyticsEvent: {
      aggregate: mockAggregate,
    },
  };
});

import { AnalyticsEvent } from "../models/AnalyticsEvent";
import { getListingAnalyticsForPromptIds } from "../services/creatorListingAnalytics";

const mockAggregate = AnalyticsEvent.aggregate as jest.MockedFunction<
  typeof AnalyticsEvent.aggregate
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getListingAnalyticsForPromptIds", () => {
  it("returns an empty array when no prompt ids are provided", async () => {
    const rows = await getListingAnalyticsForPromptIds([]);
    expect(rows).toEqual([]);
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it("aggregates views, purchases, and unlocks into conversion + unlock rates", async () => {
    mockAggregate.mockResolvedValueOnce([
      { _id: { promptId: "10", event: "prompt_viewed" }, count: 100 },
      { _id: { promptId: "10", event: "prompt_purchase_completed" }, count: 25 },
      { _id: { promptId: "10", event: "prompt_unlocked" }, count: 20 },
      { _id: { promptId: "11", event: "prompt_viewed" }, count: 40 },
    ] as never);

    const rows = await getListingAnalyticsForPromptIds(["10", "11", "12"]);

    expect(mockAggregate).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      {
        promptId: "10",
        views: 100,
        purchases: 25,
        unlocks: 20,
        conversionRate: 25,
        unlockRate: 80,
      },
      {
        promptId: "11",
        views: 40,
        purchases: 0,
        unlocks: 0,
        conversionRate: 0,
        unlockRate: 0,
      },
      {
        promptId: "12",
        views: 0,
        purchases: 0,
        unlocks: 0,
        conversionRate: 0,
        unlockRate: 0,
      },
    ]);
  });

  it("dedupes and caps prompt ids", async () => {
    mockAggregate.mockResolvedValueOnce([] as never);
    const ids = Array.from({ length: 120 }, (_, i) => String(i));
    ids.push("1", "2"); // duplicates

    await getListingAnalyticsForPromptIds(ids);

    const match = (mockAggregate.mock.calls[0][0] as Array<Record<string, unknown>>)[0] as {
      $match: { promptId: { $in: string[] } };
    };
    expect(match.$match.promptId.$in).toHaveLength(100);
    expect(new Set(match.$match.promptId.$in).size).toBe(100);
  });
});
