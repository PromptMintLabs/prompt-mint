/**
 * Recently viewed listings storage with privacy controls.
 * 
 * Features:
 * - Local-only storage (never sent to server)
 * - Opt-in enabled by default (disabled until user enables)
 * - Wallet-based isolation (different wallets have separate histories)
 * - Configurable retention period (default: 30 days)
 * - Individual entry deletion and full history clearing
 * - Graceful handling of storage failures
 */

export interface RecentlyViewedEntry {
  promptId: string;
  viewedAt: number; // Unix timestamp in milliseconds
  title?: string;
  imageUrl?: string;
  priceStroops?: string;
  category?: string;
}

export interface RecentlyViewedConfig {
  enabled: boolean;
  retentionDays: number;
  maxEntries: number;
}

const STORAGE_KEY_PREFIX = 'prompt-mint:recently-viewed';
const CONFIG_KEY_PREFIX = 'prompt-mint:recently-viewed-config';
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_ENTRIES = 50;

/**
 * Generate storage key scoped to wallet address
 */
function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}:${walletAddress.toLowerCase()}`;
}

/**
 * Generate config storage key scoped to wallet address
 */
function getConfigKey(walletAddress: string): string {
  return `${CONFIG_KEY_PREFIX}:${walletAddress.toLowerCase()}`;
}

/**
 * Safely get item from localStorage
 */
function safeGetItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

/**
 * Safely set item in localStorage
 */
function safeSetItem<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove item from localStorage
 */
function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get privacy configuration for a wallet
 */
export function getPrivacyConfig(walletAddress: string): RecentlyViewedConfig {
  const config = safeGetItem<RecentlyViewedConfig>(getConfigKey(walletAddress));
  return {
    enabled: config?.enabled ?? false, // Disabled by default (opt-in required)
    retentionDays: config?.retentionDays ?? DEFAULT_RETENTION_DAYS,
    maxEntries: config?.maxEntries ?? DEFAULT_MAX_ENTRIES,
  };
}

/**
 * Update privacy configuration for a wallet
 */
export function setPrivacyConfig(walletAddress: string, config: Partial<RecentlyViewedConfig>): boolean {
  const currentConfig = getPrivacyConfig(walletAddress);
  const newConfig = { ...currentConfig, ...config };
  return safeSetItem(getConfigKey(walletAddress), newConfig);
}

/**
 * Enable recently viewed tracking for a wallet
 */
export function enableRecentlyViewed(walletAddress: string): boolean {
  return setPrivacyConfig(walletAddress, { enabled: true });
}

/**
 * Disable recently viewed tracking for a wallet
 */
export function disableRecentlyViewed(walletAddress: string): boolean {
  return setPrivacyConfig(walletAddress, { enabled: false });
}

/**
 * Check if recently viewed tracking is enabled for a wallet
 */
export function isRecentlyViewedEnabled(walletAddress: string): boolean {
  return getPrivacyConfig(walletAddress).enabled;
}

/**
 * Get recently viewed entries for a wallet, filtered by retention period
 */
export function getRecentlyViewed(walletAddress: string): RecentlyViewedEntry[] {
  const config = getPrivacyConfig(walletAddress);
  
  // Return empty array if tracking is disabled
  if (!config.enabled) {
    return [];
  }
  
  const entries = safeGetItem<RecentlyViewedEntry[]>(getStorageKey(walletAddress)) ?? [];
  const now = Date.now();
  const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
  
  // Filter out expired entries
  const validEntries = entries.filter(entry => 
    now - entry.viewedAt < retentionMs
  );
  
  // If we filtered out entries, update storage
  if (validEntries.length !== entries.length) {
    safeSetItem(getStorageKey(walletAddress), validEntries);
  }
  
  return validEntries;
}

/**
 * Add a listing to recently viewed for a wallet
 */
export function addRecentlyViewed(
  walletAddress: string,
  entry: Omit<RecentlyViewedEntry, 'viewedAt'>
): boolean {
  const config = getPrivacyConfig(walletAddress);
  
  // Don't add if tracking is disabled
  if (!config.enabled) {
    return false;
  }
  
  const entries = getRecentlyViewed(walletAddress);
  const now = Date.now();
  
  // Remove existing entry for this prompt (if any)
  const filteredEntries = entries.filter(e => e.promptId !== entry.promptId);
  
  // Add new entry at the beginning
  const newEntry: RecentlyViewedEntry = {
    ...entry,
    viewedAt: now,
  };
  
  const updatedEntries = [newEntry, ...filteredEntries]
    .slice(0, config.maxEntries); // Limit to max entries
  
  return safeSetItem(getStorageKey(walletAddress), updatedEntries);
}

/**
 * Remove a specific entry from recently viewed for a wallet
 */
export function removeRecentlyViewed(walletAddress: string, promptId: string): boolean {
  const entries = getRecentlyViewed(walletAddress);
  const filteredEntries = entries.filter(e => e.promptId !== promptId);
  
  return safeSetItem(getStorageKey(walletAddress), filteredEntries);
}

/**
 * Clear all recently viewed entries for a wallet
 */
export function clearRecentlyViewed(walletAddress: string): boolean {
  return safeRemoveItem(getStorageKey(walletAddress));
}

/**
 * Get the count of recently viewed entries for a wallet
 */
export function getRecentlyViewedCount(walletAddress: string): number {
  return getRecentlyViewed(walletAddress).length;
}

/**
 * Check if localStorage is available and working
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = 'prompt-mint:storage-test';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
