# Deterministic Local Stellar Test Fixtures

PromptHash ships an in-memory, deterministic fixture system so tests never touch
testnet, mainnet, Friendbot, or any external RPC. Every account, prompt, purchase,
transfer, and dispute is derived from a known seed domain (`prompt-hash-local`)
and stays identical across runs, machines, and CI.

## Quick start — provision fixtures with one command

No provisioning scripts, no container orchestration, no funding steps.
Just import and go:

```ts
import { getFixtures } from "@/test/fixtures/stellar-local";

const { accounts, prompts, purchases, licenseTransfers, disputes } = getFixtures();
```

That single import gives you:

| Resource          | Count | Description                                         |
| ----------------- | ----- | --------------------------------------------------- |
| Accounts          | 7     | admin, fee_wallet, creator1/2, buyer1/2/3           |
| Prompts           | 5     | active, inactive, expired, high-volume, zero-sales  |
| Purchases         | 3     | cross-creator/buyer purchase history                |
| License transfers | 2     | forward and reverse resale records                  |
| Disputes          | 1     | open dispute for testing resolution flows           |

## Fixture isolation from testnet / mainnet

- **Zero network calls.** No Horizon, no Soroban RPC, no Friendbot. Every fixture
  object is a plain TypeScript value created in memory.
- **Separate network passphrase.** The config uses `Standalone Network ; February 2017`
  so even if a test accidentally submits a transaction, it cannot collide with
  testnet (`Test SDF Network ; September 2015`) or mainnet.
- **Deterministic seed domain.** All keypairs are derived from
  `SHA-256("prompt-hash-local:<label>")`. This domain prefix does not overlap
  with any production or staging derivation scheme.
- **No persistent state.** Fixtures live in a module-level singleton. Calling
  `resetFixtures()` rebuilds everything from scratch with no side effects.

## Resetting state without Friendbot or RPC

Call `resetFixtures()` in a `beforeEach` block to guarantee test isolation:

```ts
import { describe, it, beforeEach, expect } from "vitest";
import { getFixtures, resetFixtures } from "@/test/fixtures/stellar-local";

describe("purchase flow", () => {
  beforeEach(() => {
    resetFixtures();
  });

  it("deducts balance on purchase", () => {
    const { accounts, prompts } = getFixtures();

    // Mutate fixture state freely — it resets for the next test
    accounts.buyer1.balanceXlm -= 5;
    prompts.push(/* … */);

    expect(accounts.buyer1.balanceXlm).toBe(495);
  });

  it("starts fresh — previous test's mutations are gone", () => {
    const { accounts } = getFixtures();
    expect(accounts.buyer1.balanceXlm).toBe(500); // back to original
  });
});
```

`resetFixtures()` is pure TypeScript — no blockchain RPC, no Friendbot funding,
no container restart. It simply reassigns the cached singleton to a fresh
`createLocalFixtures()` snapshot.

## Fixture schemas

### `LocalFixtureSchema` (root)

```ts
interface LocalFixtureSchema {
  name: string;                                    // "local-deterministic-v1"
  accounts: Record<string, LocalAccount>;          // 7 accounts keyed by label
  prompts: PromptRecord[];                         // 5 prompt listings
  purchases: LocalPurchase[];                      // 3 purchase records
  licenseTransfers: LocalLicenseTransfer[];        // 2 transfer records
  disputes: LocalDispute[];                        // 1 dispute record
}
```

### `LocalAccount`

| Field        | Type   | Sample value                                      | Description                     |
| ------------ | ------ | ------------------------------------------------- | ------------------------------- |
| `seed`       | string | `"SDG3…XYZ"` (S… secret key)                     | Deterministic secret (NEVER use on mainnet) |
| `publicKey`  | string | `"GDG3…XYZ"` (G… public key)                     | Deterministic public key        |
| `label`      | string | `"creator1"`                                      | Matches a SeedPolicy label      |
| `balanceXlm` | number | `1_000`                                           | Declared XLM balance            |

### `LocalPurchase`

| Field              | Type    | Sample value                      | Description                     |
| ------------------ | ------- | --------------------------------- | ------------------------------- |
| `purchaseId`       | string  | `"purchase-1"`                    | Stable record identifier        |
| `promptId`         | bigint  | `1n`                              | Which prompt was purchased      |
| `buyer`            | string  | `"GC…"` (G… address)             | Buyer's public key              |
| `originalCreator`  | string  | `"GC…"` (G… address)             | Original creator's public key   |
| `originalPrice`    | bigint  | `5_0000000n` (5 XLM in stroops)  | Price paid in stroops           |
| `purchasedAt`      | number  | `1_753_139_200`                   | Unix timestamp (seconds)        |
| `expiresAt`        | number  | `0` (0 = never)                   | Unix timestamp of access expiry |

### `LocalLicenseTransfer`

| Field            | Type    | Sample value                  | Description                   |
| ---------------- | ------- | ----------------------------- | ----------------------------- |
| `transferId`     | string  | `"transfer-1"`                | Stable record identifier      |
| `promptId`       | bigint  | `1n`                          | Transferred prompt ID         |
| `fromAddress`    | string  | `"GC…"` (G… seller)          | Seller's public key           |
| `toAddress`      | string  | `"GC…"` (G… buyer)           | New owner's public key        |
| `resalePrice`    | bigint  | `4_0000000n` (4 XLM)          | Resale price in stroops       |
| `transferredAt`  | number  | `1_753_174_800`               | Unix timestamp (seconds)      |

### `LocalDispute`

| Field        | Type    | Sample value                                         | Description                 |
| ------------ | ------- | ---------------------------------------------------- | --------------------------- |
| `disputeId`  | string  | `"dispute-1"`                                        | Stable record identifier    |
| `promptId`   | bigint  | `3n`                                                 | Prompt under dispute        |
| `buyer`      | string  | `"GC…"` (G…)                                        | Buyer who filed             |
| `creator`    | string  | `"GC…"` (G…)                                        | Creator being disputed      |
| `reason`     | string  | `"Prompt content does not match the description."`   | Human-readable reason       |
| `status`     | string  | `"open"`                                             | `"open"`, `"resolved"`, or `"escalated"` |
| `filedAt`    | number  | `1_753_193_600`                                      | Unix timestamp (seconds)    |

### `PromptRecord` (reused from `@/lib/stellar/promptHashClient`)

| Field             | Type      | Sample value                                        | Description              |
| ----------------- | --------- | --------------------------------------------------- | ------------------------ |
| `id`              | bigint    | `1n`                                                | Unique listing ID        |
| `creator`         | string    | creator1's public key                               | Creator's G… address     |
| `imageUrl`        | string    | `"https://fixtures.local/prompt-1.png"`             | Listing image URL        |
| `title`           | string    | `"GPT-4 Technical Architect"`                       | Listing title            |
| `category`        | string    | `"Development"`                                     | Category                 |
| `previewText`     | string    | `"Generate scalable system design documents…"`      | Public preview           |
| `description`     | string    | `"A comprehensive prompt for…"`                     | Full description         |
| `tags`            | string[]  | `["AI", "Architecture"]`                            | Search tags              |
| `encryptedPrompt` | string    | `"enc-local-0000…0001"`                             | Ciphertext placeholder   |
| `encryptionIv`    | string    | `"iv-local-0000…0001"`                              | IV placeholder           |
| `wrappedKey`      | string    | `"wrapped-local-00…0001"`                           | Wrapped key placeholder  |
| `contentHash`     | string    | `"a1b2c3d4…"` (64 hex chars)                        | Content fingerprint      |
| `priceStroops`    | bigint    | `5_0000000n` (5 XLM)                                | Price in stroops         |
| `active`          | boolean   | `true`                                              | Whether listing is active|
| `salesCount`      | number    | `2`                                                 | Total purchases          |

## Seed policy

All keypairs are derived deterministically from `SHA-256("prompt-hash-local:<label>")`.
The resulting 32-byte hash is used as a raw Ed25519 seed via `Keypair.fromRawEd25519Seed`.

| Label       | Intended role                          | Balance  |
| ----------- | -------------------------------------- | -------- |
| `admin`     | Contract administrator                 | 10,000 XLM |
| `fee_wallet`| Platform fee collection wallet         | 5,000 XLM |
| `creator1`  | Primary prompt creator (3 listings)    | 1,000 XLM |
| `creator2`  | Secondary prompt creator (2 listings)  | 1,000 XLM |
| `buyer1`    | Active buyer (2 purchases, 2 transfers)| 500 XLM   |
| `buyer2`    | Occasional buyer (1 purchase, 1 transfer received) | 500 XLM |
| `buyer3`    | New buyer — zero purchases             | 100 XLM   |

### Security notes

1. **These keys are PUBLIC.** The derivation uses a well-known domain string.
   Anyone who knows `prompt-hash-local:admin` can recompute the admin secret key.
2. **Do not reuse on testnet or mainnet.** These seeds exist for deterministic
   local tests only. Production code should use `Keypair.random()` or a secure
   entropy source with BIP-39 / SLIP-0010 derivation.
3. **No key persistence.** Secrets are re-derived on every module load. There is
   no file, env var, or vault dependency.
4. **Accidental submission is harmless.** The fixture config uses `Standalone
   Network ; February 2017` as its passphrase, so any transaction signed with
   these keys would fail against testnet or mainnet RPCs.

## Expected balances

All values are declared — no on-chain funding. Use these for balance-assertion
tests.

| Account     | Balance (XLM) | Balance (stroops)     |
| ----------- | ------------- | --------------------- |
| `admin`     | 10,000        | 100,000,0000000       |
| `fee_wallet`| 5,000         | 50,000,0000000        |
| `creator1`  | 1,000         | 10,000,0000000        |
| `creator2`  | 1,000         | 10,000,0000000        |
| `buyer1`    | 500           | 5,000,0000000         |
| `buyer2`    | 500           | 5,000,0000000         |
| `buyer3`    | 100           | 1,000,0000000         |

Import stroops-friendly constants:

```ts
import { EXPECTED_BALANCES, EXPECTED_BALANCES_STROOPS } from "@/test/fixtures/stellar-local";

expect(wallet.balance).toBe(EXPECTED_BALANCES.buyer1);               // 500
expect(contractBalance).toBe(EXPECTED_BALANCES_STROOPS.creator1);   // 10_000_0000000n
```

## Usage examples

### Basic: render a component with fixture data

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@/test/render";
import { getFixtures, resetFixtures } from "@/test/fixtures/stellar-local";
import { PromptHashClient } from "@/lib/stellar/promptHashClient";
import BrowsePage from "@/pages/Browse";

vi.mock("@/lib/stellar/promptHashClient");

describe("Browse page with local fixtures", () => {
  beforeEach(() => {
    resetFixtures();
    vi.clearAllMocks();
  });

  it("renders all 5 fixture prompts", async () => {
    const { prompts } = getFixtures();
    vi.mocked(PromptHashClient.getAllPrompts).mockResolvedValue(prompts);

    render(<BrowsePage />);

    expect(await screen.findByText("GPT-4 Technical Architect")).toBeVisible();
    expect(await screen.findByText("Zero-Sales Fresh Listing")).toBeVisible();
  });

  it("hides inactive prompt #3", async () => {
    const { prompts } = getFixtures();
    const activeOnly = prompts.filter((p) => p.active);
    vi.mocked(PromptHashClient.getAllPrompts).mockResolvedValue(activeOnly);

    render(<BrowsePage />);

    await screen.findByText("GPT-4 Technical Architect");
    expect(screen.queryByText("SEO Content Optimizer")).toBeNull();
  });
});
```

### Factory overrides for specific scenarios

```ts
import { makeLocalPrompt, CREATOR1_PUBKEY } from "@/test/fixtures/stellar-local";

const expiredPrompt = makeLocalPrompt({
  id: 99n,
  title: "Expired Listing",
  active: true,
  priceStroops: 1_0000000n,
  creator: CREATOR1_PUBKEY,
});

const zeroSupplyPrompt = makeLocalPrompt({
  id: 100n,
  title: "Sold Out",
  active: false,
  salesCount: 999,
});
```

### Testing license transfer flows

```ts
it("transfers license from buyer1 to buyer3", () => {
  const { licenseTransfers, accounts } = getFixtures();

  // Simulate a new transfer
  licenseTransfers.push({
    transferId: "transfer-3",
    promptId: 4n,
    fromAddress: accounts.buyer1.publicKey,
    toAddress: accounts.buyer3.publicKey,
    resalePrice: 2_5000000n,
    transferredAt: Date.now() / 1000,
  });

  expect(licenseTransfers).toHaveLength(3); // 2 built-in + 1 simulated
});
```

### Testing dispute resolution

```ts
it("marks dispute as resolved", () => {
  const { disputes } = getFixtures();
  expect(disputes[0].status).toBe("open");

  disputes[0].status = "resolved";

  expect(disputes[0].status).toBe("resolved");
});
```

### Building a custom fixture with inline overrides

```ts
import { createLocalFixtures, makeLocalPrompt } from "@/test/fixtures/stellar-local";

const fixtures = createLocalFixtures();

// Replace one prompt with a custom scenario
fixtures.prompts[0] = makeLocalPrompt({
  id: 1n,
  title: "Custom Scenario Prompt",
  priceStroops: 99_0000000n, // 99 XLM
  active: false,
});

// Add an extra purchase
fixtures.purchases.push({
  purchaseId: "custom-purchase",
  promptId: 5n,
  buyer: fixtures.accounts.buyer3.publicKey,
  originalCreator: fixtures.accounts.creator2.publicKey,
  originalPrice: 2_0000000n,
  purchasedAt: Date.now() / 1000,
  expiresAt: 0,
});
```

## Reference

- Source: `src/test/fixtures/stellar-local.ts`
- Prompt record type: `src/lib/stellar/promptHashClient.ts` (`PromptRecord`)
- Contract types: `contracts/prompt-hash/src/types.rs`
- Environment config: `environments.toml`
- Test setup: `src/test/setup.ts`
- Test guide: `docs/frontend-testing.md`
