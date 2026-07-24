import { describe, it, expect } from "vitest";
import {
  DEFAULT_MARKETPLACE_STALE_TIME_MS,
  DEFAULT_MARKETPLACE_MAX_STALE_AGE_MS,
  getMarketplaceReadCacheState,
  readMarketplaceReadCache,
  writeMarketplaceReadCache,
  type MarketplaceReadCacheEntry,
} from "./marketplaceReadCache";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe("marketplace read cache", () => {
  it("persists and returns cached marketplace prompts", () => {
    const storage = createStorage();
    const prompt = {
      id: 7n,
      creator: "GTEST",
      priceStroops: 10_000_000n,
      title: "Cached prompt",
      category: "Testing",
      previewText: "Preview",
      imageUrl: "",
      salesCount: 1,
      active: true,
      contentHash: "cached-hash",
    };

    writeMarketplaceReadCache([prompt], storage as Storage);
    const entry = readMarketplaceReadCache(storage as Storage);

    expect(entry).not.toBeNull();
    expect(entry?.prompts).toHaveLength(1);
    expect(entry?.prompts[0].title).toBe("Cached prompt");
  });

  it("serves stale content while revalidating when the cache is still within the allowed stale window", () => {
    const entry: MarketplaceReadCacheEntry = {
      timestamp: Date.now() - DEFAULT_MARKETPLACE_STALE_TIME_MS - 5_000,
      prompts: [
        {
          id: 8n,
          creator: "GTEST",
          priceStroops: 20_000_000n,
          title: "Stale prompt",
          category: "Testing",
          previewText: "Preview",
          imageUrl: "",
          salesCount: 2,
          active: true,
          contentHash: "stale-hash",
        },
      ],
    };

    const status = getMarketplaceReadCacheState(
      entry,
      Date.now(),
      DEFAULT_MARKETPLACE_STALE_TIME_MS,
      DEFAULT_MARKETPLACE_MAX_STALE_AGE_MS,
    );

    expect(status.hasCache).toBe(true);
    expect(status.isStale).toBe(true);
    expect(status.canServeStaleContent).toBe(true);
    expect(status.useStaleWhileRevalidating).toBe(true);
    expect(status.prompts).toHaveLength(1);
  });

  it("rejects stale content once the allowed stale window has expired", () => {
    const entry: MarketplaceReadCacheEntry = {
      timestamp: Date.now() - DEFAULT_MARKETPLACE_MAX_STALE_AGE_MS - 1_000,
      prompts: [
        {
          id: 9n,
          creator: "GTEST",
          priceStroops: 30_000_000n,
          title: "Expired prompt",
          category: "Testing",
          previewText: "Preview",
          imageUrl: "",
          salesCount: 3,
          active: true,
          contentHash: "expired-hash",
        },
      ],
    };

    const status = getMarketplaceReadCacheState(
      entry,
      Date.now(),
      DEFAULT_MARKETPLACE_STALE_TIME_MS,
      DEFAULT_MARKETPLACE_MAX_STALE_AGE_MS,
    );

    expect(status.hasCache).toBe(true);
    expect(status.isStale).toBe(true);
    expect(status.canServeStaleContent).toBe(false);
    expect(status.useStaleWhileRevalidating).toBe(false);
    expect(status.prompts).toBeNull();
  });
});
