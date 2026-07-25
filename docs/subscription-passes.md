# Creator catalog subscription passes

Subscription passes are on-chain, non-transferable entitlements scoped to one
creator's catalog. A creator explicitly configures the pass duration, exact
renewal price, payment asset, and whether new subscriptions and renewals are
open. Durations are greater than zero and capped at 365 days.

Creators opt individual listings into or out of subscription access. Eligibility
is evaluated from current contract state every time `has_access` runs:

- a newly eligible listing becomes available immediately to active subscribers;
- removing eligibility immediately removes pass-based access;
- closing new subscriptions does not revoke already-paid access;
- direct purchases and transferred licenses remain valid independently of pass
  eligibility;
- subscription passes themselves cannot be transferred.

The expiry timestamp is exclusive. Access is valid while the ledger timestamp is
strictly less than `expires_at`. Renewal extends from the later of the current
expiry or the current ledger time, so early renewal preserves remaining time and
late renewal starts a fresh term. Renewals use the creator's current published
price, asset, and duration and fail atomically when the pass is closed, payment
is not exact, authorization is absent, or token transfer fails.

The unlock endpoint does not trust a cached subscription or client assertion. It
calls the contract's `has_access(address, prompt_id)` method for every unlock
request. That method checks creator ownership, current direct-purchase
entitlement, then current listing eligibility and unexpired subscription state.
