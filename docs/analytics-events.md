# Analytics Event Taxonomy

This document defines PromptHash Stellar's privacy-safe product analytics
taxonomy: which events exist, what they carry, how they flow from the
browser to storage, and the edge cases that shape the implementation.

The taxonomy is implemented in code at
[`src/lib/analytics/taxonomy.ts`](../src/lib/analytics/taxonomy.ts) — that
file is the source of truth; this document explains the *why* behind it.

## Scope and non-goals

- This is **product/usage analytics** (funnel and engagement signals), not
  security auditing. The existing [audit trail](./operations/audit-log-usage.md)
  (`AuditLog` / `recordAuditEvent`) remains the system of record for
  unlock/challenge security events and still stores the full wallet address
  where that's required for incident review. The two systems are
  intentionally separate and are not merged by this change.
- This change does **not** touch the Soroban contract, `has_access`, or any
  on-chain purchase/listing logic. Analytics is a purely additive,
  off-chain observability layer. The marketplace's on-chain access authority
  (who can unlock a prompt) is unaffected.
- This is not a full analytics warehouse (no session stitching, no funnels
  UI, no third-party analytics vendor). It is the minimal event pipeline
  needed to observe product usage safely; a creator-facing dashboard built
  on top of `queryAnalyticsEvents` is a natural, separate follow-up (see the
  README roadmap item "Prompt analytics for creators").

## Privacy principles

Every event in the taxonomy is constrained by these rules, enforced by the
zod schemas in `taxonomy.ts` and re-checked at the API boundary:

1. **No raw wallet address.** The client hashes the connected address with
   SHA-256 (`hashWalletAddress` in `src/lib/analytics/track.ts`) before it
   ever leaves the browser. Only the resulting `walletHash` (a 64-char hex
   digest) is transmitted. This hash is scoped to analytics only — it is
   never used for access control and is unrelated to any hash used by the
   unlock/challenge flow.
2. **No prompt content.** No event schema has a field that can hold prompt
   title, preview text, or plaintext. `prompt_viewed` / `prompt_listed`
   carry only `promptId` and a bounded `category` string.
3. **No free text.** Fields like `reasonCode` are restricted by regex to
   short snake_case codes (`^[a-z0-9_]{1,64}$`), not arbitrary error
   messages. Search queries are never sent as text — only `queryLength`
   (a number) and `resultCount`.
4. **No IP address in the payload.** The client IP is used transiently by
   the API's rate limiter (exactly like the existing `unlock`/`challenge`
   endpoints) and is never written into the stored event document.
5. **Closed schemas.** Every event schema uses `.strict()` — an unexpected
   field fails validation instead of being silently accepted and stored.
   This is the main defense against a future call site accidentally
   attaching something sensitive.
6. **User opt-out is respected.** `isAnalyticsOptedOut()` checks a
   `localStorage` flag (`analytics_opt_out`) and the browser's
   `navigator.doNotTrack` signal before any event is sent. `trackEvent`
   short-circuits and sends nothing when either is set.
7. **Defense in depth against leakage.** The API additionally scans the
   validated payload with `containsRawWalletAddress()` and rejects the
   request if a Stellar public key shape (`G` + 55 base32 chars) is found
   anywhere in it, even though no current schema field could hold one. This
   guards against a future taxonomy addition accidentally admitting one.

## Event catalog

| Event | Trigger | Payload fields | Notes |
|---|---|---|---|
| `wallet_connected` | Wallet connect flow succeeds | `walletHash?`, `walletKind?` | `walletKind` is the wallet id (e.g. `freighter`), not any account data. |
| `wallet_disconnected` | User disconnects | `walletHash?`, `promptId?` | Fired after local session storage is cleared. |
| `wallet_connect_failed` | Wallet connect flow throws | `walletHash?`, `reasonCode?` | `reasonCode` is a short code (e.g. `connect_error`), never the raw error message. |
| `prompt_viewed` | Prompt detail modal opens | `walletHash?`, `promptId?`, `category?` | Fires once per modal open, not on every re-render. |
| `prompt_listed` | Creator publishes a new listing | `walletHash?`, `promptId?`, `category?` | Reserved for the create-listing flow; see "Integration surface" below. |
| `prompt_purchase_initiated` | Buyer confirms the purchase button | `walletHash?`, `promptId?` | Fired before the wallet approval prompt, after network/eligibility checks pass. |
| `prompt_purchase_completed` | `purchasePrompt` resolves | `walletHash?`, `promptId?` | Contract call succeeded; unlock is attempted next. |
| `prompt_purchase_failed` | `purchasePrompt` rejects | `walletHash?`, `promptId?`, `reasonCode?` | |
| `prompt_unlocked` | Unlock flow resolves | `walletHash?`, `promptId?` | Mirrors (but is separate from) the audit trail's `unlock_success`. |
| `prompt_unlock_failed` | Unlock flow rejects | `walletHash?`, `promptId?`, `reasonCode?` | |
| `marketplace_search_performed` | Marketplace search executes | `queryLength`, `resultCount`, `category?` | The query text itself is never sent — only its length. |

All fields marked `?` are optional; every event tolerates a disconnected
wallet (`walletHash` is `null` in that case) or a missing `promptId`.

## Wire format and API contract

`POST /api/analytics/events`

```json
{
  "event": "wallet_connected",
  "occurredAt": 1732400000000,
  "properties": { "walletHash": "…64 hex chars…", "walletKind": "freighter" }
}
```

Response: `202 { "accepted": true }` on success. Errors follow the same
`{ error, code }` shape as the unlock/challenge endpoints
(`src/lib/api/errorCodes.ts`):

| Condition | Status | Code |
|---|---|---|
| Non-POST method | 405 | `METHOD_NOT_ALLOWED` |
| Missing/malformed envelope (`event`, `occurredAt`, `properties`) | 400 | `MISSING_FIELDS` |
| `event` not in the registered taxonomy | 400 | `UNKNOWN_EVENT` |
| `properties` fails the event's schema | 400 | `INVALID_EVENT_PAYLOAD` |
| Payload contains a raw wallet-address-shaped string | 400 | `INVALID_EVENT_PAYLOAD` |
| Per-IP rate limit exceeded | 429 | `RATE_LIMIT_IP` |

## Edge cases

- **Client clock skew.** `occurredAt` is client-supplied. The server clamps
  it to "now" if it drifts more than `MAX_CLIENT_CLOCK_DRIFT_MS` (5 minutes)
  from server receipt time, rather than trusting it or rejecting the event —
  a skewed clock shouldn't lose the event, just its precise timestamp.
- **Analytics failures never affect marketplace flows.** `trackEvent` is
  fire-and-forget: it never throws, never awaits its network call on the
  caller's behalf, and silently drops the event if `fetch` is unavailable,
  the payload is invalid, or the network request fails. A creator's listing
  submission, a buyer's purchase, or an unlock succeeds or fails purely on
  its own merits, independent of analytics delivery.
- **Rate limiting is looser than unlock/challenge.** Analytics traffic is
  higher-volume and lower-risk than unlock attempts, so its rate limit
  (60/min unauthenticated, 120/min authenticated per identifier) exists to
  stop a runaway client loop, not to gate normal browsing.
- **Duplicate/replay events are not deduplicated.** Unlike the unlock flow,
  there is no replay protection here — at-most-once delivery isn't
  guaranteed, and a retried `fetch` could double-count an event. This is an
  accepted tradeoff for a fire-and-forget, best-effort pipeline; aggregate
  metrics should be treated as directional, not exact.
- **Opt-out and Do Not Track are checked client-side only.** If a user
  opts out, no request is ever sent — the server never sees an
  "opted-out" event to filter. There is currently no server-side
  enforcement of a Global Privacy Control-style header; this is worth
  revisiting if the product later needs to honor a network-level signal from
  clients that bypass the bundled tracker.
- **Storage is append-only.** `AnalyticsEvent`, like `AuditLog`, disables
  `updateOne`/`updateMany`/`findOneAndUpdate` at the schema level.

## Backward compatibility

This feature is fully additive:

- New files only (`src/lib/analytics/*`, `api/analytics/events.ts`,
  `server/src/models/AnalyticsEvent.ts`,
  `server/src/services/analyticsEvents.ts`) plus a new `analytics` bucket
  added to the existing rate limiter and metrics helpers.
- The handful of call sites instrumented (`WalletProvider`, `PromptModal`)
  only *add* a fire-and-forget `trackEvent`/`trackEventWithWallet` call
  after existing success/error handling — no existing control flow,
  return value, or error path was changed.
- No changes to the Soroban contract, contract client, or `has_access`
  checks. On-chain access authority is untouched.
- No schema changes to existing MongoDB models (`AuditLog`, `Purchase`,
  etc.) — `AnalyticsEvent` is a new, independent collection.
- No new required environment variables. The endpoint uses the same
  Mongo connection and rate-limiter infra already configured for
  `unlock`/`challenge`.

No migration is required.

## Operational notes

- Metrics: `analytics_event_total{event}` and
  `analytics_event_rejected_total{reason}` are emitted via the existing
  `metrics.emit` helper — see [`docs/operations/metrics.md`](./operations/metrics.md).
- Querying: `queryAnalyticsEvents({ event, walletHash, promptId, since, until, limit })`
  in `server/src/services/analyticsEvents.ts` supports the same filter shape
  as `queryAuditEvents`, for future ops tooling or a creator dashboard.
- Client opt-out toggle: `setAnalyticsOptOut(true | false)` in
  `src/lib/analytics/track.ts`. There is no UI control wired to it yet —
  wiring a settings toggle to this function is a natural follow-up.
