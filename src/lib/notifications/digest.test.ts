import { describe, expect, it } from "vitest";
import { buildDailyDigest, DAILY_DIGEST_WINDOW_MS } from "./digest";
import type { NotificationRecord } from "./store";

const NOW = 1_700_000_000_000;

function record(overrides: Partial<NotificationRecord> & { id: string }): NotificationRecord {
  return {
    message: "activity",
    type: "success",
    isRead: false,
    createdAt: NOW,
    ...overrides,
  };
}

describe("buildDailyDigest", () => {
  it("returns an empty digest for an empty list", () => {
    const digest = buildDailyDigest([], { now: NOW });
    expect(digest.total).toBe(0);
    expect(digest.unread).toBe(0);
    expect(digest.groups).toEqual([]);
    expect(digest.date).toBe(new Date(NOW).toISOString().slice(0, 10));
  });

  it("keeps only items within the exact 24h window", () => {
    const items: NotificationRecord[] = [
      record({ id: "at-cutoff", createdAt: NOW - DAILY_DIGEST_WINDOW_MS }),
      record({ id: "just-inside", createdAt: NOW - DAILY_DIGEST_WINDOW_MS + 1 }),
      record({ id: "at-now", createdAt: NOW }),
      record({ id: "too-old", createdAt: NOW - DAILY_DIGEST_WINDOW_MS - 1 }),
      record({ id: "future", createdAt: NOW + 1 }),
    ];
    const digest = buildDailyDigest(items, { now: NOW });
    const ids = digest.groups.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toHaveLength(3);
    expect(ids).toContain("at-cutoff");
    expect(ids).toContain("just-inside");
    expect(ids).toContain("at-now");
  });

  it("orders items by importance and breaks ties by recency", () => {
    const items: NotificationRecord[] = [
      record({ id: "follower", category: "follower", createdAt: NOW - 1_000 }),
      record({ id: "older", category: "purchase", createdAt: NOW - 2_000 }),
      record({ id: "newer", category: "purchase", createdAt: NOW - 1_000 }),
    ];
    const digest = buildDailyDigest(items, { now: NOW });
    const purchase = digest.groups.find((group) => group.category === "purchase");
    expect(purchase).toBeDefined();
    // Same category/type/read state and ~same age => tied scores, newer first.
    expect(purchase!.items.map((item) => item.id)).toEqual(["newer", "older"]);
    // Purchase outranks follower, so its group comes first.
    expect(digest.groups[0].category).toBe("purchase");
  });

  it("tracks read/unread totals per group and overall", () => {
    const items: NotificationRecord[] = [
      record({ id: "p1", category: "purchase", isRead: true }),
      record({ id: "p2", category: "purchase", isRead: false }),
      record({ id: "f1", category: "follower", isRead: false }),
    ];
    const digest = buildDailyDigest(items, { now: NOW });
    expect(digest.total).toBe(3);
    expect(digest.unread).toBe(2);
    const purchase = digest.groups.find((group) => group.category === "purchase");
    const follower = digest.groups.find((group) => group.category === "follower");
    expect(purchase).toMatchObject({ count: 2, unread: 1 });
    expect(follower).toMatchObject({ count: 1, unread: 1 });
  });
});
