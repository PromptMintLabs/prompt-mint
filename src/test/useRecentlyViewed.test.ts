import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useRecentlyViewed,
  useTrackPromptView,
} from "../hooks/useRecentlyViewed";
import {
  enableRecentlyViewed,
  disableRecentlyViewed,
  addRecentlyViewed,
  clearRecentlyViewed,
} from "../lib/browsing/history";

describe("useRecentlyViewed Hook", () => {
  const testWalletAddress = "GABC1234567890XYZ";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns empty entries when wallet address is null", () => {
    const { result } = renderHook(() => useRecentlyViewed(null));

    expect(result.current.entries).toEqual([]);
    expect(result.current.config.enabled).toBe(false);
  });

  it("returns default config for new wallet", () => {
    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    expect(result.current.config).toEqual({
      enabled: false,
      retentionDays: 30,
      maxEntries: 50,
    });
  });

  it("enables tracking", () => {
    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    act(() => {
      result.current.enable();
    });

    expect(result.current.config.enabled).toBe(true);
  });

  it("disables tracking", () => {
    enableRecentlyViewed(testWalletAddress);

    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    act(() => {
      result.current.disable();
    });

    expect(result.current.config.enabled).toBe(false);
  });

  it("adds entry when tracking is enabled", () => {
    enableRecentlyViewed(testWalletAddress);

    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    act(() => {
      result.current.addEntry({
        promptId: "123",
        title: "Test Prompt",
      });
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].promptId).toBe("123");
  });

  it("does not add entry when tracking is disabled", () => {
    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    act(() => {
      result.current.addEntry({
        promptId: "123",
        title: "Test Prompt",
      });
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it("removes entry", () => {
    enableRecentlyViewed(testWalletAddress);
    addRecentlyViewed(testWalletAddress, { promptId: "1", title: "First" });
    addRecentlyViewed(testWalletAddress, { promptId: "2", title: "Second" });

    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    act(() => {
      result.current.removeEntry("1");
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].promptId).toBe("2");
  });

  it("clears all entries", () => {
    enableRecentlyViewed(testWalletAddress);
    addRecentlyViewed(testWalletAddress, { promptId: "1", title: "First" });
    addRecentlyViewed(testWalletAddress, { promptId: "2", title: "Second" });

    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it("updates config", () => {
    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    act(() => {
      result.current.updateConfig({ retentionDays: 14 });
    });

    expect(result.current.config.retentionDays).toBe(14);
  });

  it("refreshes data from storage", () => {
    const { result } = renderHook(() => useRecentlyViewed(testWalletAddress));

    // Add entry directly to storage
    enableRecentlyViewed(testWalletAddress);
    addRecentlyViewed(testWalletAddress, { promptId: "1", title: "Test" });

    act(() => {
      result.current.refresh();
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.config.enabled).toBe(true);
  });
});

describe("useTrackPromptView Hook", () => {
  const testWalletAddress = "GABC1234567890XYZ";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("tracks view when modal is open and tracking is enabled", () => {
    enableRecentlyViewed(testWalletAddress);

    renderHook(() =>
      useTrackPromptView(testWalletAddress, "123", true, {
        title: "Test Prompt",
      })
    );

    const entries = JSON.parse(
      localStorage.getItem(
        `prompt-mint:recently-viewed:${testWalletAddress.toLowerCase()}`
      ) || "[]"
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].promptId).toBe("123");
  });

  it("does not track view when modal is closed", () => {
    enableRecentlyViewed(testWalletAddress);

    renderHook(() =>
      useTrackPromptView(testWalletAddress, "123", false, {
        title: "Test Prompt",
      })
    );

    const entries = JSON.parse(
      localStorage.getItem(
        `prompt-mint:recently-viewed:${testWalletAddress.toLowerCase()}`
      ) || "[]"
    );

    expect(entries).toHaveLength(0);
  });

  it("does not track view when tracking is disabled", () => {
    disableRecentlyViewed(testWalletAddress);

    renderHook(() =>
      useTrackPromptView(testWalletAddress, "123", true, {
        title: "Test Prompt",
      })
    );

    const entries = JSON.parse(
      localStorage.getItem(
        `prompt-mint:recently-viewed:${testWalletAddress.toLowerCase()}`
      ) || "[]"
    );

    expect(entries).toHaveLength(0);
  });

  it("does not track view when wallet address is null", () => {
    enableRecentlyViewed(testWalletAddress);

    renderHook(() =>
      useTrackPromptView(null, "123", true, {
        title: "Test Prompt",
      })
    );

    const entries = JSON.parse(
      localStorage.getItem(
        `prompt-mint:recently-viewed:${testWalletAddress.toLowerCase()}`
      ) || "[]"
    );

    expect(entries).toHaveLength(0);
  });
});
