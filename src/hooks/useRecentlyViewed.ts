import { useState, useCallback, useEffect, useRef } from 'react';
import {
  RecentlyViewedEntry,
  RecentlyViewedConfig,
  getPrivacyConfig,
  setPrivacyConfig,
  getRecentlyViewed,
  addRecentlyViewed,
  removeRecentlyViewed,
  clearRecentlyViewed,
  isRecentlyViewedEnabled,
  isStorageAvailable,
} from '@/lib/browsing/history';

export interface UseRecentlyViewedReturn {
  entries: RecentlyViewedEntry[];
  config: RecentlyViewedConfig;
  isStorageOk: boolean;
  addEntry: (entry: Omit<RecentlyViewedEntry, 'viewedAt'>) => boolean;
  removeEntry: (promptId: string) => boolean;
  clearAll: () => boolean;
  enable: () => boolean;
  disable: () => boolean;
  updateConfig: (config: Partial<RecentlyViewedConfig>) => boolean;
  refresh: () => void;
}

/**
 * Hook for managing recently viewed listings with privacy controls
 */
export function useRecentlyViewed(walletAddress: string | null): UseRecentlyViewedReturn {
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([]);
  const [config, setConfig] = useState<RecentlyViewedConfig>({
    enabled: false,
    retentionDays: 30,
    maxEntries: 50,
  });
  const [isStorageOk, setIsStorageOk] = useState(true);
  
  // Use ref to avoid stale closures
  const walletAddressRef = useRef(walletAddress);
  walletAddressRef.current = walletAddress;

  // Refresh entries and config from storage
  const refresh = useCallback(() => {
    const addr = walletAddressRef.current;
    if (!addr) {
      setEntries([]);
      setConfig({ enabled: false, retentionDays: 30, maxEntries: 50 });
      return;
    }

    setIsStorageOk(isStorageAvailable());
    setConfig(getPrivacyConfig(addr));
    setEntries(getRecentlyViewed(addr));
  }, []);

  // Initial load and wallet changes
  useEffect(() => {
    refresh();
  }, [refresh, walletAddress]);

  // Add entry
  const addEntry = useCallback((entry: Omit<RecentlyViewedEntry, 'viewedAt'>) => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = addRecentlyViewed(addr, entry);
    if (result) {
      setConfig(getPrivacyConfig(addr));
      setEntries(getRecentlyViewed(addr));
    }
    return result;
  }, []);

  // Remove entry
  const removeEntry = useCallback((promptId: string) => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = removeRecentlyViewed(addr, promptId);
    if (result) {
      setEntries(getRecentlyViewed(addr));
    }
    return result;
  }, []);

  // Clear all entries
  const clearAll = useCallback(() => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = clearRecentlyViewed(addr);
    if (result) {
      setEntries([]);
    }
    return result;
  }, []);

  // Enable tracking
  const enable = useCallback(() => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = setPrivacyConfig(addr, { enabled: true });
    if (result) {
      setConfig(getPrivacyConfig(addr));
    }
    return result;
  }, []);

  // Disable tracking
  const disable = useCallback(() => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = setPrivacyConfig(addr, { enabled: false });
    if (result) {
      setConfig(getPrivacyConfig(addr));
    }
    return result;
  }, []);

  // Update config
  const updateConfig = useCallback((newConfig: Partial<RecentlyViewedConfig>) => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = setPrivacyConfig(addr, newConfig);
    if (result) {
      setConfig(getPrivacyConfig(addr));
    }
    return result;
  }, []);

  return {
    entries,
    config,
    isStorageOk,
    addEntry,
    removeEntry,
    clearAll,
    enable,
    disable,
    updateConfig,
    refresh,
  };
}

/**
 * Hook to track when a prompt modal is viewed
 */
export function useTrackPromptView(
  walletAddress: string | null,
  promptId: string | null,
  isOpen: boolean,
  promptData?: {
    title?: string;
    imageUrl?: string;
    priceStroops?: string;
    category?: string;
  }
) {
  const hasTrackedRef = useRef(false);
  const lastPromptRef = useRef<string | null>(null);
  const lastOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !promptId || !walletAddress) {
      hasTrackedRef.current = false;
      lastPromptRef.current = null;
      lastOpenRef.current = false;
      return;
    }

    // Only track once per modal open session for this prompt
    if (lastPromptRef.current === promptId && lastOpenRef.current === isOpen) {
      return;
    }

    lastPromptRef.current = promptId;
    lastOpenRef.current = isOpen;

    // Check if tracking is enabled for this wallet
    const config = getPrivacyConfig(walletAddress);
    if (config.enabled) {
      addRecentlyViewed(walletAddress, {
        promptId,
        ...promptData,
      });
    }
  }, [isOpen, promptId, walletAddress, promptData]);
}
