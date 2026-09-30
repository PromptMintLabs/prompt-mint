# Data retention and deletion policy

Tracks issue #91. This document defines what data Prompt Mint collects, how
long it is retained, and how a user can request deletion of the off-chain
data associated with their wallet. It does not change any on-chain contract
behavior: Soroban marketplace state (listings, purchases, entitlements) is
controlled entirely by the contract and is out of scope for this policy.

## 1. Data inventory

| Data | Where it lives | Category | Example fields |
| --- | --- | --- | --- |
| Marketplace state (listings, prompt metadata, purchase entitlements) | Soroban smart contract (on-chain) | On-chain, immutable | prompt id, price, owner, `has_access` |
| User profile | MongoDB `User` | Off-chain, personal | `walletAddress`, `username`, `rating`, `notificationPreferences` |
| Purchase / order records | MongoDB `Purchase`, `PromptOrder`, `MarketplaceTransaction` | Off-chain, marketplace history mirroring on-chain events | buyer/creator wallet, price, tx hash, ledger |
| Notifications | MongoDB `Notification` | Off-chain, personal | wallet address, message, read state |
| Webhook subscriptions | MongoDB `WebhookSubscription` | Off-chain, personal/integration | wallet address, endpoint URL, secret |
| Moderation reports & votes | MongoDB `Report`, `Vote` | Off-chain, governance/audit | reporter wallet, decision, timestamps |
| Audit logs | MongoDB `AuditLog` | Off-chain, operational | actor, action, timestamp |
| Analytics events / rollups | MongoDB `AnalyticsEvent`, `AnalyticsRollup` | Off-chain, aggregated/operational | event type, wallet (where applicable), timestamp |
| API keys | MongoDB `ApiKey` | Off-chain, credential | hashed key, owner wallet, scopes |
| Reviews & seller responses | Storage / `StoredReview` | Off-chain, feedback | prompt id, author wallet, rating, text, seller response |
| Review edit audit records | MongoDB `ReviewEditAuditLog` | Off-chain, audit trail | prompt id, review id, editor wallet, prior text |
| Moderation appeals & evidence | MongoDB `Appeal` | Off-chain, governance/dispute | review id, appellant wallet, statement, attachments |
| Client-side history (transaction history, recently viewed, search history, favorites, bookmarks, cart, theme, currency) | Browser `localStorage`, scoped per wallet address | Local-only, never transmitted to the server | see `src/lib/history/*`, `src/lib/search/searchHistory.ts`, `src/lib/favorites/*`, `src/lib/bookmarks/*` |

Prompt Mint does not collect names, emails, physical addresses, or payment
card data. The wallet address is the primary identifier throughout the
system.

## 2. Retention periods

| Data | Retention | Rationale |
| --- | --- | --- |
| On-chain marketplace state | Indefinite | Owned by the Soroban contract; required for `has_access` checks and is outside any centralized deletion mechanism. |
| Purchase / order / marketplace-transaction records | Indefinite, unless the account is deleted (see §3) | Mirrors on-chain events; needed for buyer/creator transaction history, dispute resolution, and to avoid breaking access-entitlement lookups. |
| User profile, digest email & notification preferences | Until the user requests deletion, or 24 months of inactivity | Personal, off-chain, safe to remove without affecting marketplace access. |
| Notifications and creator digest delivery records | Until the user requests deletion, or 90 days after creation (notifications auto-pruned) | Transient, informational; delivery records prevent duplicate weekly emails. |
| Webhook subscriptions | Until removed by the owner or account deletion | Integration configuration; no purpose once the account is gone. |
| Moderation reports & votes | Indefinite | Governance/audit trail; needed to prevent abuse of the reporting and voting systems even after an account is deleted. |
| Audit logs | 12 months, then archived/rotated | Operational security requirement; see `docs/security/`. |
| Analytics events | 12 months raw, rollups retained longer in aggregate | Rollups are aggregated and not personally identifying once summarized. |
| API keys | Until revoked or account deletion | Credential; revoked keys are retained in hashed/inactive form for audit purposes only. |
| Reviews & seller responses | Indefinite while active; removed reviews retained 90 days after moderation action for appeals, then auto-pruned | Review feedback informs buyers; removed reviews kept for appeal window then cleaned up (#725). Reviews with active appeals are preserved. |
| Review edit audit logs (`ReviewEditAuditLog`) | 12 months, then auto-pruned | Mirrors operational audit log retention window (#725). |
| Helpful vote burst activity | 24 hours, then auto-pruned | Transient sliding-window tracking for vote burst manipulation alerts (#728, #725). |
| Resolved appeal attachments | 180 days, then attachments pruned | Reclaims storage from uploaded evidence while preserving appeal resolution records and history (#725). |
| Client-side (`localStorage`) history | Until the user clears their browser storage or uses the in-app "Clear history" controls | Never sent to the server; entirely under the user's control. |
| Data export bundles (`/api/users/export`) | 1 hour (cached, then auto-expires) | Export downloads are single-use and short-lived by design (see `exportController.ts`). |

## 3. Deletion procedures

### 3.1 Off-chain account deletion (self-service)

A wallet owner can request deletion of their off-chain profile data:

1. `POST /api/users/delete/challenge` with `{ address }` returns a
   signed, time-boxed challenge (5 minute expiry), mirroring the existing
   data-export challenge flow.
2. The client signs the returned `challenge` string with the wallet and
   calls `POST /api/users/delete` with `{ address, token, signature }`.
3. On a valid signature, the server deletes:
   - the `User` profile document (`username`, `rating`,
     `email`, `notificationPreferences`),
   - the wallet's `WebhookSubscription` documents,
   - the wallet's `Notification` and `CreatorDigestDelivery` documents.

See `server/src/controllers/exportController.ts`
(`GenerateDeletionChallenge`, `RequestAccountDeletion`) and
`server/src/routes/userRoutes.ts`.

### 3.2 What is intentionally retained

To keep the marketplace's on-chain access authority intact and to preserve
audit integrity, account deletion does **not** remove:

- `Purchase`, `PromptOrder`, and `MarketplaceTransaction` records — these
  mirror on-chain purchase events. Removing them would not revoke on-chain
  access (the Soroban contract is the source of truth for `has_access`) but
  would silently corrupt other buyers'/creators' transaction history and
  break reconciliation with the indexer.
- `Vote` and `Report` records — governance and moderation history that must
  remain auditable regardless of whether the reporting/voting wallet's
  profile still exists.
- `AuditLog` entries — retained per the operational retention window in the
  table above, independent of account deletion.

These records reference a wallet address but, once the profile is deleted,
carry no additional personal data (no username, no preferences).

### 3.3 Client-side data deletion

Local, wallet-scoped browser storage (transaction history, recently viewed,
search history, favorites, bookmarks, comparison list) can be cleared
independently of the server-side flow:

- `clearTransactions(walletAddress)` / `removeTransaction(walletAddress, id)`
  in `src/lib/history/transactions.ts`, exposed via the `clear`/`remove`
  helpers on `useTransactionHistory`.
- Disconnecting the wallet does not itself erase this data (it is
  wallet-scoped, not session-scoped) so a user who wants it gone should use
  the in-app clear action or their browser's site-data controls.

### 3.4 Full data export

Before requesting deletion, a user can export their off-chain data via the
existing `POST /api/users/export` (challenge-gated, same signature pattern)
flow, which bundles profile, preferences, purchases, reports, votes, and
webhook subscriptions into a time-limited download.

## 4. Backward compatibility

- No existing route, schema, or on-chain contract behavior is modified.
- The deletion endpoints are new and additive (`/api/users/delete/challenge`,
  `/api/users/delete`); no existing endpoint's request/response shape
  changes.
- Marketplace purchase history and on-chain `has_access` checks are
  unaffected by account deletion.

## 5. User rights summary

- **Access** — request a full export of your off-chain data at any time.
- **Deletion** — request deletion of your off-chain profile, notifications,
  and webhook subscriptions at any time; on-chain marketplace state and
  audit-relevant records (purchases, votes, reports) are retained as
  described in §3.2.
- **Local control** — clear locally-stored history/preferences directly in
  the browser at any time, independent of any server request.
