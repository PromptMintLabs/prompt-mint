import { useCallback, useEffect, useState } from "react";
import {
  listBookmarks,
  addBookmark as addStore,
  removeBookmark as removeStore,
  toggleBookmark as toggleStore,
  clearBookmarks as clearStore,
  BOOKMARKS_STORAGE_PREFIX,
} from "@/lib/bookmarks/bookmarks";
import { useWallet } from "@/hooks/useWallet";

export interface UseBookmarksReturn {
  bookmarks: string[];
  count: number;
  isBookmarked: (_promptId: string) => boolean;
  add: (_promptId: string) => void;
  remove: (_promptId: string) => void;
  toggle: (_promptId: string) => boolean;
  clear: () => void;
  refresh: () => void;
}

/**
 * Wallet-scoped bookmark/favorites hook (#284).
 *
 * Bookmarks are scoped to the connected wallet address and survive refresh.
 * When the wallet disconnects, the anonymous (no-key) fallback is used.
 * Syncs across tabs via the `storage` event using the wallet-scoped key.
 */
export function useBookmarks(): UseBookmarksReturn {
  const { address } = useWallet();
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  const effectiveAddress = address;

  const refresh = useCallback(() => {
    setBookmarks(listBookmarks(effectiveAddress));
  }, [effectiveAddress]);

  useEffect(() => {
    refresh();
    const storageKey = `${BOOKMARKS_STORAGE_PREFIX}:${effectiveAddress ?? ""}`;
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh, effectiveAddress]);

  const add = useCallback(
    (promptId: string) => {
      setBookmarks(addStore(promptId, effectiveAddress));
    },
    [effectiveAddress],
  );

  const remove = useCallback(
    (promptId: string) => {
      setBookmarks(removeStore(promptId, effectiveAddress));
    },
    [effectiveAddress],
  );

  const toggle = useCallback(
    (promptId: string) => {
      const nowBookmarked = toggleStore(promptId, effectiveAddress);
      setBookmarks(listBookmarks(effectiveAddress));
      return nowBookmarked;
    },
    [effectiveAddress],
  );

  const clear = useCallback(() => {
    clearStore(effectiveAddress);
    setBookmarks([]);
  }, [effectiveAddress]);

  const isBookmarked = useCallback(
    (promptId: string) => bookmarks.includes(promptId),
    [bookmarks],
  );

  return {
    bookmarks,
    count: bookmarks.length,
    isBookmarked,
    add,
    remove,
    toggle,
    clear,
    refresh,
  };
}
