# Checkout XLM balance and reserve checks

Prompt Mint validates the buyer wallet **before** submitting a bulk Soroban purchase at checkout. The check is client-side only; on-chain access rules in the Soroban contract are unchanged.

## When it runs

1. The buyer opens checkout with a connected wallet.
2. `validateCheckout` verifies each cart line (listing state, price, ownership).
3. After line items pass, the app loads the buyer account from Horizon and evaluates XLM sufficiency.
4. **Confirm & Purchase** stays disabled until both line-item validation and the balance check succeed.

## Required balance

The wallet must cover:

| Component | Meaning |
| --- | --- |
| **Cart total** | Sum of stroops for all valid cart lines |
| **Fee buffer** | `0.01 XLM` (`CHECKOUT_FEE_BUFFER_STROOPS`) reserved for Soroban/network fees on the bulk purchase |
| **Minimum reserve** | Stellar protocol minimum balance the account must keep after the payment |

Minimum reserve is computed as:

```
(2 + subentry_count + num_sponsoring - num_sponsored) × base_reserve
```

`base_reserve` is read from Horizon when available; otherwise the client falls back to `0.5 XLM` (`DEFAULT_BASE_RESERVE_STROOPS`).

Spend is allowed when:

```
native_balance ≥ cart_total + fee_buffer + minimum_reserve
```

## Refresh throttle

Balance refreshes are throttled to avoid spamming Horizon when checkout re-renders or the user rapidly edits the cart. The utility lives in `src/lib/checkout/refreshThrottle.ts` and exposes a configurable minimum interval between successful asset balance refetches.

- The default throttle window is `refreshThrottleMs` (default **3000 ms / 3 s **).
- A refresh that falls inside the window is **coalesced** with the in-flight promise instead of issuing a new Horizon request.
- The throttle is per asset key (e.g. the account + asset code + issuer), so different assets do not block each other.
- Failed refreshes do not advance the throttle window, so a retry after a transient Horizon error is allowed immediately.
- Callers may force a refresh by passing `{ force: true }`, which bypasses the window (but still dedupes in-flight requests).

The checkout flow uses this utility whenever it reloads the buyer account after a cart mutation or a focus/visibility event.

## Edge cases

| Scenario | Behavior |
| --- | --- |
| Unfunded / missing account on Horizon | Checkout fails with a clear “unable to verify balance” message; purchase is blocked |
| Balance below reserve only | Message calls out the Stellar minimum reserve |
| Balance covers reserve but not cart + fees | Message calls out insufficient XLM for checkout |
| Empty cart or zero-priced valid total | Only reserve requirement is enforced |
| Some cart lines invalid | Balance check uses the total of **valid** lines only; invalid lines must be removed separately |
| Horizon base reserve fetch fails | Falls back to `0.5 XLM` base reserve constant |
| Refresh requested within the throttle window | Reuses the in-flight/last result instead of hitting Horizon again |
| Forced refresh while a request is in flight | Returns the in-flight promise (deduped) |

## User-facing errors

- Inline red banner in checkout with the primary message.
- Optional detail line: cart total vs required balance (including reserve and fee buffer).
- Confirm handler surfaces the same balance message if validation was stale.

## Code references

- Pure balance math: `src/lib/checkout/xlmBalance.ts`
- Horizon account load: `src/lib/checkout/accountBalance.ts`
- Refresh throttle utility: `src/lib/checkout/refreshThrottle.ts`
- Checkout orchestration: `src/lib/checkout/validation.ts`
- UI: `src/components/Checkout.tsx`

## Tests

- Unit: `src/lib/checkout/xlmBalance.test.ts`
- Unit (throttle): `src/lib/checkout/refreshThrottle.test.ts`
- Integration with cart validation: `src/test/checkout.test.ts`

## Backward compatibility

No contract, API, or unlock permission changes. Buyers with adequate XLM see the same checkout flow; underfunded wallets are blocked earlier with explicit copy instead of a failed on-chain transaction.

## Multi-item fee estimate

Checkout shows a cost breakdown built by `estimateMultiItemPurchase` (`src/lib/checkout/feeEstimation.ts`):

| Line | Meaning |
| --- | --- |
| **Subtotal** | Sum of item prices in stroops (bigint, no precision loss) |
| **Network fee** | Estimated fee for the single bulk transaction |
| **Fee saved by buying together** | Fee for buying each item in its own transaction minus the bulk fee (shown only when > 0) |
| **Estimated total** | Subtotal + network fee |

The bulk purchase is one Soroban transaction, so the fee is modelled as:

```
network_fee = base_fee + resource_overhead + resource_per_item × item_count
            = 100      + 1_000             + 500 × item_count   (stroops)
```

A one-item cart matches `estimateSingleFee` (1_600 stroops). An empty cart has zero fee. All three constants can be overridden via `MultiItemFeeOptions`, e.g. once real `simulateTransaction` resource fees are wired in. Negative item prices throw a `RangeError`.

This estimate is informational; the balance check above still reserves the fixed `CHECKOUT_FEE_BUFFER_STROOPS` buffer.
