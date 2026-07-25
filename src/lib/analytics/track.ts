import {
  type AnalyticsEventName,
  type AnalyticsEventPayload,
  validateEventProperties,
} from "./taxonomy";

const OPT_OUT_STORAGE_KEY = "analytics_opt_out";
const ENDPOINT = "/api/analytics/events";

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    // Storage access can throw in locked-down/private browsing contexts.
    return null;
  }
}

/** User-controlled opt-out. Checked on every `trackEvent` call. */
export function isAnalyticsOptedOut(): boolean {
  const storage = safeLocalStorage();
  if (storage?.getItem(OPT_OUT_STORAGE_KEY) === "1") return true;

  // Respect the browser Do Not Track signal as an implicit opt-out.
  try {
    const dnt =
      typeof navigator !== "undefined" &&
      (navigator.doNotTrack === "1" || (navigator as unknown as { doNotTrack?: string }).doNotTrack === "yes");
    if (dnt) return true;
  } catch {
    // Ignore — navigator may be unavailable in non-browser test contexts.
  }

  return false;
}

export function setAnalyticsOptOut(optOut: boolean): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  if (optOut) storage.setItem(OPT_OUT_STORAGE_KEY, "1");
  else storage.removeItem(OPT_OUT_STORAGE_KEY);
}

/**
 * One-way hash of a wallet address for analytics correlation without
 * persisting the address itself. Distinct from any hashing used by the
 * unlock/challenge flow — this value is never used for access control.
 */
export async function hashWalletAddress(address: string): Promise<string> {
  const bytes = new TextEncoder().encode(`prompt-hash-analytics:${address}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fire-and-forget analytics event send. Never throws and never blocks the
 * calling UI flow — a dropped or failed analytics call must not affect
 * marketplace functionality.
 */
export function trackEvent<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEventPayload<E>,
): void {
  if (isAnalyticsOptedOut()) return;

  const validation = validateEventProperties(event, properties);
  if (!validation.success) {
    if (import.meta.env?.DEV) {
      console.warn(`[analytics] Dropping invalid "${event}" event: ${validation.error}`);
    }
    return;
  }

  if (typeof fetch !== "function") return;

  const body = JSON.stringify({
    event,
    occurredAt: Date.now(),
    properties: validation.data,
  });

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Analytics delivery is best-effort — never surface network errors to the UI.
    });
  } catch {
    // Synchronous fetch failures (e.g. unavailable in a test/SSR context) are also swallowed.
  }
}

/**
 * Convenience wrapper for the common case of tracking an event tied to a
 * connected wallet: hashes `address` (if present) and merges it in as
 * `walletHash` before delegating to `trackEvent`. Callers never need to
 * touch the raw address beyond passing it here.
 */
export function trackEventWithWallet<E extends AnalyticsEventName>(
  event: E,
  address: string | null | undefined,
  properties: Record<string, unknown> = {},
): void {
  if (isAnalyticsOptedOut()) return;

  if (!address) {
    trackEvent(event, { ...properties, walletHash: null } as AnalyticsEventPayload<E>);
    return;
  }

  void hashWalletAddress(address)
    .then((walletHash) => {
      trackEvent(event, { ...properties, walletHash } as AnalyticsEventPayload<E>);
    })
    .catch(() => {
      // If hashing fails for any reason, drop the event rather than risk sending the raw address.
    });
}
