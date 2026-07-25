import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPrivacyConfig,
  setPrivacyConfig,
  enableRecentlyViewed,
  disableRecentlyViewed,
  isRecentlyViewedEnabled,
  getRecentlyViewed,
  addRecentlyViewed,
  removeRecentlyViewed,
  clearRecentlyViewed,
  isStorageAvailable,
  type RecentlyViewedEntry,
} from "../lib/browsing/history";

describe("Recently Viewed History", () => {
  const testWalletAddress = "GABC1234567890XYZ";
  const testWalletAddress2 = "GDEF9876543210ABC";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("Privacy Configuration", () => {
    it("returns default config when no config exists", () => {
      const config = getPrivacyConfig(testWalletAddress);
      expect(config).toEqual({
        enabled: false, // Disabled by default (opt-in required)
        retentionDays: 30,
        maxEntries: 50,
      });
    });

    it("saves and retrieves privacy config", () => {
      const success = setPrivacyConfig(testWalletAddress, {
        enabled: true,
        retentionDays: 14,
      });
      expect(success).toBe(true);

      const config = getPrivacyConfig(testWalletAddress);
      expect(config.enabled).toBe(true);
      expect(config.retentionDays).toBe(14);
      expect(config.maxEntries).toBe(50); // Default value preserved
    });

    it("enables recently viewed tracking", () => {
      const success = enableRecentlyViewed(testWalletAddress);
      expect(success).toBe(true);
      expect(isRecentlyViewedEnabled(testWalletAddress)).toBe(true);
    });

    it("disables recently viewed tracking", () => {
      enableRecentlyViewed(testWalletAddress);
      expect(isRecentlyViewedEnabled(testWalletAddress)).toBe(true);

      const success = disableRecentlyViewed(testWalletAddress);
      expect(success).toBe(true);
      expect(isRecentlyViewedEnabled(testWalletAddress)).toBe(false);
    });

    it("isolates config by wallet address", () => {
      enableRecentlyViewed(testWalletAddress);
      disableRecentlyViewed(testWalletAddress2);

      expect(isRecentlyViewedEnabled(testWalletAddress)).toBe(true);
      expect(isRecentlyViewedEnabled(testWalletAddress2)).toBe(false);
    });
  });

  describe("Recently Viewed Entries", () => {
    beforeEach(() => {
      enableRecentlyViewed(testWalletAddress);
    });

    it("returns empty array when tracking is disabled", () => {
      disableRecentlyViewed(testWalletAddress);
      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toEqual([]);
    });

    it("adds entry to recently viewed", () => {
      const entry: Omit<RecentlyViewedEntry, "viewedAt"> = {
        promptId: "123",
        title: "Test Prompt",
        imageUrl: "https://example.com/image.jpg",
        priceStroops: "1000000",
        category: "AI",
      };

      const success = addRecentlyViewed(testWalletAddress, entry);
      expect(success).toBe(true);

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toHaveLength(1);
      expect(entries[0].promptId).toBe("123");
      expect(entries[0].title).toBe("Test Prompt");
      expect(entries[0].viewedAt).toBeTypeOf("number");
    });

    it("does not add entry when tracking is disabled", () => {
      disableRecentlyViewed(testWalletAddress);

      const entry: Omit<RecentlyViewedEntry, "viewedAt"> = {
        promptId: "123",
        title: "Test Prompt",
      };

      const success = addRecentlyViewed(testWalletAddress, entry);
      expect(success).toBe(false);

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toHaveLength(0);
    });

    it("updates existing entry instead of duplicating", () => {
      const entry1: Omit<RecentlyViewedEntry, "viewedAt"> = {
        promptId: "123",
        title: "Test Prompt v1",
      };

      const entry2: Omit<RecentlyViewedEntry, "viewedAt"> = {
        promptId: "123",
        title: "Test Prompt v2",
      };

      addRecentlyViewed(testWalletAddress, entry1);
      addRecentlyViewed(testWalletAddress, entry2);

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Test Prompt v2");
    });

    it("maintains order with most recent first", () => {
      const entry1: Omit<RecentlyViewedEntry, "viewedAt"> = {
        promptId: "1",
        title: "First",
      };

      const entry2: Omit<RecentlyViewedEntry, "viewedAt"> = {
        promptId: "2",
        title: "Second",
      };

      addRecentlyViewed(testWalletAddress, entry1);
      addRecentlyViewed(testWalletAddress, entry2);

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries[0].promptId).toBe("2");
      expect(entries[1].promptId).toBe("1");
    });

    it("removes specific entry", () => {
      addRecentlyViewed(testWalletAddress, { promptId: "1", title: "First" });
      addRecentlyViewed(testWalletAddress, { promptId: "2", title: "Second" });

      const success = removeRecentlyViewed(testWalletAddress, "1");
      expect(success).toBe(true);

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toHaveLength(1);
      expect(entries[0].promptId).toBe("2");
    });

    it("clears all entries", () => {
      addRecentlyViewed(testWalletAddress, { promptId: "1", title: "First" });
      addRecentlyViewed(testWalletAddress, { promptId: "2", title: "Second" });

      const success = clearRecentlyViewed(testWalletAddress);
      expect(success).toBe(true);

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toHaveLength(0);
    });

    it("isolates entries by wallet address", () => {
      enableRecentlyViewed(testWalletAddress2);

      addRecentlyViewed(testWalletAddress, { promptId: "1", title: "Wallet 1" });
      addRecentlyViewed(testWalletAddress2, { promptId: "2", title: "Wallet 2" });

      const entries1 = getRecentlyViewed(testWalletAddress);
      const entries2 = getRecentlyViewed(testWalletAddress2);

      expect(entries1).toHaveLength(1);
      expect(entries1[0].promptId).toBe("1");

      expect(entries2).toHaveLength(1);
      expect(entries2[0].promptId).toBe("2");
    });

    it("respects max entries limit", () => {
      setPrivacyConfig(testWalletAddress, { maxEntries: 3 });

      for (let i = 1; i <= 5; i++) {
        addRecentlyViewed(testWalletAddress, {
          promptId: i.toString(),
          title: `Prompt ${i}`,
        });
      }

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toHaveLength(3);
      expect(entries[0].promptId).toBe("5"); // Most recent
      expect(entries[2].promptId).toBe("3"); // Oldest kept
    });

    it("filters out expired entries based on retention period", () => {
      setPrivacyConfig(testWalletAddress, { retentionDays: 1 });

      addRecentlyViewed(testWalletAddress, { promptId: "1", title: "Recent" });

      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      const twoDaysLater = originalNow() + 2 * 24 * 60 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(twoDaysLater);

      const entries = getRecentlyViewed(testWalletAddress);
      expect(entries).toHaveLength(0);

      vi.restoreAllMocks();
    });
  });

  describe("Storage Availability", () => {
    it("detects when localStorage is available", () => {
      expect(isStorageAvailable()).toBe(true);
    });

    it("detects when localStorage is not available", () => {
      const originalLocalStorage = window.localStorage;
      // @ts-ignore
      delete window.localStorage;

      expect(isStorageAvailable()).toBe(false);

      window.localStorage = originalLocalStorage;
    });
  });

  describe("Error Handling", () => {
    it("handles corrupted localStorage data gracefully", () => {
      // Mock localStorage to return corrupted data
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn().mockReturnValue("invalid json");

      const entries = getRecentlyViewed("test");
      expect(entries).toEqual([]);

      localStorage.getItem = originalGetItem;
    });

    it("handles localStorage quota exceeded", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Mock localStorage to throw on setItem
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      const success = addRecentlyViewed(testWalletAddress, {
        promptId: "1",
        title: "Test",
      });

      expect(success).toBe(false);

      localStorage.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });
  });
});
