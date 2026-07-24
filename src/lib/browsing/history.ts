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
  viewedAt: number;
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

function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}:${walletAddress.toLowerCase()}`;
}

function getConfigKey(walletAddress: string): string {
  return `${CONFIG_KEY_PREFIX}:${walletAddress.toLowerCase()}`;
}

function safeGetItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

function safeSetItem<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getPrivacyConfig(walletAddress: string): RecentlyViewedConfig {
  const config = safeGetItem<RecentlyViewedConfig>(getConfigKey(walletAddress));
  return {
    enabled: config?.enabled ?? false,
    retentionDays: config?.retentionDays ?? DEFAULT_RETENTION_DAYS,
    maxEntries: config?.maxEntries ?? DEFAULT_MAX_ENTRIES,
  };
}

export function setPrivacyConfig(walletAddress: string, config: Partial<RecentlyViewedConfig>): boolean {
  const currentConfig = getPrivacyConfig(walletAddress);
  const newConfig = { ...currentConfig, ...config };
  return safeSetItem(getConfigKey(walletAddress), newConfig);
}

export function enableRecentlyViewed(walletAddress: string): boolean {
  return setPrivacyConfig(walletAddress, { enabled: true });
}

export function disableRecentlyViewed(walletAddress: string): boolean {
  return setPrivacyConfig(walletAddress, { enabled: false });
}

export function isRecentlyViewedEnabled(walletAddress: string): boolean {
  return getPrivacyConfig(walletAddress).enabled;
}

export function getRecentlyViewed(walletAddress: string): RecentlyViewedEntry[] {
  const config = getPrivacyConfig(walletAddress);
  
  if (!config.enabled) {
    return [];
  }
  
  const entries = safeGetItem<RecentlyViewedEntry[]>(getStorageKey(walletAddress)) ?? [];
  const now = Date.now();
  const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
  
  const validEntries = entries.filter(entry => 
    now - entry.viewedAt < retentionMs
  );
  
  if (validEntries.length !== entries.length) {
    safeSetItem(getStorageKey(walletAddress), validEntries);
  }
  
  return validEntries;
}

export function addRecentlyViewed(
  walletAddress: string,
  entry: Omit<RecentlyViewedEntry, 'viewedAt'>
): boolean {
  const config = getPrivacyConfig(walletAddress);
  
  if (!config.enabled) {
    return false;
  }
  
  const entries = getRecentlyViewed(walletAddress);
  const now = Date.now();
  
  const filteredEntries = entries.filter(e => e.promptId !== entry.promptId);
  
  const newEntry: RecentlyViewedEntry = {
    ...entry,
    viewedAt: now,
  };
  
  const updatedEntries = [newEntry, ...filteredEntries]
    .slice(0, config.maxEntries);
  
  return safeSetItem(getStorageKey(walletAddress), updatedEntries);
}

export function removeRecentlyViewed(walletAddress: string, promptId: string): boolean {
  const entries = getRecentlyViewed(walletAddress);
  const filteredEntries = entries.filter(e => e.promptId !== promptId);
  
  return safeSetItem(getStorageKey(walletAddress), filteredEntries);
}

export function clearRecentlyViewed(walletAddress: string): boolean {
  return safeRemoveItem(getStorageKey(walletAddress));
}

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
