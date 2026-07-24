import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";
import type { PromptRecord, PromptHashConfig } from "@/lib/stellar/promptHashClient";

// =============================================================================
// Deterministic Ed25519 seed derivation
//
// Every keypair is deterministically derived from SHA-256(domain:label).
// This stays constant across runs, machines, and CI — no randomness, no RPC.
// =============================================================================

function deriveSeed(label: string): Buffer {
  return Buffer.from(createHash("sha256").update(label).digest());
}

function deriveKeypair(label: string): Keypair {
  return Keypair.fromRawEd25519Seed(deriveSeed(label));
}

// =============================================================================
// LocalFixtureSchema – shape of all fixture data
// =============================================================================

export interface LocalAccount {
  /** S… secret key (deterministic – never use on mainnet) */
  seed: string;
  /** G… public key */
  publicKey: string;
  /** Human-readable label matching SeedPolicy */
  label: string;
  /** Declared XLM balance (not stroops) */
  balanceXlm: number;
}

export interface LocalPurchase {
  /** Stable identifier for this purchase record */
  purchaseId: string;
  /** Prompt ID that was purchased */
  promptId: bigint;
  /** G… address of the buyer */
  buyer: string;
  /** G… address of the original creator */
  originalCreator: string;
  /** Price paid in stroops */
  originalPrice: bigint;
  /** Unix timestamp (seconds) when purchase was made */
  purchasedAt: number;
  /** Unix timestamp (seconds) when access expires (0 = never) */
  expiresAt: number;
}

export interface LocalLicenseTransfer {
  /** Stable identifier for this transfer record */
  transferId: string;
  /** Prompt ID whose license was transferred */
  promptId: bigint;
  /** G… address of the seller */
  fromAddress: string;
  /** G… address of the new owner */
  toAddress: string;
  /** Resale price in stroops */
  resalePrice: bigint;
  /** Unix timestamp (seconds) when the transfer occurred */
  transferredAt: number;
}

export interface LocalDispute {
  /** Stable identifier for this dispute */
  disputeId: string;
  /** Prompt ID under dispute */
  promptId: bigint;
  /** G… address of the buyer who filed */
  buyer: string;
  /** G… address of the creator */
  creator: string;
  /** Human-readable reason for the dispute */
  reason: string;
  /** Current dispute status */
  status: "open" | "resolved" | "escalated";
  /** Unix timestamp (seconds) when the dispute was filed */
  filedAt: number;
}

export interface LocalFixtureSchema {
  /** Human-readable snapshot name (versioned) */
  name: string;
  /** Deterministic accounts keyed by policy label */
  accounts: Record<string, LocalAccount>;
  /** Prompt listings (5 records) */
  prompts: PromptRecord[];
  /** Purchase records (3 records) */
  purchases: LocalPurchase[];
  /** License transfer history (2 records) */
  licenseTransfers: LocalLicenseTransfer[];
  /** Disputes (1 record) */
  disputes: LocalDispute[];
}

// =============================================================================
// SeedPolicy
// =============================================================================

export const SeedPolicy = {
  /**
   * Domain prefix used for seed derivation.
   * Full derivation: SHA-256("prompt-hash-local:<label>") → raw 32-byte Ed25519 seed.
   */
  domain: "prompt-hash-local",

  description:
    "All keypairs are derived deterministically via Ed25519 using " +
    "SHA-256(domain + \":\" + label) as the raw 32-byte seed. " +
    "The same label always produces the same keypair across runs, machines, and CI.",

  /**
   * Every label and its intended role in the fixture ecosystem.
   *
   *   LABEL       | ROLE
   *   ------------+------------------------------------------------------
   *   admin       |  Contract administrator; deploys and upgrades
   *   fee_wallet  |  Platform fee collection wallet
   *   creator1    |  Primary prompt creator (3 listings)
   *   creator2    |  Secondary prompt creator (2 listings)
   *   buyer1      |  Active buyer (multiple purchases, license transfers)
   *   buyer2      |  Occasional buyer (single purchase, receives transfer)
   *   buyer3      |  New buyer with zero purchases (cold-start testing)
   */
  labels: [
    { label: "admin", role: "Contract administrator" },
    { label: "fee_wallet", role: "Platform fee collection wallet" },
    { label: "creator1", role: "Primary prompt creator (3 listings)" },
    { label: "creator2", role: "Secondary prompt creator (2 listings)" },
    { label: "buyer1", role: "Active buyer (2 purchases, 1 transfer in, 1 transfer out)" },
    { label: "buyer2", role: "Occasional buyer (1 purchase, receives 1 transfer)" },
    { label: "buyer3", role: "New buyer – zero purchases (cold-start testing)" },
  ],

  /**
   * SECURITY NOTES
   *
   * 1. These seeds are PUBLIC and deterministic. Never reuse them on testnet or mainnet.
   * 2. The derivation is intentionally trivial (SHA-256 of a well-known label) so
   *    that anyone can recompute the same keypairs. This is safe ONLY for local
   *    in-memory fixtures that never touch a real network.
   * 3. All private keys are re-derived on every instantiation; no persistence is
   *    required and resetFixtures() does not change keypairs.
   * 4. If you need testnet/mainnet fixtures, use a separate seed derivation
   *    scheme with actual random or BIP-39 entropy — never reuse these seeds.
   */
  security: [
    "PUBLIC seeds — never use on testnet or mainnet",
    "Trivial SHA-256 derivation — suitable only for local deterministic tests",
    "Re-derived on every instantiation — no persistent key storage",
  ],
} as const;

// =============================================================================
// Derive all fixture keypairs once at module load
// =============================================================================

const _DOMAIN = SeedPolicy.domain;

const _KP = {
  admin: deriveKeypair(`${_DOMAIN}:admin`),
  fee_wallet: deriveKeypair(`${_DOMAIN}:fee_wallet`),
  creator1: deriveKeypair(`${_DOMAIN}:creator1`),
  creator2: deriveKeypair(`${_DOMAIN}:creator2`),
  buyer1: deriveKeypair(`${_DOMAIN}:buyer1`),
  buyer2: deriveKeypair(`${_DOMAIN}:buyer2`),
  buyer3: deriveKeypair(`${_DOMAIN}:buyer3`),
} as const;

// =============================================================================
// Exported public keys (stable across runs)
// =============================================================================

export const ADMIN_PUBKEY = _KP.admin.publicKey();
export const FEE_WALLET_PUBKEY = _KP.fee_wallet.publicKey();
export const CREATOR1_PUBKEY = _KP.creator1.publicKey();
export const CREATOR2_PUBKEY = _KP.creator2.publicKey();
export const BUYER1_PUBKEY = _KP.buyer1.publicKey();
export const BUYER2_PUBKEY = _KP.buyer2.publicKey();
export const BUYER3_PUBKEY = _KP.buyer3.publicKey();

// =============================================================================
// Expected balances (XLM)
//
// These are declared balances for the in-memory fixture. No Friendbot funding
// is used; tests that need balance checks should compare against these values.
//
//   ACCOUNT      | BALANCE (XLM) | BALANCE (stroops)
//   -------------+---------------+-----------------------
//   admin        |      10,000   |   100_000_0000000
//   fee_wallet   |       5,000   |    50_000_0000000
//   creator1     |       1,000   |    10_000_0000000
//   creator2     |       1,000   |    10_000_0000000
//   buyer1       |         500   |     5_000_0000000
//   buyer2       |         500   |     5_000_0000000
//   buyer3       |         100   |     1_000_0000000
// =============================================================================

export const EXPECTED_BALANCES = {
  admin: 10_000,
  fee_wallet: 5_000,
  creator1: 1_000,
  creator2: 1_000,
  buyer1: 500,
  buyer2: 500,
  buyer3: 100,
} as const;

/**
 * Same balances expressed as stroops (bigint) for contract-level assertions.
 */
export const EXPECTED_BALANCES_STROOPS: Record<keyof typeof EXPECTED_BALANCES, bigint> = {
  admin: 100_000_0000000n,
  fee_wallet: 50_000_0000000n,
  creator1: 10_000_0000000n,
  creator2: 10_000_0000000n,
  buyer1: 5_000_0000000n,
  buyer2: 5_000_0000000n,
  buyer3: 1_000_0000000n,
};

// =============================================================================
// Local-network PromptHashConfig (no RPC needed)
// =============================================================================

export const LOCAL_PROMPT_HASH_CONFIG: PromptHashConfig = {
  rpcUrl: "http://localhost:8000/soroban/rpc",
  networkPassphrase: "Standalone Network ; February 2017",
  allowHttp: true,
  promptHashContractId: "CDETERMINISTICLOCALCONTRACT00000000000000000000000000000000000001",
  nativeAssetContractId: "CB47E3A9F1B0C24D5E6F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0",
  simulationAccount: ADMIN_PUBKEY,
};

// =============================================================================
// Prompt fixture factory
// =============================================================================

/**
 * Creates a PromptRecord with sane local-fixture defaults.
 * Override any field for scenario-specific tests.
 */
export function makeLocalPrompt(overrides: Partial<PromptRecord> = {}): PromptRecord {
  return {
    id: 1n,
    creator: CREATOR1_PUBKEY,
    imageUrl: "https://fixtures.local/prompt-default.png",
    title: "Local Fixture Prompt",
    category: "Development",
    previewText: "A deterministic test prompt generated by local fixtures.",
    description: "Generated by local test fixtures for deterministic, repeatable testing.",
    tags: ["test", "fixture", "local"],
    encryptedPrompt: "enc-local-0000000000000000000000000000",
    encryptionIv: "iv-local-0000000000000000000000000000",
    wrappedKey: "wrapped-local-00000000000000000000000000",
    contentHash: "0".repeat(64),
    priceStroops: 5_0000000n,
    active: true,
    salesCount: 0,
    ...overrides,
  };
}

// =============================================================================
// Pre-built prompt fixtures (5 records)
//
//   ID | TITLE                        | CREATOR   | PRICE   | ACTIVE | SALES | NOTES
//   ---+------------------------------+-----------+---------+--------+-------+------------------------
//    1 | GPT-4 Technical Architect    | creator1  | 5 XLM   | yes    |     2 | Popular, has purchases
//    2 | Creative Storyteller Pro     | creator2  | 10 XLM  | yes    |     1 | Mid-tier, has a purchase
//    3 | SEO Content Optimizer        | creator1  | 7.5 XLM | no     |     3 | INACTIVE (delisted), disputed
//    4 | Smart Contract Auditor       | creator1  | 3 XLM   | yes    |     5 | High-volume, lowest price
//    5 | Zero-Sales Fresh Listing     | creator2  | 2 XLM   | yes    |     0 | Zero-state listing
// =============================================================================

export const LOCAL_PROMPTS: PromptRecord[] = [
  {
    id: 1n,
    creator: CREATOR1_PUBKEY,
    imageUrl: "https://fixtures.local/prompt-1.png",
    title: "GPT-4 Technical Architect",
    category: "Development",
    previewText: "Generate scalable system design documents with detailed architecture plans.",
    description:
      "A comprehensive prompt for generating production-ready system architecture documents, " +
      "including component diagrams, data flow specifications, and integration patterns.",
    tags: ["AI", "Architecture", "System Design"],
    encryptedPrompt: "enc-local-0000000000000000000000000001",
    encryptionIv: "iv-local-0000000000000000000000000001",
    wrappedKey: "wrapped-local-0000000000000000000000001",
    contentHash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    priceStroops: 5_0000000n,
    active: true,
    salesCount: 2,
  },
  {
    id: 2n,
    creator: CREATOR2_PUBKEY,
    imageUrl: "https://fixtures.local/prompt-2.png",
    title: "Creative Storyteller Pro",
    category: "Creative",
    previewText: "Unlock deep narrative structures and character development arcs.",
    description:
      "A storytelling prompt for crafting compelling plot outlines, multi-dimensional characters, " +
      "and emotional arcs suitable for long-form fiction.",
    tags: ["Storytelling", "Creative", "Fiction"],
    encryptedPrompt: "enc-local-0000000000000000000000000002",
    encryptionIv: "iv-local-0000000000000000000000000002",
    wrappedKey: "wrapped-local-0000000000000000000000002",
    contentHash: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    priceStroops: 10_0000000n,
    active: true,
    salesCount: 1,
  },
  {
    id: 3n,
    creator: CREATOR1_PUBKEY,
    imageUrl: "https://fixtures.local/prompt-3.png",
    title: "SEO Content Optimizer",
    category: "Marketing",
    previewText: "Generate SEO-optimized content briefs and meta descriptions.",
    description:
      "A marketing-focused prompt that produces SEO-rich content outlines, keyword strategies, " +
      "and meta descriptions tailored to target audiences.",
    tags: ["Marketing", "SEO", "Content"],
    encryptedPrompt: "enc-local-0000000000000000000000000003",
    encryptionIv: "iv-local-0000000000000000000000000003",
    wrappedKey: "wrapped-local-0000000000000000000000003",
    contentHash: "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
    priceStroops: 7_5000000n,
    active: false,
    salesCount: 3,
  },
  {
    id: 4n,
    creator: CREATOR1_PUBKEY,
    imageUrl: "https://fixtures.local/prompt-4.png",
    title: "Smart Contract Auditor",
    category: "Security",
    previewText: "Audit Soroban smart contracts for common vulnerabilities.",
    description:
      "A security-focused prompt designed to identify common smart contract vulnerabilities, " +
      "including reentrancy, arithmetic overflows, and access control issues in Soroban contracts.",
    tags: ["Security", "Smart Contracts", "Soroban"],
    encryptedPrompt: "enc-local-0000000000000000000000000004",
    encryptionIv: "iv-local-0000000000000000000000000004",
    wrappedKey: "wrapped-local-0000000000000000000000004",
    contentHash: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
    priceStroops: 3_0000000n,
    active: true,
    salesCount: 5,
  },
  {
    id: 5n,
    creator: CREATOR2_PUBKEY,
    imageUrl: "https://fixtures.local/prompt-5.png",
    title: "Zero-Sales Fresh Listing",
    category: "Development",
    previewText: "A newly listed prompt with no purchases yet.",
    description:
      "A brand-new prompt listing that has never been purchased. " +
      "Useful for testing first-purchase flows and zero-state UI.",
    tags: ["New", "Testing", "Zero-State"],
    encryptedPrompt: "enc-local-0000000000000000000000000005",
    encryptionIv: "iv-local-0000000000000000000000000005",
    wrappedKey: "wrapped-local-0000000000000000000000005",
    contentHash: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
    priceStroops: 2_0000000n,
    active: true,
    salesCount: 0,
  },
];

// =============================================================================
// Pre-built purchases (3 records)
//
//   ID          | PROMPT | BUYER  | CREATOR   | PRICE   | WHEN
//   ------------+--------+--------+-----------+---------+----------
//   purchase-1  |      1 | buyer1 | creator1  | 5 XLM   | 7 days ago
//   purchase-2  |      2 | buyer2 | creator2  | 10 XLM  | 5 days ago
//   purchase-3  |      4 | buyer1 | creator1  | 3 XLM   | 3 days ago
// =============================================================================

const _BASELINE = 1_753_200_000; // 2025-07-23T00:00:00Z
const _DAY = 86_400;

export const LOCAL_PURCHASES: LocalPurchase[] = [
  {
    purchaseId: "purchase-1",
    promptId: 1n,
    buyer: BUYER1_PUBKEY,
    originalCreator: CREATOR1_PUBKEY,
    originalPrice: 5_0000000n,
    purchasedAt: _BASELINE - 7 * _DAY,
    expiresAt: 0,
  },
  {
    purchaseId: "purchase-2",
    promptId: 2n,
    buyer: BUYER2_PUBKEY,
    originalCreator: CREATOR2_PUBKEY,
    originalPrice: 10_0000000n,
    purchasedAt: _BASELINE - 5 * _DAY,
    expiresAt: 0,
  },
  {
    purchaseId: "purchase-3",
    promptId: 4n,
    buyer: BUYER1_PUBKEY,
    originalCreator: CREATOR1_PUBKEY,
    originalPrice: 3_0000000n,
    purchasedAt: _BASELINE - 3 * _DAY,
    expiresAt: 0,
  },
];

// =============================================================================
// Pre-built license transfers (2 records)
//
//   ID          | PROMPT | FROM   | TO      | RESALE  | WHEN
//   ------------+--------+--------+---------+---------+----------
//   transfer-1  |      1 | buyer1 | buyer2  | 4 XLM   | 2 days ago
//   transfer-2  |      2 | buyer2 | buyer1  | 12 XLM  | 1 day ago
// =============================================================================

export const LOCAL_LICENSE_TRANSFERS: LocalLicenseTransfer[] = [
  {
    transferId: "transfer-1",
    promptId: 1n,
    fromAddress: BUYER1_PUBKEY,
    toAddress: BUYER2_PUBKEY,
    resalePrice: 4_0000000n,
    transferredAt: _BASELINE - 2 * _DAY,
  },
  {
    transferId: "transfer-2",
    promptId: 2n,
    fromAddress: BUYER2_PUBKEY,
    toAddress: BUYER1_PUBKEY,
    resalePrice: 12_0000000n,
    transferredAt: _BASELINE - 1 * _DAY,
  },
];

// =============================================================================
// Pre-built disputes (1 record)
//
//   ID          | PROMPT | BUYER  | CREATOR  | STATUS | WHEN
//   ------------+--------+--------+----------+--------+----------
//   dispute-1   |      3 | buyer1 | creator1 | open   | 1 day ago
// =============================================================================

export const LOCAL_DISPUTES: LocalDispute[] = [
  {
    disputeId: "dispute-1",
    promptId: 3n,
    buyer: BUYER1_PUBKEY,
    creator: CREATOR1_PUBKEY,
    reason:
      "Prompt content does not match the description. " +
      "Expected SEO tooling but received generic content marketing advice.",
    status: "open",
    filedAt: _BASELINE - 1 * _DAY,
  },
];

// =============================================================================
// Full fixture factory
// =============================================================================

/**
 * Builds a complete deterministic fixture snapshot.
 * All data is derived from the SeedPolicy domain — no external calls, no RPC.
 */
export function createLocalFixtures(): LocalFixtureSchema {
  const accounts: Record<string, LocalAccount> = {};

  for (const entry of SeedPolicy.labels) {
    const kp = _KP[entry.label as keyof typeof _KP];
    const balanceXlm =
      EXPECTED_BALANCES[entry.label as keyof typeof EXPECTED_BALANCES];
    accounts[entry.label] = {
      seed: kp.secret(),
      publicKey: kp.publicKey(),
      label: entry.label,
      balanceXlm,
    };
  }

  return {
    name: "local-deterministic-v1",
    accounts,
    // Return fresh copies so callers can mutate without affecting the originals
    prompts: LOCAL_PROMPTS.map((p) => ({ ...p })),
    purchases: LOCAL_PURCHASES.map((p) => ({ ...p })),
    licenseTransfers: LOCAL_LICENSE_TRANSFERS.map((t) => ({ ...t })),
    disputes: LOCAL_DISPUTES.map((d) => ({ ...d })),
  };
}

// =============================================================================
// Singleton fixture cache with reset support
// =============================================================================

let _fixtures: LocalFixtureSchema | null = null;

/**
 * Returns the current fixture snapshot. Creates one on first call.
 * Subsequent calls return the SAME mutable object — mutations persist
 * across tests unless {@link resetFixtures} is called.
 *
 * @example
 * ```ts
 * import { getFixtures } from "@/test/fixtures/stellar-local";
 * const { prompts, accounts } = getFixtures();
 * ```
 */
export function getFixtures(): LocalFixtureSchema {
  if (!_fixtures) {
    _fixtures = createLocalFixtures();
  }
  return _fixtures;
}

/**
 * Destroys the cached fixture snapshot and rebuilds it from scratch.
 * Use this in `beforeEach` to guarantee test isolation without any
 * RPC calls or Friendbot funding.
 *
 * @example
 * ```ts
 * import { resetFixtures } from "@/test/fixtures/stellar-local";
 * beforeEach(() => { resetFixtures(); });
 * ```
 */
export function resetFixtures(): LocalFixtureSchema {
  _fixtures = createLocalFixtures();
  return _fixtures;
}
