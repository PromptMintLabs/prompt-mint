import { useCallback, useEffect, useState } from "react";
import {
  listFavorites,
  isFavorite as isFavStore,
  addFavorite as addStore,
  removeFavorite as removeStore,
  toggleFavorite as toggleStore,
  clearFavorites as clearStore,
  favoriteCount,
  getFavoritesStorageKey,
} from "@/lib/favorites/favorites";

export interface UseFavoritesReturn {
  favorites: string[];
  count: number;
  isFavorite: (_promptId: string) => boolean;
  add: (_promptId: string) => void;
  remove: (_promptId: string) => void;
  toggle: (_promptId: string) => boolean;
  clear: () => void;
  refresh: () => void;
}

export function useFavorites(walletAddress: string | undefined): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<string[]>(() =>
    walletAddress ? listFavorites(walletAddress) : [],
  );

  const refresh = useCallback(() => {
    if (!walletAddress) {
      setFavorites([]);
      return;
    }
    setFavorites(listFavorites(walletAddress));
  }, [walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!walletAddress) return;
    const storageKey = getFavoritesStorageKey(walletAddress);
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [walletAddress, refresh]);

  const add = useCallback(
    (promptId: string) => {
      if (!walletAddress) return;
      setFavorites(addStore(walletAddress, promptId));
    },
    [walletAddress],
  );

  const remove = useCallback(
    (promptId: string) => {
      if (!walletAddress) return;
      setFavorites(removeStore(walletAddress, promptId));
    },
    [walletAddress],
  );

  const toggle = useCallback(
    (promptId: string) => {
      if (!walletAddress) return false;
      const nowFav = toggleStore(walletAddress, promptId);
      setFavorites(listFavorites(walletAddress));
      return nowFav;
    },
    [walletAddress],
  );

  const clear = useCallback(() => {
    if (!walletAddress) return;
    clearStore(walletAddress);
    setFavorites([]);
  }, [walletAddress]);

  const isFavorite = useCallback(
    (promptId: string) => {
      if (!walletAddress) return false;
      return favorites.includes(promptId);
    },
    [walletAddress, favorites],
  );

  return {
    favorites,
    count: favorites.length,
    isFavorite,
    add,
    remove,
    toggle,
    clear,
    refresh,
  };
}
