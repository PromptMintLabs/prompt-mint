# Fee model and XLM split math

This document explains exactly how the `prompt-hash` Soroban contract splits XLM between the seller (creator) and the platform on a purchase, including stroop precision and integer rounding behavior. All formulas match the implementation in `contracts/prompt-hash/src/contract.rs`.

## Stroop precision

Stellar amounts are stored and transferred as **stroops** — the smallest indivisible unit of XLM.

| Unit | Value |
| --- | --- |
| 1 XLM | `10_000_000` stroops (`10^7`) |
| 1 stroop | `0.0000001` XLM |

Every on-chain price, fee, and payout in PromptHash is an **`i128` stroop integer**. There are no floating-point amounts in the contract. Wallets and the frontend may display XLM decimals, but settlement always uses whole stroops.

Conversion:

```
xlm_display = stroops / 10_000_000
stroops     = floor(xlm_display * 10_000_000)
```

## Basis points (BPS)

Percentages are expressed in **basis points** where `10_000 BPS = 100%` and `1 BPS = 0.01%`.

Contract constants (`contract.rs`):

| Constant | Value | Meaning |
| --- | --- | --- |
| `MAX_BPS` | `10_000` | 100% — divisor for all percentage math |
| `DEFAULT_FEE_BPS` | `500` | Default platform fee: **5%** |
| `MAX_FEE_BPS` | `2_000` | Admin ceiling: platform fee cannot exceed **20%** |
| `ROYALTY_BPS` | `500` | Resale royalty to original creator: **5%** (license transfers only) |
| `LEASE_PRICE_BPS` | `4_000` | Lease price = **40%** of listing price |

The live platform fee is stored on-chain (`get_fee_percentage`) and can be changed by the contract admin within the `MAX_FEE_BPS` cap.

## Core formula (primary purchase)

For a standard `buy_prompt` settlement, let:

- `P` = `payment_amount_stroops` — the stroops debited from the buyer (must be ≥ the effective listing price after promotions/vouchers)
- `F` = platform fee BPS from contract storage (`get_fee_percentage`)

All intermediate products use Rust **checked** arithmetic; overflow returns `Error::ArithmeticOverflow`.

### Step 1 — Platform fee (integer division)

```
platform_amount = (P × F) / 10_000
```

Division is **integer division** (truncates toward zero). Any fractional stroops from this step are **not** collected by the platform.

### Step 2 — Seller (creator) proceeds

On a simple purchase with no referral code and no co-creator splits:

```
creator_amount = P − platform_amount
```

### Conservation invariant

For the simple case (no referral, no splits):

```
P = platform_amount + creator_amount
```

Every stroop the buyer pays is accounted for. Rounding dust stays with the creator, never with the platform.

## Rounding behavior

Integer BPS math can produce a remainder when `P × F` is not evenly divisible by `10_000`. The contract **never rounds up** the platform fee; it always **floors** via truncating division.

### Example A — fee rounds down to zero

Default fee `F = 500` (5%), price `P = 19` stroops:

```
platform_amount = (19 × 500) / 10_000 = 9_500 / 10_000 = 0
creator_amount  = 19 − 0 = 19
```

The platform receives **0 stroops**; the seller receives the **full payment**. This is covered by `test_small_price_fee_rounding_keeps_fractional_fee_with_seller`.

### Example B — typical sale

Default fee `F = 500`, price `P = 10_000_000` stroops (1 XLM):

```
platform_amount = (10_000_000 × 500) / 10_000 = 500_000
creator_amount  = 10_000_000 − 500_000 = 9_500_000
```

| Party | Stroops | XLM |
| --- | --- | --- |
| Buyer pays | `10_000_000` | 1.0000000 |
| Platform | `500_000` | 0.0500000 |
| Seller | `9_500_000` | 0.9500000 |

### Example C — rounding across odd prices

For any price `P` with default 5% fee and no referral/splits:

```
platform_amount = P × 500 / 10_000
creator_amount  = P − platform_amount
```

The contract tests (`test_fee_rounding_across_multiple_prices`) assert `P == platform_amount + creator_amount` for prices including `1`, `19`, `101`, `1_001`, `10_001`, `99_999`, and `1_000_001`.

## Extended purchase split (referral + co-creator splits)

When a purchase includes a referral code and/or co-creator revenue splits, each deduction is computed **independently from the full payment `P`**, not from the seller's share.

Let:

- `R` = referral reward BPS (from the referral code, if valid)
- `Sᵢ` = BPS for co-creator split *i* (configured at listing time; up to 16 splits)

```
referrer_amount = (P × R) / 10_000          // 0 if no valid referral
split_amount_i  = (P × Sᵢ) / 10_000         // per co-creator recipient
split_total     = Σ split_amount_i

creator_amount  = P − platform_amount − referrer_amount − split_total
```

Each term uses the same truncating integer division. Any combined rounding loss is absorbed by **`creator_amount`** (the primary seller), so the full payment is always distributed:

```
P = platform_amount + referrer_amount + split_total + creator_amount
```

### Example D — platform fee + one co-creator split

`P = 101`, `F = 500`, one split at `333` BPS (3.33%):

```
platform_amount = 101 × 500 / 10_000  = 5
split_amount    = 101 × 333 / 10_000  = 3
creator_amount  = 101 − 5 − 3          = 93
```

Check: `5 + 3 + 93 = 101` ✓

### Split validation at listing time

When a creator adds co-creator splits, the contract enforces:

```
Σ Sᵢ + F ≤ 10_000
```

So the seller always receives a non-negative payout even at the maximum configured platform fee. Misconfigured listings that would leave a negative creator share are rejected with `Error::InvalidSplits`.

## Effective payment amount

The split math always runs on **`payment_amount_stroops`** — the actual stroops transferred from the buyer — not necessarily the raw listing price.

The effective price may differ when:

| Adjustment | Effect on `P` |
| --- | --- |
| Active promotion | Uses promotional stroop price |
| Voucher discount | `P = listing_price − (listing_price × discount_bps / 10_000)` |
| Buyer overpayment | Allowed if `payment_amount_stroops ≥ required_price`; splits apply to the full amount paid |

Platform fee, referral, and co-creator splits are all recomputed on the effective/overpaid amount.

## Other settlement paths

These flows use the same stroop/BPS rules but differ in who receives what.

### Lease (`lease_prompt`)

Lease price is derived from the listing price, then split like a normal purchase:

```
lease_price     = (listing_price_stroops × 4_000) / 10_000    // 40% of list price
platform_amount = (lease_price × F) / 10_000
creator_amount  = lease_price − platform_amount
```

No referral or co-creator splits on leases.

### Bundle (`buy_bundle`)

```
platform_amount = (bundle_price × F) / 10_000
referrer_amount = (bundle_price × referral_bps / 10_000)   // if referrer present
creator_amount  = bundle_price − platform_amount − referrer_amount
```

Per-item settlement records divide amounts across bundle items using integer division; **the first item receives any remainder** stroops from the per-item split so totals still sum exactly to `bundle_price`.

### Subscription (`renew_subscription`)

```
platform_amount = (subscription_price × F) / 10_000
creator_amount  = subscription_price − platform_amount
```

Payment must match the configured subscription price exactly.

### License resale (`transfer_license`)

Resale uses a **fixed royalty**, not the configurable platform fee:

```
royalty_amount = (resale_price × 500) / 10_000     // 5% to original creator
seller_amount  = resale_price − royalty_amount      // to current license holder
```

Platform fee wallet is **not** involved in secondary transfers. A zero-price gift transfer moves no stroops.

## Where funds go

| Recipient | Address source | Typical flows |
| --- | --- | --- |
| Seller / creator | `prompt.creator` (or `bundle.creator`) | `buy_prompt`, `buy_bundle`, `lease_prompt`, subscriptions |
| Platform | `get_fee_wallet()` | Primary purchases, bundles, leases, subscriptions |
| Referrer | Referral code owner | `buy_prompt`, `buy_bundle` (when valid code supplied) |
| Co-creator | `split.recipient` per listing config | `buy_prompt` only |
| Original creator (royalty) | `purchase.original_creator` | `transfer_license` resales |

Token transfers are skipped when the computed amount is `0` stroops (no-op transfer).

## Settlement record

Every purchase emits a `Settlement` struct (see `events.rs`) with the exact stroop amounts:

| Field | Meaning |
| --- | --- |
| `buyer_amount` | Total stroops charged to buyer |
| `creator_amount` | Stroops sent to seller/creator |
| `platform_amount` | Stroops sent to fee wallet |
| `referrer_amount` | Stroops sent to referrer |
| `split_amount` | Sum of all co-creator split stroops |

These values are the authoritative on-chain record for reconciliation and indexing.

## Quick reference

```
// Platform fee (all primary settlement paths)
platform_amount = (P × fee_bps) / 10_000

// Seller proceeds (buy_prompt with referral + splits)
creator_amount = P − platform_amount − referrer_amount − split_total

// Rounding rule
// - Integer division truncates (floors for positive amounts)
// - Unallocated stroops stay with creator_amount
// - P always equals the sum of all payout legs
```

## Related docs

- [Smart Contract Architecture — Fee Calculation Engine](./smart-contract-architecture.md#4-fee-calculation-engine--revenue-splits) — storage layout, sequence diagrams, and event schema
- [Checkout XLM balance checks](./checkout-xlm-balance.md) — client-side pre-purchase wallet validation (separate from on-chain split math)
- Contract source: `contracts/prompt-hash/src/contract.rs` — `execute_buy`, `validate_splits`, and per-flow settlement helpers
