# Creator Onboarding Email Copy Deck

Approved subject lines, preheaders, and body copy for the emails a **creator** receives after they connect a wallet, list a first prompt, and hit the operational events that follow. This is the creator-side companion to [buyer-onboarding-email-copy-deck.md](./buyer-onboarding-email-copy-deck.md).

## Table of Contents

- [Scope](#scope)
- [Voice and Tone](#voice-and-tone)
- [Sending Rules](#sending-rules)
- [Compliance Rules](#compliance-rules)
- [Token Reference](#token-reference)
- [CRE-01 — Welcome After Wallet Connect](#cre-01--welcome-after-wallet-connect)
- [CRE-02 — Publish Your First Listing](#cre-02--publish-your-first-listing)
- [CRE-03 — First Sale](#cre-03--first-sale)
- [CRE-04 — Review Received](#cre-04--review-received)
- [CRE-05 — Listing Quality Nudge](#cre-05--listing-quality-nudge)
- [CRE-06 — Draft Saved Reminder](#cre-06--draft-saved-reminder)
- [CRE-07 — Reactivation After Delisting](#cre-07--reactivation-after-delisting)
- [CRE-08 — Monthly Earnings Summary](#cre-08--monthly-earnings-summary)
- [Localization](#localization)
- [Related](#related)

---

## Scope

| Question | Answer |
| --- | --- |
| Who receives these? | Creators only: a wallet that has connected, and where relevant created at least one listing. |
| Who does not receive these? | Buyers. Buyer copy lives in [buyer-onboarding-email-copy-deck.md](./buyer-onboarding-email-copy-deck.md). |
| Is it a campaign or a lifecycle sequence? | Lifecycle. Each trigger fires once per qualifying state change. |
| Are moderation decisions in scope? | Only `CRE-07`, which notifies a creator that a listing was delisted and points at the appeal path. Individual flagged reports are not emailed. |
| What is out of scope? | Any message that would promise the creator income, quote them a price floor, or tell them what to write in a listing. |

Every email is keyed by a stable ID (`CRE-01` … `CRE-08`). Use the ID in code, in analytics events, and in bug reports; never refer to an email by its subject line, because subject lines get rewritten during A/B tests.

---

## Voice and Tone

- **Creator-first, never patronising.** The reader has already written something worth selling. Write to a peer who is deciding how to present their work, not to a beginner being scolded.
- **Plain, not clever.** One idea per sentence. The reader is an independent prompt engineer, not a marketer on a team.
- **Specific over impressive.** Name the actual action ("Add a preview", "Reply to the review") rather than "grow your presence".
- **Never promise income.** No "earn passive income", no "this will make you money", no sample earnings, no price suggestions. Creators set their own prices and the copy must not make the platform look like it is coaching them on pricing.
- **Never coach the content.** The deck tells a creator what the product does; it does not tell them what to write. Writing advice belongs in [creator-onboarding.md](./creator-onboarding.md), which the deck links to rather than inlines.
- **Straight about moderation.** Say a listing was delisted, say why in plain terms, and point at the appeal path. No euphemism, no "we noticed a small issue".
- **Emoji budget: zero.** Transactional mail from a payments product reads as unprofessional with emoji. This differs from the existing reactivation template in [FEATURES-721-724.md](./FEATURES-721-724.md); the lifecycle sequence supersedes it, and the change is called out in [Sending Rules](#sending-rules).

---

## Sending Rules

- **Opt-in is enforced in code, not by copy.** Every send path checks `notificationPreferences.emailNotifications` before building a message and skips the send when it is `false`. See `server/src/services/emailNotifications.ts` and `server/src/services/reactivationEmailService.ts`.
- **One-click unsubscribe is mandatory.** Every body carries a `{{unsubscribeUrl}}` link and the transport sets the `List-Unsubscribe` header. Copy must not be the only way out.
- **Suppression is permanent.** An unsubscribe token is HMAC-signed (`server/src/services/unsubscribeToken.ts`) and covers the whole lifecycle sequence, including `CRE-07`, because a delisting notice and a payout notice travel in the same thread.
- **Never send a draft's body back to the creator.** Draft and listing content is encrypted at rest and is decrypted in the browser. `CRE-06` links back into the app and never quotes what was written.
- **Plain-text first.** Ship a `text/plain` alternative carrying the same information and the same unsubscribe link.
- **This deck is the source of record.** Where an existing service template in [FEATURES-721-724.md](./FEATURES-721-724.md) disagrees with the copy below, the deck wins and the service template is updated in the same PR. Do not ship a message that exists only in code.
- **Idempotency.** A trigger fires once per state transition. `CRE-03` is keyed on the transaction hash; `CRE-07` is keyed on the moderation decision.
- **Localization is part of the send.** If the creator's active `i18n.language` has no approved translation, send the English source. Never fall back to machine output. See [Localization](#localization) and [translator-contribution-guide.md](./translator-contribution-guide.md).
- **Support is the escalation path.** `Reply-To` is `{{supportEmail}}`; the body does not invite replies for marketing sends.

---

## Compliance Rules

- **No legal name collection.** The product does not collect names or physical addresses ([legal/data-retention-policy.md](./legal/data-retention-policy.md)). `{{displayName}}` resolves to the optional `username` field and falls back to `{{walletShort}}`.
- **Accurate sender identity.** `From` is whatever `EMAIL_FROM_ADDRESS` is configured to, defaulting to `PromptHash <noreply@prompthash.io>`. The brand name in the body must match the `From` line.
- **Transactional vs. marketing.** `CRE-03`, `CRE-04`, `CRE-07`, and `CRE-08` are transactional and go to any address with email notifications enabled. `CRE-01`, `CRE-02`, `CRE-05`, and `CRE-06` are marketing and require a prior opt-in.
- **No financial advice and no fee ambiguity.** `{{priceXlm}}` and the fee treatment are stated exactly as the contract computes them. Never round a payout, never describe the platform fee as "small" or "low", and never quote a percentage that differs from [fee-model-and-split-math.md](./fee-model-and-split-math.md).
- **No unearned claims about access rights.** Do not tell a creator their listing is "permanent" or "immutable". Listings are creator-controlled and can be edited, delisted, or taken down under [takedown-policy.md](./takedown-policy.md).
- **Moderation copy names the reason.** `CRE-07` must state the recorded reason and link to the appeal path. It must not speculate on the outcome of an appeal or on the reporter's identity.
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
| `{{priceXlm}}` | Listing or sale price in XLM | Formatted with `formatXlmLocale(stroops, "stroops", locale)` from `src/lib/i18n-number.ts`. Never hard-code an `en-US` locale. |
| `{{netPayoutXlm}}` | Amount credited after the platform fee | Must be the contract's computed value, never a locally recalculated estimate. |
| `{{platformFeeXlm}}` | Platform fee in XLM | Shown alongside `{{netPayoutXlm}}` in `CRE-03` and `CRE-08`. |
| `{{salesCount}}` | Count of sales in the reporting window | Whole number. |
| `{{salesCountPlural}}` | Locale-correct plural suffix for `{{salesCount}}` | Empty where the language does not need a suffix. |
| `{{grossXlm}}` | Sum of buyer payments in the reporting window | `CRE-08` only. |
| `{{txHashList}}` | Truncated transaction hashes for the reporting window | `CRE-08` only. One per line, every sale in the period. |
| `{{monthLabel}}` | Localised month and year, e.g. "March 2026" | Never an ISO date string. |
| `{{draftCount}}` | Count of unpublished saved drafts | `CRE-06` only. |
| `{{delistedCount}}` | Number of delisted listings | `CRE-07` only. |
| `{{delistReason}}` | Recorded moderation reason | `CRE-07` only. Never invent a reason when none is recorded. |
| `{{reviewRating}}` | Rating attached to the review | `CRE-04` only. |
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

## CRE-01 — Welcome After Wallet Connect

- **Trigger:** Wallet connected for the first time and the creator has an email address on file with `notificationPreferences.emailNotifications` enabled.
- **Segment:** New creators, no listings.
- **Goal:** Explain the creator model in one screen and set expectations about payouts.
- **Send window:** Within 5 minutes of the first successful connect.
- **Subject:** Selling your first prompt on PromptHash Stellar
- **Preheader:** How listings, encryption, and payouts fit together.
- **Body:**

```text
Hi {{displayName}},

Your wallet is now connected to PromptHash Stellar, so you can list prompts.

The short version of the model:

- You write a prompt and set a price in XLM. You choose the price; the
  platform does not set it for you and does not tell you what to charge.
- The full text of your listing is encrypted. Buyers see a public preview and
  pay to unlock the rest.
- When a buyer unlocks, the payment is recorded on Stellar and your share is
  routed on-chain by the contract. There is no invoice, no payout button,
  and no withdrawal step.
- Your listing is tied to {{walletShort}}. Whoever controls that wallet owns
  the listing and receives the payments.

Two things to read before you publish:

- The best-practices guide, which covers previews, pricing, and what makes a
  listing convert: {{appUrl}}/docs/creator-onboarding
- The licence terms that apply to everything you publish.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Start a listing → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer. No earnings claim, no price suggestion, no example payout figure.
- **Success metric:** Share of recipients who save a draft within 14 days.

---

## CRE-02 — Publish Your First Listing

- **Trigger:** A listing saved as a draft and left unpublished for 72 hours. **Never send the draft's content.**
- **Segment:** New creators with at least one unpublished draft.
- **Goal:** Get the first listing live, which is the step everything else depends on.
- **Send window:** 72 hours after the first saved draft, once per wallet.
- **Subject:** Your draft is saved and ready when you are
- **Preheader:** Publishing is one click. Nothing is public until you choose to publish.
- **Body:**

```text
Hi {{displayName}},

You have a draft saved in your creator dashboard. It is still private, and it
stays private until you publish it.

To publish:

1. Open your creator dashboard and select the draft.
2. Check the preview text. It is the only part buyers see before they pay, so
   it needs to stand on its own.
3. Set the price. The preview does not include the full text; the encrypted
   payload does.
4. Publish.

Nothing is listed until step 4, and you can edit or unlist a published
listing at any time. Editing replaces the content for buyers who have not yet
unlocked; buyers who already unlocked keep what they received.

If you would rather read about pricing and previews first, the
best-practices guide covers both.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Open your dashboard → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer. This email must not quote, summarise, or preview the draft content, and must not include a suggested price.
- **Success metric:** Drafts published within 7 days of the send.

---

## CRE-03 — First Sale

- **Trigger:** The creator's first confirmed on-chain sale. **Transactional.** Sent regardless of marketing opt-in.
- **Segment:** All creators, on each sale.
- **Goal:** Tell the creator exactly what they were paid, what the fee was, and what the buyer can see.
- **Send window:** Immediately after the sale transaction is confirmed.
- **Subject:** Your first sale: {{promptTitle}}
- **Preheader:** {{netPayoutXlm}} XLM routed to {{walletShort}}.
- **Body:**

```text
Hi {{displayName}},

{{walletShort}} has a sale.

  Listing:      {{promptTitle}}
  Buyer paid:   {{priceXlm}} XLM
  Platform fee: {{platformFeeXlm}} XLM
  Your payout:  {{netPayoutXlm}} XLM
  Transaction:  {{txHash}}

What just happened:

- The buyer paid {{priceXlm}} XLM. The purchase is recorded on the Stellar
  network and is visible on the public ledger.
- The contract routed your share on-chain. There is nothing for you to claim
  and no balance for you to withdraw from us.
- The buyer can now unlock the full text by signing a request from their own
  wallet.

Two things worth knowing:

- Anyone can read the transaction on the public ledger. The transaction shows
  the price and the wallets involved. The prompt content itself stays
  encrypted until the buyer unlocks it.
- Reviews can arrive later. You will get a separate email, and you can reply
  from your dashboard.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Open your dashboard → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer, plus a direct reply invitation, which is permitted for transactional mail. `{{netPayoutXlm}}` and `{{platformFeeXlm}}` must come from the contract's computed split, and the three amounts must reconcile to the listing price.
- **Success metric:** Creator opens the dashboard within 48 hours. The reconciliation of the three amounts is a correctness check, not a copy check, and is covered by the fee-split tests.

---

## CRE-04 — Review Received

- **Trigger:** A review posted for a listing the creator owns. **Transactional.**
- **Segment:** Creators with at least one review.
- **Goal:** Tell the creator a response is expected and where to write it.
- **Send window:** Within 1 hour of the review being recorded.
- **Subject:** New {{reviewRating}}-star review on {{promptTitle}}
- **Preheader:** You can reply publicly from your dashboard.
- **Body:**

```text
Hi {{displayName}},

Someone reviewed "{{promptTitle}}" with {{reviewRating}} stars.

You can write one public reply from your dashboard. A reply sits under the
review and is visible to anyone reading the listing.

Two rules, because they are enforced:

- You cannot vote on your own listing's reviews, and you cannot review it
  yourself.
- Keep the reply to the product. Personal disagreements, disputes about
  another buyer, and off-platform contact details are removed.

You do not have to reply. An unanswered review is not penalised.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Read and reply → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer, plus a direct reply invitation. Never reproduce the reviewer's wallet address, and never send the review text back to the creator by email — the review is shown in the dashboard.
- **Success metric:** Creator response rate within 14 days. See [reviews-and-moderation.md](./reviews-and-moderation.md) for how responses are counted.

---

## CRE-05 — Listing Quality Nudge

- **Trigger:** A published listing with zero previews viewed after 14 days.
- **Segment:** Creators with at least one published listing.
- **Goal:** Improve listing presentation without dictating content.
- **Send window:** Day 14 after publish, once per listing.
- **Subject:** "{{promptTitle}}" has not been opened yet
- **Preheader:** The preview is doing all the work before anyone pays.
- **Body:**

```text
Hi {{displayName}},

"{{promptTitle}}" has been live for two weeks and nobody has opened it. That
is usually a presentation problem rather than a quality problem, and it is
fixable without rewriting anything.

In rough order of how much they matter:

1. The preview. It is the only text a buyer can read before paying. Buyers
   scan the first two lines and leave if those do not say what the prompt
   does and who it is for.
2. The title. Specific beats clever. "Email sequence for a product launch"
   tells a buyer more than "Prompt Pro".
3. The category. A listing filed under a broad category competes with
   everything; a narrow one competes with its actual peers.
4. The price relative to its category. Only worth revisiting if the other
   three are already right.

The best-practices guide goes into all four with examples.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Review the listing → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer. This email may describe what a preview needs to accomplish; it must not draft, suggest, or generate preview text on the creator's behalf.
- **Success metric:** Preview views on the listing within 14 days of the send.

---

## CRE-06 — Draft Saved Reminder

- **Trigger:** Two or more saved drafts with none published, after 14 days.
- **Segment:** Creators who started and stalled.
- **Goal:** Get at least one listing live, which is the highest-leverage thing a stalled creator can do.
- **Send window:** Day 14, once per wallet per quarter.
- **Subject:** You have {{draftCount}} drafts and no live listings
- **Preheader:** Publishing one is worth more than perfecting three.
- **Body:**

```text
Hi {{displayName}},

You have {{draftCount}} saved drafts and nothing published. Your drafts are
private and will stay that way.

The honest advice is that one published listing teaches you more than three
finished ones. You find out what buyers respond to, what they ask in
reviews, and whether your price is in the right range. None of that is
visible before a listing is live.

If a draft is not ready, publish a different one. You can edit it, unlist it,
or raise the price whenever you like.

If none of them are ready yet, ignore this and come back when they are. There
is no penalty for an empty storefront.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Open your drafts → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer. Must not summarise, quote, or preview draft content, and must not include a suggested price. `{{draftCount}}` is a whole number and takes a locale-correct plural.
- **Success metric:** At least one listing published within 30 days.

---

## CRE-07 — Reactivation After Delisting

- **Trigger:** A moderation decision that delisted one or more of the creator's listings within `REACTIVATION_DELIST_LOOKBACK_DAYS`. **Transactional.** Implemented in `server/src/services/reactivationEmailService.ts`.
- **Segment:** Creators with at least one delisted listing.
- **Goal:** State the decision, name the reason, and give the appeal path.
- **Send window:** Within 24 hours of the decision; once per decision.
- **Subject:** {{delistedCount}} of your listings were delisted
- **Preheader:** The reason, what to change, and how to appeal.
- **Body:**

```text
Hi {{displayName}},

A moderation decision delisted {{delistedCount}} of your listings.

  Reason recorded: {{delistReason}}
  Affected wallet: {{walletShort}}

What this means:

- The listing is no longer visible in the marketplace and new buyers cannot
  purchase it.
- Access already granted to existing buyers is not affected. You are not
  being asked to refund anyone, and buyers are not being revoked.
- The on-chain history of the listing, including any sales, is unchanged.

To reactivate:

1. Open your dashboard and review the delisted listings.
2. Address the recorded reason. The reason above is the one reviewers used.
3. Resubmit for review from the dashboard.

If you believe the decision is wrong, you can appeal. The appeal path and the
full policy are here: {{appUrl}}/docs/takedown

The policy is the same one applied to every listing, and it is the version
that was in effect when the decision was made.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Review the delisted listings → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer, plus a direct reply invitation. `{{delistReason}}` must come from the recorded moderation reason. If no reason is recorded, send this email with the line "Reason recorded: not recorded" and open a moderation ticket; do not substitute a generic reason, and never speculate about the reporter.
- **Success metric:** Resubmission within 30 days; median time from decision to resubmission.

---

## CRE-08 — Monthly Earnings Summary

- **Trigger:** The creator's local month end, if the wallet had at least one sale in the period. **Transactional.**
- **Segment:** Creators with sales in the reporting window.
- **Goal:** Give a complete, reconcilable statement of the period.
- **Send window:** Monthly, within 3 days of month end.
- **Subject:** {{monthLabel}}: {{salesCount}} sale{{salesCountPlural}} on PromptHash Stellar
- **Preheader:** Every amount, every fee, and the transaction hashes behind them.
- **Body:**

```text
Hi {{displayName}},

Here is your {{monthLabel}} summary for {{walletShort}}.

  Sales:          {{salesCount}}
  Buyer payments: {{grossXlm}} XLM
  Platform fees:  {{platformFeeXlm}} XLM
  Your payouts:   {{netPayoutXlm}} XLM
  Transactions:   {{txHashList}}

The three XLM figures reconcile: buyer payments minus platform fees equals
your payouts. Every payout was routed by the contract on Stellar at the moment
of the sale, so this statement is a summary of on-chain history, not a
statement from our balance sheet. We never hold your funds.

If a line looks wrong, reply with the transaction hash and we will trace it.

{{appUrl}}/?tab=sell

— The PromptHash Stellar team
```

- **Primary CTA:** Open your dashboard → `{{appUrl}}/?tab=sell`
- **Footer / compliance:** Shared footer, plus a direct reply invitation. The three XLM figures must reconcile exactly, and `{{txHashList}}` must list every transaction in the period so the buyer of the statement can verify it independently.
- **Success metric:** Zero reconciliation mismatches; support contacts per statement.

---

## Localization

- Every email in this deck is a source string to be translated. Send rules are in [translator-contribution-guide.md](./translator-contribution-guide.md).
- **Do not translate:** `{{…}}` tokens, `XLM`, `Stellar`, `PromptHash Stellar`, `SOROBAN`, wallet addresses, transaction hashes, and moderation reason codes as emitted by the API. Keep the `{{token}}` syntax byte-identical, or interpolation silently emits the raw token to the creator.
- **Do translate:** preheaders, CTA labels, and any sentence containing a unit or a date convention. `{{monthLabel}}` is localised as a month name, not an ISO string.
- **Plurals:** `{{salesCount}}` is a count, and several languages need more than two plural forms. Use the plural rules of the target locale rather than appending "s". `{{salesCountPlural}}` carries the locale-correct suffix and is empty where the language does not need one.
- **Register:** creators are independent operators. Keep it peer-to-peer in every language; do not drift into second-person plural address in `fr` or into deferential form in `ja` for the moderation emails, where precision matters more than warmth.
- **Moderation copy is not softened in translation.** If a target-language rendering of `CRE-07` reads as less serious than the English, that is a bug. Ask for a second reviewer on that email specifically.
- If a locale has no approved translation, the send falls back to the English source in this file. It never falls back to machine output.

---

## Related

- [buyer-onboarding-email-copy-deck.md](./buyer-onboarding-email-copy-deck.md) — buyer-side lifecycle copy
- [translator-contribution-guide.md](./translator-contribution-guide.md) — how to translate this deck
- [creator-onboarding.md](./creator-onboarding.md) — the creator workflow the emails point at
- [product-journeys.md](./product-journeys.md) — the creator journey these emails follow
- [reviews-and-moderation.md](./reviews-and-moderation.md) — how reviews and delisting decisions work
- [takedown-policy.md](./takedown-policy.md) — the policy `CRE-07` points at
- [fee-model-and-split-math.md](./fee-model-and-split-math.md) — the split `CRE-03` and `CRE-08` must match
- [legal/data-retention-policy.md](./legal/data-retention-policy.md) — what the platform stores about a creator
- [FEATURES-721-724.md](./FEATURES-721-724.md) — existing reactivation campaign service
