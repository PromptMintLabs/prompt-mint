# Wallet minimum balance warning

Stellar requires every account to keep a **minimum balance** (the "reserve") on the network. Once a wallet's native XLM balance drops below that reserve the account can no longer pay transaction fees, so _any_ action — buying a prompt, adding a trustline, removing a data entry — fails late with an opaque `insufficient_balance` error. Prompt Mint checks this on wallet connection and warns before the user reaches a failing transaction (#699).

This is a **client-side warning only**. No contract, API, or unlock permission behaviour changes.

## When it runs

1. A wallet connects (or the connected account changes).
2. `useMinimumBalance` loads the account from Horizon through the shared account loader.
3. `MinimumBalanceBanner` renders in the prompt purchase modal (next to `TrustlineBanner`) when the balance is below the reserve or the account is unfunded.
4. While the account is below the reserve, the check also re-runs when the tab regains focus — the usual moment a user returns from their wallet after topping up. A **Check again** button triggers the same re-check on demand.

## Requirement

The reserve is the same value the checkout balance guard uses:

```
(2 + subentry_count + num_sponsoring - num_sponsored) × base_reserve
```

- `base_reserve` comes from Horizon and falls back to `0.5 XLM` (`DEFAULT_BASE_RESERVE_STROOPS`) when unavailable; the lookup is cached per page load.
- The comparison is strictly less-than: a balance **exactly equal** to the reserve is sufficient.
- `shortfall = minimumReserve − nativeBalance`, so the banner can tell the user how much XLM to add.

Balances are handled as stroops (`bigint`) throughout — `parseHorizonNativeBalanceToStroops` converts the Horizon string without float rounding.

## States

| State                                           | Behaviour                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| No wallet connected                             | No lookup, nothing rendered                                                                |
| Balance covers the reserve                      | Nothing rendered                                                                           |
| Balance below the reserve                       | Warning with the balance, the reserve, and the shortfall, plus a re-check button           |
| Account not funded on the network (Horizon 404) | Warning that the account must be funded before it can pay network fees                     |
| Lookup fails (transport error, Horizon down)    | Nothing rendered, `console.warn` only — a failed check is never presented as a low balance |

## Code references

- Pure comparison and detection: `src/lib/wallet/minimumBalance.ts`
- Reserve math and stroop parsing (shared with checkout): `src/lib/checkout/xlmBalance.ts`
- Horizon account load: `src/lib/checkout/accountBalance.ts`
- Hook: `src/hooks/useMinimumBalance.ts`
- UI: `src/components/wallet/MinimumBalanceBanner.tsx`
- Mount point: `src/pages/browse/PromptModal.tsx`
- Copy: `minimumBalance.*` in `src/i18n/locales/*.json` (all seven locales)

## Tests

- Unit: `src/test/wallet/MinimumBalance.test.ts`
- Integration: `src/test/wallet/MinimumBalanceBanner.test.tsx`

Run with:

```bash
yarn test:frontend
```

## Relationship to checkout

[Checkout XLM balance and reserve checks](./checkout-xlm-balance.md) blocks a purchase when the wallet cannot cover the cart total, the fee buffer, **and** the reserve. This warning covers the earlier, wallet-wide case: the account cannot pay fees at all, so every other flow would fail too. Both use the same reserve calculation, so the warning never contradicts the checkout block.

## Related

- [USDC trustline setup guide](./usdc-trustline-guide.md)
- [Supported wallets](./supported-wallets.md)
