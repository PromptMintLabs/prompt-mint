import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  isFavorite,
  toggleFavorite,
  favoriteCount,
  clearFavorites,
  FAVORITES_STORAGE_KEY_PREFIX,
} from "@/lib/favorites/favorites";

const WALLET_A = "GA7FYRB5V3AP6P2RROT2P6KRSZ3K6QI6W3Y6KX2X7HX6Q5Y6KX2X7HX6";
const WALLET_B = "GCXKG6RN4ON6MJG5VQZ2KQ3X4Y5P6Q7R8A9B0C1D2E3F4G5H6I7J8K9L0M";
const PROMPT_1 = "1";
const PROMPT_2 = "2";
const PROMPT_3 = "3";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("favorites storage", () => {
  it("starts empty for a new wallet", () => {
    expect(listFavorites(WALLET_A)).toEqual([]);
  });

  it("adds a favorite prompt id", () => {
    addFavorite(WALLET_A, PROMPT_1);
    expect(listFavorites(WALLET_A)).toEqual([PROMPT_1]);
  });

  it("is idempotent on duplicate add", () => {
    addFavorite(WALLET_A, PROMPT_1);
    addFavorite(WALLET_A, PROMPT_1);
    expect(listFavorites(WALLET_A)).toEqual([PROMPT_1]);
  });

  it("removes a favorite", () => {
    addFavorite(WALLET_A, PROMPT_1);
    addFavorite(WALLET_A, PROMPT_2);
    removeFavorite(WALLET_A, PROMPT_1);
    expect(listFavorites(WALLET_A)).toEqual([PROMPT_2]);
  });

  it("checks isFavorite correctly", () => {
    expect(isFavorite(WALLET_A, PROMPT_1)).toBe(false);
    addFavorite(WALLET_A, PROMPT_1);
    expect(isFavorite(WALLET_A, PROMPT_1)).toBe(true);
    removeFavorite(WALLET_A, PROMPT_1);
    expect(isFavorite(WALLET_A, PROMPT_1)).toBe(false);
  });

  it("toggles a favorite on and off", () => {
    expect(toggleFavorite(WALLET_A, PROMPT_1)).toBe(true);
    expect(isFavorite(WALLET_A, PROMPT_1)).toBe(true);
    expect(toggleFavorite(WALLET_A, PROMPT_1)).toBe(false);
    expect(isFavorite(WALLET_A, PROMPT_1)).toBe(false);
  });

  it("isolates favorites per wallet", () => {
    addFavorite(WALLET_A, PROMPT_1);
    addFavorite(WALLET_B, PROMPT_2);
    expect(listFavorites(WALLET_A)).toEqual([PROMPT_1]);
    expect(listFavorites(WALLET_B)).toEqual([PROMPT_2]);
  });

  it("returns count of favorites", () => {
    expect(favoriteCount(WALLET_A)).toBe(0);
    addFavorite(WALLET_A, PROMPT_1);
    addFavorite(WALLET_A, PROMPT_2);
    addFavorite(WALLET_A, PROMPT_3);
    expect(favoriteCount(WALLET_A)).toBe(3);
  });

  it("clears all favorites for a wallet", () => {
    addFavorite(WALLET_A, PROMPT_1);
    addFavorite(WALLET_A, PROMPT_2);
    clearFavorites(WALLET_A);
    expect(listFavorites(WALLET_A)).toEqual([]);
  });

  it("uses wallet-scoped storage key", () => {
    addFavorite(WALLET_A, PROMPT_1);
    const key = `${FAVORITES_STORAGE_KEY_PREFIX}:${WALLET_A.toLowerCase()}`;
    expect(JSON.parse(localStorage.getItem(key) ?? "[]")).toEqual([PROMPT_1]);
  });

  it("survives page refresh (localStorage persistence)", () => {
    addFavorite(WALLET_A, PROMPT_1);
    addFavorite(WALLET_A, PROMPT_2);

    // Simulate page refresh by clearing in-memory and re-reading
    const stored = JSON.parse(
      localStorage.getItem(
        `${FAVORITES_STORAGE_KEY_PREFIX}:${WALLET_A.toLowerCase()}`,
      ) ?? "[]",
    );
    expect(stored).toEqual([PROMPT_1, PROMPT_2]);
  });

  it("handles corrupted localStorage gracefully", () => {
    const key = `${FAVORITES_STORAGE_KEY_PREFIX}:${WALLET_A.toLowerCase()}`;
    localStorage.setItem(key, "not-json");
    expect(listFavorites(WALLET_A)).toEqual([]);
  });

  it("handles non-array localStorage gracefully", () => {
    const key = `${FAVORITES_STORAGE_KEY_PREFIX}:${WALLET_A.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify({ foo: "bar" }));
    expect(listFavorites(WALLET_A)).toEqual([]);
  });
});
