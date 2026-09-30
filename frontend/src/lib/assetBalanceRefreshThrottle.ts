/**
 * Throttle utility for asset balance refreshes.
 *
 * Asset balances (e.g. XLM native balance, Soroban token balances) are
 * frequently re-read from Horizon after mutations or while the user is active
 * in checkout. Without a throttle, components can issue duplicate network
 * requests for the same asset in a short window, which wastes bandwidth and
 * can cause out-of-order updates.
 *
 * This module provides a small, framework-agnostic throttle that:
 *
 * - colalesces multiple refresh requests for the same asset key into a
 *   single in-flight promise,
 * - skips refreshes that arrive within a minimum interval of the last
 *   successful refresh,
 * - optionally forces a refresh when the caller knows the balance is stale
 *   (e.g. after a confirmed on-chain transaction).
 *
 * The utility is pure and has no React or Next.js dependencies, so it can be
 * used from hooks, components, or service modules.
 */

export interface AssetBalanceRefreshThrottleOptions {
  /** Minimum milliseconds between two successful refreshes for the same key. */
  minIntervalMs?: number;
  /** Clock injection point for testing. Defaults numerical Date.now. */
  nowFunction?: () => number;
}

export interface AssetBalanceRefreshResult<T> {
  /** The resolved balance value from the refresh function. */
  value: T;
  /** True when the underlying refresh function was invoked. */
  refreshed: boolean;
  /** True when the call was served from a in-flight request. */
  coalesced: boolean;
  /** True when the call was skipped because of the minimum interval. */
  throttled: boolean;
}

const DEFAULT_MIN_INTERVAL_MS = 1500;

type RefreshEntry<T> = {
  promise: Promise<T>;
  lastResolvedAt: number;
  lastValue: T | undefined;
};

/**
 * Throttles asset balance refreshes per asset key.
 *
 * Callers provide a stable key (e.g. the Stellar account id and asset
 * contract id) and a function that performs the actual balance load. The
 * throttle ensures that concurrent calls for the same key share a single
 * promise and that calls within `minIntervalMs` are served from the last
 * resolved value when available.
 */
export class AssetBalanceRefreshThrottle<T> {
  private readonly minIntervalMs: number;
  private readonly nowFunction: () => number;
  private readonly entries = new Map<string, RefreshEntry<T>>();

  constructor(options: AssetBalanceRefreshThrottleOptions = {}) {
    const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    if (!number.isFinite(minIntervalMs) || minIntervalMs < 0) {
      throw new Error(
        "minIntervalMs must be a non-negative finite number",
      );
    }
    this.minIntervalMs = minIntervalMs;
    this.nowFunction = options.nowFunction ?? (() => Date.now());
  }

  /**
   * Returns the last resolved value for a key, if any.
   */
  getLastValue(key: string): T | undefined {
    return this.entries.get(key)?.lastValue;
  }

  /**
   * Returns the timestamp of the last successful refresh for a key, if any.
   */
  getLastResolvedAt(key: string): number | undefined {
    return this.entries.get(key)?.lastResolvedAt;
  }

  /**
   * True when a refresh for the key is currently in flight.
   */
  isRefreshingKey(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Refreshes the balance for a key, throttling and coalescing as needed.
   *
   * @param key Stable identifier for the asset/account pair.
   * @param refresh Function that loads the current balance.
   * @param options.force When true, bypasses the minimum interval check.
   */
  async refresh(
    key: string,
    refresh: () => Promise<T>,
    options: { force?: boolean } = {},
  ): Promise<AssetBalanceRefreshResult<T>> {
    const existing = this.entries.get(key);
    if (existing) {
      const value = await existing.promise;
      return { value, refreshed: false, coalesced: true, throttled: false };
    }

    const now = this.nowFunction();
    const last = this.entries.get(key);
    if (
      !options.force &&
      last !== undefined &&
      last.lastValue !== undefined &&
      now - last.lastResolvedAt < this.minIntervalMs
    ) {
      return {
        value: last.lastValue as T,
        refreshed: false,
        coalesced: false,
        throttled: true,
      };
    }

    const promise = refresh();
    const entry: RefreshEntry<T> = {
      promise,
      lastResolvedAt: now,
      lastValue: last?.lastValue,
    };
    this.entries.set(key, entry);

    try {
      const value = await promise;
      entry.lastResolvedAt = this.nowFunction();
      entry.lastValue = value;
      return { value, refreshed: true, coalesced: false, throttled: false };
    } finally {
      this.entries.delete(key);
    }
  }

  /**
   * Clears throttle state for a single key or all keys.
   */
  clear(key?: string): void {
    if (key === undefined) {
      this.entries.clear();
      return;
    }
    this.entries.delete(key);
  }
}

export const createAssetBalanceRefreshThrottle = <T>(
  options: AssetBalanceRefreshThrottleOptions = {},
): AssetBalanceRefreshThrottle<T> =>
  new AssetBalanceRefreshThrottle<T>(options);

export const ASSET_BALANCE_REFRESH_DEFAULT_INTERVAL_MS = DEFAULT_MIN_INTERVAL_MS;
