# Translator Contribution Guide

How to contribute translations of the PromptHash Stellar interface, email copy decks, and documentation. This guide is for community translators. If you are contributing code instead, start at [CONTRIBUTING.md](../CONTRIBUTING.md).

## Table of Contents

- [What You Can Translate](#what-you-can-translate)
- [Before You Start](#before-you-start)
- [Repository Layout](#repository-layout)
- [Translating the UI](#translating-the-ui)
- [Translating Email Copy Decks](#translating-email-copy-decks)
- [Translating Documentation](#translating-documentation)
- [Style Rules](#style-rules)
- [Plurals, Numbers, and Currency](#plurals-numbers-and-currency)
- [Testing Your Translation](#testing-your-translation)
- [Submitting a Translation](#submitting-a-translation)
- [Review Process](#review-process)
- [Adding a New Language](#adding-a-new-language)
- [Glossary](#glossary)
- [Related](#related)

---

## What You Can Translate

| Surface | Source of truth | Where translations live | Owned by |
| --- | --- | --- | --- |
| UI strings | `src/i18n/locales/en.json` | `src/i18n/locales/<lang>.json` | Frontend |
| Buyer onboarding emails | [buyer-onboarding-email-copy-deck.md](./buyer-onboarding-email-copy-deck.md) | Locale file under `emails.buyer` in the same `locales/` directory | Frontend |
| Creator onboarding emails | [creator-onboarding-email-copy-deck.md](./creator-onboarding-email-copy-deck.md) | Locale file under `emails.creator` | Frontend |
| Documentation | `docs/*.md` | `docs/<lang>/*.md` | Docs |
| Contributor guides | `CONTRIBUTING.md`, `docs/contributor-onboarding-quickstart.md` | `docs/<lang>/` | Docs |

Currently shipped languages: `en` (English), `es` (Spanish), `fr` (French), `zh` (Chinese), `ja` (Japanese), `de` (German), `yo` (Yoruba). See `SUPPORTED_LANGUAGES` in `src/i18n/index.ts`.

**Not translatable by contributors:** legal documents under `docs/legal/`, contract strings, API error codes, on-chain identifiers, and anything in `contracts/`. Legal text is reviewed by counsel, not by the community. If a legal document is unclear, open an issue rather than a translation PR.

---

## Before You Start

- **Open an issue first** for a whole new language. A single locale file with 130+ keys is a large pull request, and the review board wants to commit to maintaining it before it lands. Say which language and which surfaces you are starting with.
- **One language per pull request.** Mixing two locales in one PR doubles the review cost and makes a revert take out good work.
- **Check the locale is not already in progress.** Comment on the tracking issue to claim it. Two people translating the same file independently wastes both of your time.
- **Translate the whole file or add nothing.** A half-translated locale is worse than an absent one, because react-i18next silently falls back to English key by key and the result is a page with two languages on it. See [Testing Your Translation](#testing-your-translation).
- **You need the source in context.** Most keys are short. Run the app and open the screen before you translate the key.

---

## Repository Layout

```text
src/i18n/
  index.ts              # i18next setup, SUPPORTED_LANGUAGES
  locales/
    en.json             # source of truth. Never edit this for a translation.
    es.json
    fr.json
    zh.json
    ja.json
    de.json
    yo.json
docs/
  buyer-onboarding-email-copy-deck.md
  creator-onboarding-email-copy-deck.md
  <lang>/               # translated docs, one directory per language
src/test/docs/          # doc and locale validation tests
```

Every locale file has the same eight top-level sections: `nav`, `home`, `prompt`, `create`, `errors`, `language`, `webhook_replay`, and `number_format`. The seven shipped locales currently carry 132 leaf keys each, and they must stay in lockstep: `yarn test:frontend` fails if a key exists in one locale and not another.

There is no `emails` section in `en.json` today. The English source of record for the copy decks is the markdown itself, not a JSON file, so nothing about the email sequence is covered by the key-parity test. Treat email translations as a separate, optional deliverable: see [Translating Email Copy Decks](#translating-email-copy-decks).

---

## Translating the UI

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<lang>.json` if the file does not exist yet.
2. Translate the leaf values. **Do not** translate the keys. `errors.validation.required` stays `errors.validation.required` in every language, because the code looks it up by that exact path.
3. Keep the nesting shape identical to `en.json`. Do not flatten a section into dotted keys, and do not add a section that `en.json` does not have.
4. Leave interpolation placeholders exactly as they are. See [Plurals, Numbers, and Currency](#plurals-numbers-and-currency).
5. Run the checks in [Testing Your Translation](#testing-your-translation).

```jsonc
// en.json — source
{
  "errors": {
    "validation": {
      "required": "This field is required."
    }
  }
}

// es.json — correct: same shape, translated value
{
  "errors": {
    "validation": {
      "required": "Este campo es obligatorio."
    }
  }
}

// es.json — wrong: renamed key. The lookup now fails and English is shown.
{
  "errors": {
    "validation": {
      "obligatorio": "Este campo es obligatorio."
    }
  }
}
```

---

## Translating Email Copy Decks

Email copy is translated as a block, not key by key, because subject lines, preheaders, and bodies interact: a preheader that reads well on its own can still break the sentence it follows.

**Source:** the English body in the copy deck markdown, inside the fenced ```text``` block under each email. The **Token Reference** table in each deck lists every `{{token}}` and what it resolves to.

**Rules for both decks:**

- Keep the `{{token}}` syntax byte-identical. `{{displayName}}` stays `{{displayName}}`. A single changed character means the token is emitted to the reader as literal text.
- Never translate a token, a wallet address, a transaction hash, or a URL. Never translate `XLM`, `Stellar`, `PromptHash Stellar`, or `SOROBAN`.
- Keep the block structure. If a paragraph is split into two, or two are merged into one, the plain-text alternative and the rendered email diverge.
- Respect the per-deck **Localization** section. The buyer deck and the creator deck have different rules, and the creator deck has a stricter one for moderation copy.
- `CRE-07` is a delisting notice. If your rendering reads softer than the English, it is wrong. Flag it for a second reviewer.
- Do not add emoji. The English source has none, deliberately.

**Where the translation goes.** Both decks declare that an untranslated message falls back to the English source. Add approved translations under an optional `emails` section in the target locale file, keyed by the stable email ID so a translation can never be matched by subject line:

```jsonc
{
  "emails": {
    "buyer": {
      "BUY-01": {
        "subject": "Welcome to PromptHash Stellar",
        "preheader": "Your wallet is the key. Here is what that means for your purchases.",
        "body": "Hi {{displayName}},\n\nYour wallet is now connected to PromptHash Stellar."
      }
    },
    "creator": {
      "CRE-01": {
        "subject": "Selling your first prompt on PromptHash Stellar",
        "preheader": "How listings, encryption, and payouts fit together.",
        "body": "Hi {{displayName}},\n\nYour wallet is now connected to PromptHash Stellar."
      }
    }
  }
}
```

Use the email ID (`BUY-01`, `CRE-07`) as the key, never the subject line. Subject lines get rewritten during A/B tests, and a translation keyed by subject silently stops resolving when one changes.

---

## Translating Documentation

- One directory per language: `docs/es/`, `docs/ja/`, and so on. Mirror the English filename inside it, so `docs/es/creator-onboarding.md` tracks `docs/creator-onboarding.md`.
- **Keep the filenames and headings aligned with the English source.** In-page anchors such as `#step-1-set-up-your-freighter-wallet` are generated from headings. If you translate a heading, every inbound link to that anchor breaks. Translate the prose, and keep the heading text, or add an explicit anchor if the tooling supports it.
- **Keep code blocks, commands, file paths, and environment variable names in English.** Translate the surrounding explanation only. A reader has to be able to paste a command and have it work.
- **Keep relative links working.** Point `../creator-onboarding.md` at the translated file when it exists, and at the English file when it does not.
- **Do not translate `docs/legal/`,** and do not translate the tables in [monorepo-map.md](./monorepo-map.md) that map to CI workflow filenames.
- Update the English source in the same PR when a translation exposed a wording bug. A translation PR that fixes English copy is two pull requests, not one.

---

## Style Rules

- **Address the reader the way the target language normally addresses customers.** Formal in `fr` and `ja`, neutral and direct in `zh`. Do not import the English informal register.
- **Keep sentences short.** A translation that needs two clauses to carry what the English does in one has usually lost a concrete noun. Go back to the source word.
- **Prefer the plainest correct word.** This is a payments product used by independent operators. "Buy" beats "acquire", "price" beats "monetary consideration".
- **Do not invent UI that does not exist.** If a string refers to a button, the button is a real button in the app. Check it before you translate it.
- **Do not translate error codes.** `op_underfunded` is a contract error identifier, not prose.
- **Keep capitalization conventions of the target language**, not of English. Sentence case everywhere except the start of the sentence, unless the product name requires otherwise.
- **No emoji** in UI strings, emails, or docs, unless the English source already has one.
- **No machine output.** Do not paste an unedited machine translation into a pull request. If you used a machine tool to bootstrap, say so in the PR description and expect every string to be reviewed.

---

## Plurals, Numbers, and Currency

This is where most translation bugs live.

- **Never append `s` to build a plural.** Some shipped languages need more than two plural forms. Use the plural rules of the target language.
- **Keep interpolation placeholders intact** and do not move them across a clause boundary unless the target grammar requires it and the source token list still resolves. The `en.json` strings currently use simple `{{param}}` interpolation; if a target language needs a plural category, raise it rather than inlining "s" into the source string.
- **XLM is never rounded in a way that misstates the amount.** Amounts come from stroops (bigint). Use `formatXlmLocale(stroops, "stroops", locale)` or the `useXlmFormatter()` hook from `src/lib/i18n-number.ts`.
- **Never hard-code an `en-US` locale.** Passing a fixed locale to `toLocaleString` overrides the reader's language selection and is a defect, not a style choice. Pass `undefined` or the active `i18n.language`. `src/lib/i18n-number.test.ts` covers the helpers; `src/test/i18nNumberFormat.test.ts` covers the formatting rules.
- **Do not translate decimal or grouping separators.** Locale-aware formatting handles them.
- **Keep currency symbols out of translated strings.** `XLM` is a unit, not a word to translate, and the symbol belongs to the formatter.

---

## Testing Your Translation

Run these before you open a pull request. All three are the checks CI runs.

```bash
yarn test:frontend        # includes the i18n and locale-parity tests
yarn lint
yarn typecheck
```

What the suite checks for translations specifically:

- **Key parity.** Every key in `en.json` exists in your locale, and your locale has no extra keys. A missing key falls back to English silently at runtime, which is why the test treats it as a failure.
- **No raw keys in output.** `i18n.t(key)` must not return the key itself for any locale.
- **Interpolation integrity.** Placeholders in the source survive into the translated string.
- **Docs coverage.** `src/test/docs/` validates the doc tree, including the copy decks and their structure.

Check your work in the running app before you push:

```bash
yarn dev
```

Then switch languages with the in-app language selector. The selector reads from `SUPPORTED_LANGUAGES` and persists the choice to `localStorage` under `ph-lang`. Look for English text that leaked through on the screens you translated — a leaked string means a key is missing or misspelled, and the test may not have caught it if it is behind a flag.

---

## Submitting a Translation

1. Branch from `main`.
2. Make the translation change. One language per pull request.
3. Run the checks above.
4. Open a pull request that states:
   - the language and the surfaces you translated (UI, buyer emails, creator emails, docs)
   - whether you are a native speaker of the target language
   - anything you deliberately left untranslated, and why
   - anything in the English source you think is wrong
5. Tag the review request per the areas in [monorepo-map.md](./monorepo-map.md): UI locale changes need a Frontend review, doc translations need a Docs review, and a new locale that touches emails needs both.

In the PR description, do not paste the whole diff of the JSON. Point at the screens or the email IDs instead.

---

## Review Process

- **Native-speaker review is required** before a locale is marked complete. A second native speaker reviews the moderation and money-related copy in both decks — `BUY-02`, `BUY-05`, `CRE-03`, `CRE-07`, and `CRE-08` — because those are the strings where an imprecise translation misstates funds or a moderation decision.
- **Reviewers check meaning, not style preference.** A different but accurate word choice is not a blocking comment. A missing safety caveat is.
- **English changes land first.** When the English source changes, translations lag until the next translation pass. That is expected; reviewers should not block a translation PR on untranslated new English.
- **Corrections are preferred over reverts.** If a locale has drifted, open a fix PR. Do not delete a locale that has users.

---

## Adding a New Language

Adding a language is a code change, not just a translation. Per [CONTRIBUTING.md](../CONTRIBUTING.md), the full set is:

1. Add `src/i18n/locales/<lang>.json` with the complete key set from `en.json`.
2. Import it in `src/i18n/index.ts` and add it to the `resources` map.
3. Add `{ code: "<lang>", label: "<endonym>" }` to `SUPPORTED_LANGUAGES`. Use the language's own name for the label, not the English name.
4. No changes to the formatting helpers are required. `formatXlmLocale` and the formatter hooks already accept a locale string.
5. Translate the email copy decks, or leave the `emails` section out entirely. If it is absent, sends fall back to the English source, which is a valid state.
6. Extend `src/test/i18nErrors.test.ts` and any other test that enumerates locales, so the new locale is covered rather than skipped.
7. Run `yarn test:frontend`, `yarn lint`, and `yarn typecheck`.
8. Document the addition in the locale list above and in `docs/faq.md` if the FAQ names the supported languages.

Open an issue before starting. Steps 1 through 3 are small, but the review board is committing to maintaining the locale indefinitely, and that commitment should be explicit.

---

## Glossary

Keep these consistent across every surface. Where the English product uses a fixed term, the translation should too.

| English | Notes |
| --- | --- |
| PromptHash Stellar | Product name. Never translated. "PromptHash" alone is the protocol; "PromptHash Stellar" is the app. |
| prompt | A licensable listing. Not "template", not "AI asset". |
| listing | A published prompt for sale. Not "product", not "NFT". |
| preview | The public part of a listing, visible before purchase. Not "excerpt", not "sample". |
| unlock | The signed request that returns the decrypted plaintext to the buyer. Not "download", not "redeem". |
| access | An on-chain entitlement tied to a wallet. Not "subscription", not "licence key". |
| wallet | The buyer's or creator's Stellar account. The product has no other account type. |
| buyer / creator | The two roles. Keep them distinct; do not merge into "user" in a translation. |
| XLM | The settlement unit. Never translated, never symbol-substituted in a string. |
| price | What a buyer pays. Distinct from fee. |
| fee | The platform fee, routed on-chain. Never soften to "service charge" or "commission". |
| payout | The amount routed to the creator after the fee. Distinct from "revenue". |
| delist | A moderation decision that unpublishes a listing. Not "removed", not "hidden". |
| appeal | The creator's path to contest a delisting. Not "dispute", not "complaint". |
| review | A rating plus comment on a listing. |
| reactivation | Returning a delisted listing to the marketplace after review. |

---

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) — contribution rules that apply to translation PRs too
- [monorepo-map.md](./monorepo-map.md) — which area reviews which file
- [buyer-onboarding-email-copy-deck.md](./buyer-onboarding-email-copy-deck.md) — buyer email copy and its localization rules
- [creator-onboarding-email-copy-deck.md](./creator-onboarding-email-copy-deck.md) — creator email copy and its localization rules
- [contributor-onboarding-quickstart.md](./contributor-onboarding-quickstart.md) — environment setup for running the app
- [frontend-testing.md](./frontend-testing.md) — the testing pattern to follow when you add coverage
- [faq.md](./faq.md) — user-facing answers translations must stay consistent with
