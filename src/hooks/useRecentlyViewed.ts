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

export function useRecentlyViewed(walletAddress: string | null): UseRecentlyViewedReturn {
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([]);
  const [config, setConfig] = useState<RecentlyViewedConfig>({
    enabled: false,
    retentionDays: 30,
    maxEntries: 50,
  });
  const [isStorageOk, setIsStorageOk] = useState(true);
  
  const walletAddressRef = useRef(walletAddress);
  walletAddressRef.current = walletAddress;

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

  useEffect(() => {
    refresh();
  }, [refresh, walletAddress]);

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

  const removeEntry = useCallback((promptId: string) => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = removeRecentlyViewed(addr, promptId);
    if (result) {
      setEntries(getRecentlyViewed(addr));
    }
    return result;
  }, []);

  const clearAll = useCallback(() => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = clearRecentlyViewed(addr);
    if (result) {
      setEntries([]);
    }
    return result;
  }, []);

  const enable = useCallback(() => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = setPrivacyConfig(addr, { enabled: true });
    if (result) {
      setConfig(getPrivacyConfig(addr));
    }
    return result;
  }, []);

  const disable = useCallback(() => {
    const addr = walletAddressRef.current;
    if (!addr) return false;
    const result = setPrivacyConfig(addr, { enabled: false });
    if (result) {
      setConfig(getPrivacyConfig(addr));
    }
    return result;
  }, []);

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
  const lastPromptRef = useRef<string | null>(null);
  const lastOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !promptId || !walletAddress) {
      lastPromptRef.current = null;
      lastOpenRef.current = false;
      return;
    }

    if (lastPromptRef.current === promptId && lastOpenRef.current === isOpen) {
      return;
    }

    lastPromptRef.current = promptId;
    lastOpenRef.current = isOpen;

    const config = getPrivacyConfig(walletAddress);
    if (config.enabled) {
      addRecentlyViewed(walletAddress, {
        promptId,
        ...promptData,
      });
    }
  }, [isOpen, promptId, walletAddress, promptData]);
}
