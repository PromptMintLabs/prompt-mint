export const FAVORITES_STORAGE_KEY_PREFIX = "prompt-mint:favorites:v1";

function getStorageKey(walletAddress: string): string {
  return `${FAVORITES_STORAGE_KEY_PREFIX}:${walletAddress.toLowerCase()}`;
}

function safeRead(walletAddress: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((v) => String(v))));
  } catch {
    return [];
  }
}

function safeWrite(walletAddress: string, ids: string[]): boolean {
  try {
    localStorage.setItem(
      getStorageKey(walletAddress),
      JSON.stringify(Array.from(new Set(ids))),
    );
    return true;
  } catch {
    return false;
  }
}

export function listFavorites(walletAddress: string): string[] {
  return safeRead(walletAddress);
}

export function isFavorite(walletAddress: string, promptId: string): boolean {
  return safeRead(walletAddress).includes(promptId);
}

export function addFavorite(walletAddress: string, promptId: string): string[] {
  const ids = safeRead(walletAddress);
  if (!ids.includes(promptId)) {
    ids.push(promptId);
    safeWrite(walletAddress, ids);
  }
  return ids;
}

export function removeFavorite(walletAddress: string, promptId: string): string[] {
  const next = safeRead(walletAddress).filter((id) => id !== promptId);
  safeWrite(walletAddress, next);
  return next;
}

export function toggleFavorite(walletAddress: string, promptId: string): boolean {
  if (isFavorite(walletAddress, promptId)) {
    removeFavorite(walletAddress, promptId);
    return false;
  }
  addFavorite(walletAddress, promptId);
  return true;
}

export function favoriteCount(walletAddress: string): number {
  return safeRead(walletAddress).length;
}

export function clearFavorites(walletAddress: string): boolean {
  try {
    localStorage.removeItem(getStorageKey(walletAddress));
    return true;
  } catch {
    return false;
  }
}

export function getFavoritesStorageKey(walletAddress: string): string {
  return getStorageKey(walletAddress);
}
