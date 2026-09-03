import { getRedisClient } from "./redisClient";
import { LRUCache } from "lru-cache";

interface ReplayCheckConfig {
  ttlMs: number;
}

const defaultConfig: ReplayCheckConfig = {
  ttlMs: 10 * 60 * 1000,
};

const fallbackNonceCache = new LRUCache<string, boolean>({
  max: 10000,
  ttl: defaultConfig.ttlMs,
});

const fallbackSignatureCache = new LRUCache<string, boolean>({
  max: 10000,
  ttl: defaultConfig.ttlMs,
});

export interface UnlockReplayInput {
  /** Unique nonce embedded in the signed challenge message. */
  nonce: string;
  /** Challenge expiry (Unix ms) — controls how long the nonce stays reserved. */
  expiresAt: number;
  /** Wallet address bound to the challenge (scopes the replay key). */
  address: string;
  /** Optional legacy composite key for defense-in-depth. */
  token?: string;
  signedMessage?: string;
}

function computeNonceKey(address: string, nonce: string): string {
  return `unlock:nonce:${address}:${nonce}`;
}

function computeSignatureHash(token: string, signedMessage: string): string {
  return `replay:${token}:${signedMessage}`;
}

function resolveTtlMs(expiresAt: number, config: ReplayCheckConfig, now = Date.now()): number {
  const remainingMs = Math.max(0, expiresAt - now);
  // Keep the nonce reserved until the challenge expires, with a small buffer.
  const ttlMs = remainingMs + 60_000;
  return Math.min(Math.max(ttlMs, 1_000), config.ttlMs);
}

async function redisSetIfAbsent(
  redis: Awaited<ReturnType<typeof getRedisClient>>,
  key: string,
  ttlMs: number,
): Promise<boolean> {
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  const result = await redis!.set(key, "1", { NX: true, EX: ttlSec });
  return result === "OK";
}

function inMemorySetIfAbsent(
  cache: LRUCache<string, boolean>,
  key: string,
  ttlMs: number,
): boolean {
  if (cache.has(key)) {
    return false;
  }
  cache.set(key, true, { ttl: ttlMs });
  return true;
}

async function reserveReplayKey(key: string, ttlMs: number): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      return redisSetIfAbsent(redis, key, ttlMs);
    }
  } catch {
    // Redis unavailable — fall back to in-memory.
  }

  return inMemorySetIfAbsent(fallbackNonceCache, key, ttlMs);
}

/**
 * Reserve an unlock challenge nonce so a captured wallet signature cannot be
 * replayed after the first successful verification.
 *
 * The signed challenge message already binds address, promptId, nonce, and
 * expiresAt; this store ensures each nonce is accepted at most once for the
 * lifetime of the challenge.
 */
export async function checkUnlockReplayProtection(
  input: UnlockReplayInput,
  config: Partial<ReplayCheckConfig> = {},
  now = Date.now(),
): Promise<{ valid: boolean; reason?: string }> {
  const finalConfig = { ...defaultConfig, ...config };

  if (!input.nonce || !input.address) {
    return { valid: false, reason: "invalid_replay_input" };
  }

  if (input.expiresAt < now) {
    return { valid: false, reason: "challenge_expired" };
  }

  const ttlMs = resolveTtlMs(input.expiresAt, finalConfig, now);
  const nonceKey = computeNonceKey(input.address, input.nonce);
  const nonceReserved = await reserveReplayKey(nonceKey, ttlMs);
  if (!nonceReserved) {
    return { valid: false, reason: "nonce_reused" };
  }

  if (input.token && input.signedMessage) {
    const signatureKey = computeSignatureHash(input.token, input.signedMessage);
    const signatureReserved = await reserveReplayKey(signatureKey, ttlMs);
    if (!signatureReserved) {
      return { valid: false, reason: "signature_reused" };
    }
  }

  return { valid: true };
}

/**
 * @deprecated Prefer {@link checkUnlockReplayProtection} with explicit nonce tracking.
 */
export async function checkReplayProtection(
  token: string,
  signedMessage: string,
  config: Partial<ReplayCheckConfig> = {},
): Promise<{ valid: boolean; reason?: string }> {
  const finalConfig = { ...defaultConfig, ...config };
  const signatureHash = computeSignatureHash(token, signedMessage);

  try {
    const redis = await getRedisClient();
    if (redis) {
      const isValid = await redisSetIfAbsent(redis, signatureHash, finalConfig.ttlMs);
      if (!isValid) {
        return { valid: false, reason: "replay_detected" };
      }
      return { valid: true };
    }
  } catch {
    // Redis unavailable — fall back to in-memory.
  }

  const isValid = inMemorySetIfAbsent(
    fallbackSignatureCache,
    signatureHash,
    finalConfig.ttlMs,
  );
  if (!isValid) {
    return { valid: false, reason: "replay_detected" };
  }
  return { valid: true };
}

/** Test helper — clears in-memory replay state between unit tests. */
export function resetReplayProtectionState(): void {
  fallbackNonceCache.clear();
  fallbackSignatureCache.clear();
}
