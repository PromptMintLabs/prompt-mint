import { z } from "zod";

/**
 * Privacy-safe analytics event taxonomy.
 *
 * This is the single source of truth for which product events exist and what
 * shape their payloads take. Both the browser client (`track.ts`) and the
 * `/api/analytics/events` endpoint import from here so neither side can drift
 * from the other. See `docs/analytics-events.md` for the full catalog,
 * privacy rationale, and edge-case behavior.
 *
 * Hard privacy rules enforced by these schemas:
 *  - Never a raw wallet address — only `walletHash`, a SHA-256 digest computed
 *    client-side (see `hashWalletAddress` in track.ts). The unlock/purchase
 *    contract flows that need the real address are untouched by this module.
 *  - Never prompt plaintext, preview text, or other listing content.
 *  - Never free-form text (search queries, error messages) — only bounded,
 *    allow-listed enum-like strings or numeric aggregates.
 *  - No IP address is ever part of an event payload (IP is only used
 *    transiently for rate limiting at the API layer, never persisted here).
 */

const walletHash = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "walletHash must be a lowercase 64-char hex SHA-256 digest")
  .nullable()
  .optional();

const promptId = z.string().trim().min(1).max(64).nullable().optional();

const reasonCode = z
  .string()
  .regex(/^[a-z0-9_]{1,64}$/, "reasonCode must be a short snake_case code, not free text")
  .nullable()
  .optional();

const category = z.string().trim().max(64).nullable().optional();

const basePayload = {
  walletHash,
  promptId,
};

export const EVENT_SCHEMAS = {
  wallet_connected: z
    .object({
      ...basePayload,
      walletKind: z.string().trim().max(32).nullable().optional(),
    })
    .strict(),

  wallet_disconnected: z.object({ ...basePayload }).strict(),

  wallet_connect_failed: z
    .object({
      ...basePayload,
      reasonCode,
    })
    .strict(),

  prompt_viewed: z
    .object({
      ...basePayload,
      category,
    })
    .strict(),

  prompt_listed: z
    .object({
      ...basePayload,
      category,
    })
    .strict(),

  prompt_purchase_initiated: z.object({ ...basePayload }).strict(),

  prompt_purchase_completed: z.object({ ...basePayload }).strict(),

  prompt_purchase_failed: z
    .object({
      ...basePayload,
      reasonCode,
    })
    .strict(),

  prompt_unlocked: z.object({ ...basePayload }).strict(),

  prompt_unlock_failed: z
    .object({
      ...basePayload,
      reasonCode,
    })
    .strict(),

  marketplace_search_performed: z
    .object({
      // Only a length + result count, never the raw query text.
      queryLength: z.number().int().min(0).max(2000),
      resultCount: z.number().int().min(0),
      category,
    })
    .strict(),
} as const;

export type AnalyticsEventName = keyof typeof EVENT_SCHEMAS;

export const ANALYTICS_EVENT_NAMES = Object.keys(
  EVENT_SCHEMAS,
) as AnalyticsEventName[];

export type AnalyticsEventPayload<E extends AnalyticsEventName> = z.infer<
  (typeof EVENT_SCHEMAS)[E]
>;

/**
 * Wire envelope posted to `/api/analytics/events`.
 *
 * `event` is intentionally a plain non-empty string here (not a
 * `z.enum(ANALYTICS_EVENT_NAMES)`) so that an unrecognized event name is
 * still a well-formed envelope — the API distinguishes "malformed request"
 * (400 MISSING_FIELDS) from "unknown event" (400 UNKNOWN_EVENT) using
 * `isKnownEvent` after this parse succeeds.
 */
export const AnalyticsEventEnvelope = z.object({
  event: z.string().trim().min(1),
  // Client epoch ms. The API clamps drift rather than trusting it verbatim.
  occurredAt: z.number().int().positive(),
  properties: z.record(z.string(), z.unknown()).default({}),
});

export type AnalyticsEventEnvelope = z.infer<typeof AnalyticsEventEnvelope>;

export function isKnownEvent(event: string): event is AnalyticsEventName {
  return Object.prototype.hasOwnProperty.call(EVENT_SCHEMAS, event);
}

/**
 * Validate a raw properties object against the schema registered for `event`.
 * Returns a discriminated result instead of throwing so callers (API + tests)
 * can surface a clean 400 without a try/catch around zod internals.
 */
export function validateEventProperties(
  event: AnalyticsEventName,
  properties: unknown,
): { success: true; data: AnalyticsEventPayload<typeof event> } | { success: false; error: string } {
  const schema = EVENT_SCHEMAS[event];
  const result = schema.safeParse(properties ?? {});
  if (!result.success) {
    return { success: false, error: result.error.issues.map((i) => i.message).join("; ") };
  }
  return { success: true, data: result.data };
}

/**
 * Defense-in-depth scan for a raw Stellar public key (G... 56-char base32)
 * anywhere in a payload. The schemas above never declare a field that should
 * hold one, but this catches accidental leakage (e.g. a caller passing the
 * wrong variable) before it reaches storage.
 */
const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

export function containsRawWalletAddress(value: unknown): boolean {
  if (typeof value === "string") {
    return STELLAR_ADDRESS_PATTERN.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsRawWalletAddress);
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(containsRawWalletAddress);
  }
  return false;
}

/** Max allowed drift (ms) between client-reported `occurredAt` and server receipt time. */
export const MAX_CLIENT_CLOCK_DRIFT_MS = 5 * 60_000;
