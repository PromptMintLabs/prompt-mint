# API Request Schemas

Prompt Mint validates JSON request bodies at the HTTP boundary using shared
[Zod](https://zod.dev) contracts in
[`src/lib/api/requestSchemas.ts`](../src/lib/api/requestSchemas.ts). The same
module is imported by:

- Vercel handlers under `api/auth/` and `api/prompts/`
- The browser unlock client (`src/lib/prompts/unlock.ts`)

Listing metadata rules live in `validateListingMetadata` within the same module
and mirror the Express validator in `server/src/services/listingValidation.ts`
(field limits and error copy are kept aligned via unit tests).

This keeps wire formats aligned without changing Soroban access control:
`has_access` is still evaluated live inside the unlock handler after the body
passes schema validation.

## Schemas

| Schema | Endpoint(s) | Purpose |
|---|---|---|
| `ChallengeRequestBody` | `POST /api/auth/challenge` | Wallet address + on-chain prompt id |
| `UnlockRequestBody` | `POST /api/prompts/unlock` | Challenge token, signature, wallet, prompt id |
| `BuyerLibraryMutationBody` | `POST /api/prompts/buyer/save`, `/unsave` (schema + client guard) | Saved listing mutations |
| `validateListingMetadata` | `POST /api/prompts` (Express) | Creator listing field rules (422 + `fields`) |

Analytics events continue to use the separate taxonomy in
`src/lib/analytics/taxonomy.ts`.

## Field rules and edge cases

### Stellar public keys

`address` / `walletAddress` must be a 56-character `G…` key accepted by
`@stellar/stellar-sdk` (`Keypair.fromPublicKey`). Invalid keys fail with HTTP
`400` and `MISSING_FIELDS` on challenge/unlock (same user-facing copy as
before) or `400` + `fields` on buyer save/unsave.

### Prompt ids

Challenge/unlock `promptId` values must be a non-empty decimal string without
signs or decimals (e.g. `"42"`). The unlock handler still parses with `BigInt`
and calls `has_access` — schema validation does **not** grant access by itself.

### Strict objects

Challenge, unlock, and buyer mutation schemas use `.strict()` so unexpected
fields are rejected instead of silently ignored. Listing creation keeps the
previous tolerant parser (unknown fields are ignored) to remain backward
compatible with older clients.

### Listing metadata

`validateListingMetadata` preserves the historical normalization rules:

- Category aliases (`marketing` → `Marketing`, etc.)
- HTTP(S) image URLs with length caps from `LISTING_FIELD_LIMITS`
- Minimum title/content lengths and strictly positive prices

`LISTING_FIELD_LIMITS` caps are measured in **UTF-8 bytes** (not UTF-16 code
units) and match the on-chain `create_prompt` limits in
`contracts/prompt-hash/src/contract.rs`: `image` 512
(`MAX_IMAGE_URL_LEN`), `title` 120 (`MAX_TITLE_LEN`) and `category` 40
(`MAX_CATEGORY_LEN`). The Express validator in
`server/src/services/listingValidation.ts` and the Mongoose model in
`server/src/models/Prompt.js` use the same values, so HTTP clients cannot
submit listing metadata that the contract will reject (#410).

Failures return HTTP `422` with `{ error, fields }` as documented in
[`docs/api-reference.md`](./api-reference.md).

## Error surfacing

| Layer | Success | Validation failure |
|---|---|---|
| Challenge / unlock API | `200` / downstream auth codes | `400` + `{ error, code: "MISSING_FIELDS" }` |
| Buyer save / unsave (client) | `200` | Client throws before fetch; server still returns `400` for missing fields |
| Create listing | `201` | `422` + `{ error: "Invalid listing metadata", fields }` |

Permission outcomes (`401` invalid signature, `403` access not purchased) are
unchanged and still occur only after a valid unlock body is accepted.

## Tests

- Unit coverage: `src/lib/api/requestSchemas.test.ts`
- Handler coverage: `api/auth/challenge.test.ts`, `api/prompts/unlock.test.ts`

Run `yarn test` from the repo root to execute the Vitest suite.
