# Buyer Onboarding Email Copy Deck

Approved subject lines, preheaders, and body copy for the emails a **buyer** receives after they connect a wallet, and in the first weeks after a first purchase. This is the buyer-side companion to [creator-onboarding-email-copy-deck.md](./creator-onboarding-email-copy-deck.md) and to the platform-wide [Overview](./overview.md).

## Table of Contents

- [Scope](#scope)
- [Voice and Tone](#voice-and-tone)
- [Sending Rules](#sending-rules)
- [Compliance Rules](#compliance-rules)
- [Token Reference](#token-reference)
- [BUY-01 — Welcome After Wallet Connect](#buy-01--welcome-after-wallet-connect)
- [BUY-02 — Your Wallet Is Ready](#buy-02--your-wallet-is-ready)
- [BUY-03 — First Browse Nudge](#buy-03--first-browse-nudge)
- [BUY-04 — Cart Reminder](#buy-04--cart-reminder)
- [BUY-05 — Purchase Receipt and Access Granted](#buy-05--purchase-receipt-and-access-granted)
- [BUY-06 — Unlock Troubleshooting](#buy-06--unlock-troubleshooting)
- [BUY-07 — Library Digest](#buy-07--library-digest)
- [BUY-08 — Winback](#buy-08--winback)
- [Localization](#localization)
- [Related](#related)

---

## Scope

| Question | Answer |
| --- | --- |
| Who receives these? | Buyers only: a wallet that has connected on the frontend and, where relevant, completed at least one purchase. |
| Who does not receive these? | Creators. Creator copy lives in [creator-onboarding-email-copy-deck.md](./creator-onboarding-email-copy-deck.md). |
| Is it a campaign or a lifecycle sequence? | Lifecycle. Triggered events fire once per qualifying state change, not on a schedule. |
| Are the winback and reactivation campaigns in scope? | Only [BUY-08](#buy-08--winback). The reactivation campaign targets creators and is in the creator deck. |
| What is out of scope? | Listing moderation notices, dispute outcomes, security alerts, and any message that would require the platform to collect a legal name. |

Every email below is keyed by a stable ID (`BUY-01` … `BUY-08`). Use the ID in code, in analytics events, and in bug reports; never refer to an email by its subject line, because subject lines get rewritten during A/B tests.

---

## Voice and Tone

- **Wallet-first.** The wallet address is the identity. There is no account password, no sign-up form, and no profile to complete. Never write "verify your account" or "confirm your email address" — neither gate exists.
- **Plain, not clever.** A reader is a buyer comparing prompts, not a crypto trader. One idea per sentence, short paragraphs, no idiom that needs a second read.
- **Specific over impressive.** Name the actual action ("Buy now in XLM", "Open your library") instead of "Explore the marketplace".
- **Never promise outcomes.** No income claims, no "guaranteed", no "risk-free", no price predictions, no FOMO timers. The buyer is spending their own XLM and they should feel informed, not sold to.
- **Respectful of the reader's funds.** Fees, XLM amounts, and the fee split are stated plainly when they are relevant, never hidden behind "fees may apply".
- **Emoji budget: zero.** Transactional mail from a payments product reads as unprofessional with emoji. This differs from the existing winback/reactivation campaign templates in [FEATURES-721-724.md](./FEATURES-721-724.md); the lifecycle sequence supersedes them, and the change is called out in [Sending Rules](#sending-rules).

---

## Sending Rules

- **Opt-in is enforced in code, not by copy.** Every send path checks `notificationPreferences.emailNotifications` before building a message, and sends are skipped when the preference is `false`. See `server/src/services/emailNotifications.ts`, `server/src/services/winbackEmailService.ts`, and `server/src/models/User.js`.
- **One-click unsubscribe is mandatory.** Every email body carries a `{{unsubscribeUrl}}` link and the transport sets the `List-Unsubscribe` header, so mail clients can offer a native unsubscribe. Copy must not be the only way out.
- **Suppression is permanent.** An unsubscribe token is HMAC-signed (`server/src/services/unsubscribeToken.ts`) and covers the whole lifecycle sequence, not a single message.
- **Plain-text first.** Ship a `text/plain` alternative with the same information and the same unsubscribe link. Image-only layouts are not acceptable.
- **This deck is the source of record.** Where an existing service template in [FEATURES-721-724.md](./FEATURES-721-724.md) disagrees with the copy below, the deck wins and the service template is updated in the same PR. Do not ship a message that exists only in code.
- **Idempotency.** A trigger fires once per state transition. Re-running a job must not resend; the `BUY-05` send is keyed on the transaction hash.
- **Localization is part of the send.** If the buyer's active `i18n.language` has no translation for the message, send the English source and do not guess a translation. See [Localization](#localization) and [translator-contribution-guide.md](./translator-contribution-guide.md).
- **Support is the escalation path, not the reply path.** Set `Reply-To` to `{{supportEmail}}` and keep the body free of "just reply to this email" instructions for transactional messages.

---

## Compliance Rules

- **No legal name collection.** The product does not collect names or physical addresses ([legal/data-retention-policy.md](./legal/data-retention-policy.md)). `{{displayName}}` resolves to the optional `username` field and falls back to `{{walletShort}}`; it must never be populated from a name field that the platform does not store.
- **Accurate sender identity.** The `From` address is whatever `EMAIL_FROM_ADDRESS` is configured to, defaulting to `PromptHash <noreply@prompthash.io>`. The body must show the same brand name as the `From` line.
- **Transactional vs. marketing.** Purchases, receipts, and unlock help are transactional and go to any address with `emailNotifications` enabled. `BUY-01`, `BUY-02`, `BUY-03`, `BUY-07`, and `BUY-08` are marketing and require a prior opt-in; a wallet that has never opted in receives none of them.
- **No fabricated urgency.** Countdown timers, "limited stock", and "X buyers are viewing" are prohibited. They are not testable against on-chain state.
- **No on-chain claims we cannot prove.** Do not state that an access right is permanent, irrevocable, or transferable. Access is an on-chain entitlement checked by the contract; describe it as "your access stays with your wallet" and link to the docs.
- **Accessibility.** Every link has descriptive text, no link text is "click here", and the body is readable in plain text.

---

## Token Reference

Only these tokens may appear in the copy below. A token that is not in this table is a bug.

| Token | Resolves to | Notes |
| --- | --- | --- |
| `{{appUrl}}` | `APP_URL` | Base URL, no trailing slash. |
| `{{displayName}}` | `User.username`, else `{{walletShort}}` | Never a legal name. |
| `{{walletShort}}` | Truncated wallet, first 6 + last 4 characters | Use `GB...MPTH` style ellipsis, not a full address. |
| `{{promptTitle}}` | Listing title | Plain text, no markdown. |
| `{{creatorName}}` | Creator `username`, else `{{walletShort}}` | |
| `{{priceXlm}}` | Purchase price in XLM | Formatted with `formatXlmLocale(stroops, "stroops", locale)` from `src/lib/i18n-number.ts`. Never hard-code an `en-US` locale. |
| `{{category}}` | Listing category label | Omit the surrounding sentence when empty; never send a dangling separator. |
| `{{daysSinceLastPurchase}}` | Whole days since the buyer's last purchase | `BUY-07`, `BUY-08`. |
| `{{inactiveWindowDays}}` | Value of `WINBACK_INACTIVE_DAYS` | `BUY-08` only. A campaign setting, not a measurement, so it is a distinct token from `{{daysSinceLastPurchase}}`. |
| `{{txHash}}` | Stellar transaction hash | Truncated to 12 characters plus a link to the explorer. |
| `{{unsubscribeUrl}}` | Signed one-click unsubscribe URL | Required in every email. |
| `{{supportEmail}}` | `SUPPORT_EMAIL` | |

### Shared footer

Every email in this deck ends with this block, unmodified:

```text
You are receiving this email because you use PromptHash Stellar with the
wallet {{walletShort}}. Notification preferences live in your account
settings.

Unsubscribe: {{unsubscribeUrl}}
Support: {{supportEmail}}
```

---

## BUY-01 — Welcome After Wallet Connect

- **Trigger:** Wallet connected for the first time and the buyer has an email address on file with `notificationPreferences.emailNotifications` enabled.
- **Segment:** New buyers, no purchases.
- **Goal:** Set expectations about what a wallet connection does and does not do, and give one next step.
- **Send window:** Within 5 minutes of the first successful connect.
- **Subject:** Welcome to PromptHash Stellar
- **Preheader:** Your wallet is the key. Here is what that means for your purchases.
- **Body:**

```text
Hi {{displayName}},

Your wallet is now connected to PromptHash Stellar.

A few things worth knowing up front:

- There is no account to create. No password, no email confirmation, no
  profile to finish. Your wallet is the account.
- What you buy is tied to this wallet, not to an email address or a
  profile. Keep access to {{walletShort}} safe.
- Prices are in XLM and payments settle on Stellar. Your wallet needs a
  small XLM balance to cover network fees on top of the prompt price.
- Prompt previews are public. The full text stays encrypted until your
  purchase is confirmed on-chain and your wallet signs the unlock request.

Start here: browse listings and open any prompt to read the preview before
you spend anything.

{{appUrl}}/browse

— The PromptHash Stellar team
```

- **Primary CTA:** Browse listings → `{{appUrl}}/browse`
- **Footer / compliance:** Shared footer. No unsubscribe required for a single welcome, but the link is included for consistency.
- **Success metric:** Share of recipients who open a listing preview within 7 days.

---

## BUY-02 — Your Wallet Is Ready

- **Trigger:** 24 hours after `BUY-01` with no preview opened and no purchase.
- **Segment:** New buyers, no purchases, still unactivated.
- **Goal:** Remove the single most common first-run blocker, which is an underfunded or unfunded wallet.
- **Send window:** 24 hours after `BUY-01`, once per wallet.
- **Subject:** Before you buy: check your XLM balance
- **Preheader:** A wallet with no XLM cannot pay network fees. Here is the one-minute check.
- **Body:**

```text
Hi {{displayName}},

Most first purchases on PromptHash Stellar do not go through for one reason:
the wallet does not have enough XLM to cover the network fee on top of the
listing price.

Two numbers to know:

- The listing price, which goes to the creator.
- A small network fee, which pays for recording the transaction on Stellar.

Check the balance in your wallet before you buy. If it is low, add XLM first.
On testnet, test XLM is free from a public faucet.

Nothing here is set up for you. PromptHash Stellar never holds your funds and
cannot top up your wallet on your behalf.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Open the app → `{{appUrl}}`
- **Footer / compliance:** Shared footer. Do not add a countdown or scarcity line.
- **Success metric:** First purchase conversion for recipients versus the un-sent control group.

---

## BUY-03 — First Browse Nudge

- **Trigger:** 5 days after connect, at least 3 previews viewed, no purchase.
- **Segment:** Engaged new buyers, no purchases.
- **Goal:** Convert research into a first purchase without discounting.
- **Send window:** Day 5 after connect.
- **Subject:** Still deciding? Compare previews side by side
- **Preheader:** Three ways to narrow a long catalogue down to one prompt.
- **Body:**

```text
Hi {{displayName}},

You have looked at a few listings but have not bought one yet. That is a
normal place to be. Here is how buyers usually decide:

1. Read the preview, not the title. The preview is public and is the honest
   part of the listing.
2. Filter by category. A focused category beats a general one when you are
   comparing quality.
3. Check the creator's other listings. A consistent body of work is a better
   signal than any single listing.

When you are ready, buying is two steps: pay in XLM, then sign one unlock
request with {{walletShort}}. You keep access to what you bought.

{{appUrl}}/browse

— The PromptHash Stellar team
```

- **Primary CTA:** Browse by category → `{{appUrl}}/browse`
- **Footer / compliance:** Shared footer. If `{{category}}` is known, add one line under step 2: "You have been looking mostly at {{category}}." If it is not known, drop the line rather than sending an empty placeholder.
- **Success metric:** First purchase within 14 days of the send.

---

## BUY-04 — Cart Reminder

- **Trigger:** Cart with at least one listing, no checkout started for 24 hours. **The cart is browser-local state** (`src/lib/cart`), so this email can only be sent when the buyer has also opted into email and the send is driven by a server-known signal. If the cart cannot be reconstructed server-side, do not send this email at all.
- **Segment:** Buyers with an abandoned cart.
- **Goal:** Recover the intent without discounting.
- **Send window:** 24 hours after the last cart change; maximum two sends.
- **Subject:** Your cart is still open on PromptHash Stellar
- **Preheader:** No rush and no countdown. Prices are set by the creators.
- **Body:**

```text
Hi {{displayName}},

You left something in your cart the other day.

We are not running a sale, because the creators set their own prices and we do
not change them behind their backs. What we can tell you is what happens when
you do check out:

- You pay the listed price in XLM, plus a small network fee.
- The purchase is recorded on Stellar and is visible on the public ledger.
- Your access is unlocked by signing one request from {{walletShort}}.

If the price no longer works for you, walk away. There is no penalty and
nothing expires.

{{appUrl}}/?tab=buy

— The PromptHash Stellar team
```

- **Primary CTA:** Return to cart → `{{appUrl}}`
- **Footer / compliance:** Shared footer. Never add "your cart expires" or "price increases soon" — listing prices are creator-controlled and can change for unrelated reasons.
- **Success metric:** Checkout completion within 48 hours.

---

## BUY-05 — Purchase Receipt and Access Granted

- **Trigger:** A confirmed on-chain purchase for the wallet. **Transactional.** Sent to any address with email notifications enabled, regardless of marketing opt-in.
- **Segment:** All buyers, on every purchase.
- **Goal:** Give the buyer an unambiguous record of what they bought, what they paid, and how to get the content.
- **Send window:** Immediately after the purchase transaction is confirmed.
- **Subject:** Receipt: {{promptTitle}}
- **Preheader:** Access to this prompt now belongs to {{walletShort}}.
- **Body:**

```text
Hi {{displayName}},

Your purchase is confirmed.

  Prompt:   {{promptTitle}}
  Creator:  {{creatorName}}
  Price:    {{priceXlm}} XLM
  Paid to:  the creator, less the platform fee described in the listing
  Transaction: {{txHash}}
  Access:   wallet {{walletShort}}

To read the full prompt:

1. Open your library and select the listing.
2. Sign the unlock request with {{walletShort}}.
3. The plaintext is decrypted in your browser and is never sent back to our
   servers.

If the unlock fails, reply to this email with the transaction hash and we will
look at it. A failed unlock is almost always a wallet on the wrong network or
a wallet without enough XLM for the fee.

This purchase is recorded on the Stellar network and cannot be reversed by
anyone, including us. Keeping control of {{walletShort}} is the only way to
keep access to this prompt.

{{appUrl}}/?tab=buy

— The PromptHash Stellar team
```

- **Primary CTA:** Open your library → `{{appUrl}}/?tab=buy`
- **Footer / compliance:** Shared footer, plus a direct reply invitation, which is permitted for transactional mail. State the fee treatment exactly as the contract does it; see [fee-model-and-split-math.md](./fee-model-and-split-math.md) and never soften it into "low fees".
- **Success metric:** Successful unlock within 24 hours. This is the most important metric in the deck: a purchase that cannot be opened is a support incident.

---

## BUY-06 — Unlock Troubleshooting

- **Trigger:** A purchase for the wallet with no successful unlock in the 6 hours since the purchase, or a second failed unlock attempt.
- **Segment:** Buyers with a stuck purchase.
- **Goal:** Resolve the failure without a support ticket.
- **Send window:** 6 hours after `BUY-05`, or immediately after a second failed attempt.
- **Subject:** Your prompt is paid for but not unlocked yet
- **Preheader:** Four checks that fix this about nine times out of ten.
- **Body:**

```text
Hi {{displayName}},

{{walletShort}} owns the access to "{{promptTitle}}", but the unlock has not
completed. The purchase is fine. Work through these in order:

1. Confirm your wallet is on the same network as the purchase. Switching
   networks is the most common cause.
2. Confirm the wallet holds enough XLM to pay the unlock fee. Unlocking is a
   separate transaction from the purchase.
3. Reconnect the wallet. The unlock request is signed by the wallet, so it
   has to be the one that made the purchase.
4. Try the unlock again from your library, not from a shared browser session
   or a different device.

If all four fail, reply to this email with the transaction hash. Do not send
your private key, your seed phrase, or a screenshot of it. We do not need it
and we will never ask for it.

{{appUrl}}/?tab=buy

— The PromptHash Stellar team
```

- **Primary CTA:** Retry unlock → `{{appUrl}}/?tab=buy`
- **Footer / compliance:** Shared footer. The "we will never ask for your seed phrase" line is mandatory in this email and must not be edited out.
- **Success metric:** Successful unlock within 24 hours of the send; ticket rate per stuck purchase.

---

## BUY-07 — Library Digest

- **Trigger:** At least 3 owned prompts and no purchase in 30 days. Marketing.
- **Segment:** Engaged, lapsed buyers.
- **Goal:** Remind buyers that their library is an asset they already own, without pushing them to spend.
- **Send window:** Monthly, on the buyer's local anniversary of the first purchase.
- **Subject:** {{daysSinceLastPurchase}} days since your last purchase
- **Preheader:** Your library is still yours. No checkout required.
- **Body:**

```text
Hi {{displayName}},

You have not bought a prompt in {{daysSinceLastPurchase}} days, which is
completely fine. This is not a "you are falling behind" email.

It is a short note that the prompts you already bought are still in your
wallet, and that you can keep using them:

- They do not expire and there is no subscription to cancel.
- You can unlock any of them again at any time, because unlocking is a
  signature, not a download limit.
- If you lose access to {{walletShort}}, you lose access to all of them.

If you are in the market for something new, {{category}} has new listings this
month. If you are not, you can ignore this entirely.

{{appUrl}}/?tab=buy

— The PromptHash Stellar team
```

- **Primary CTA:** Open your library → `{{appUrl}}/?tab=buy`
- **Footer / compliance:** Shared footer. Drop the `{{category}}` sentence when the category is unknown. Never reframe the library as an investment or imply appreciation.
- **Success metric:** Library opens and any unlock activity; track separately from purchases so a re-engagement send is not credited for a spend it did not cause.

---

## BUY-08 — Winback

- **Trigger:** No purchase in `WINBACK_INACTIVE_DAYS`. Marketing. Implemented in `server/src/services/winbackEmailService.ts`.
- **Segment:** Buyers with at least one historical purchase, opted in.
- **Goal:** Bring back a genuinely lapsed buyer with useful information rather than a discount.
- **Send window:** Once per `WINBACK_INACTIVE_DAYS` window.
- **Subject:** Still building with what you bought?
- **Preheader:** New listings in the categories you have bought from before.
- **Body:**

```text
Hi {{displayName}},

It has been {{daysSinceLastPurchase}} days since your last purchase on
PromptHash Stellar.

You do not need to buy anything. Prompts you already own keep working, and
unlocking them again costs only the network fee.

If you do want something new, the {{category}} category has grown since you
last looked, and new listings in the same style tend to price lower than the
first ones in a category.

Two honest notes:

- We are not offering a discount in this email. Prices belong to the
  creators, and a discount from us would be a discount from them.
- We will not send another one of these for {{inactiveWindowDays}} days.

{{appUrl}}/browse

— The PromptHash Stellar team
```

- **Primary CTA:** See new listings → `{{appUrl}}/browse`
- **Footer / compliance:** Shared footer. Drop the `{{category}}` sentence when the category is unknown. `{{inactiveWindowDays}}` must render the configured `WINBACK_INACTIVE_DAYS` value, not `{{daysSinceLastPurchase}}`, and if the two numbers differ the copy must still read correctly.
- **Success metric:** Purchase within 30 days, measured against a holdout group so the deck is not credited for organic demand.

---

## Localization

- Every email in this deck is a source string to be translated. Send rules are in [translator-contribution-guide.md](./translator-contribution-guide.md).
- **Do not translate:** `{{…}}` tokens, `XLM`, `Stellar`, `PromptHash Stellar`, wallet addresses, and transaction hashes. Keep the `{{token}}` syntax byte-identical, or interpolation silently emits the raw token to the buyer.
- **Do translate:** preheaders, CTA labels, and any sentence containing a unit or a date convention. German and Japanese expansions can run to 1.4× the English character count; keep layouts flexible enough to absorb that.
- **Plurals:** `{{daysSinceLastPurchase}}` is a count, and several languages need more than two plural forms. Use the plural rules of the target locale rather than appending "s".
- **Register:** buyers, not traders. Formal address in `ja` and `fr`, informal in `en` and `es`, and a neutral business register in `zh`.
- If a locale has no approved translation, the send falls back to the English source in this file. It never falls back to machine output.

---

## Related

- [creator-onboarding-email-copy-deck.md](./creator-onboarding-email-copy-deck.md) — creator-side lifecycle copy
- [translator-contribution-guide.md](./translator-contribution-guide.md) — how to translate this deck
- [product-journeys.md](./product-journeys.md) — the buyer journey these emails follow
- [faq.md](./faq.md) — wallet-first answers the copy must stay consistent with
- [legal/data-retention-policy.md](./legal/data-retention-policy.md) — what the platform stores about a buyer
- [FEATURES-721-724.md](./FEATURES-721-724.md) — existing winback and reactivation campaign services
