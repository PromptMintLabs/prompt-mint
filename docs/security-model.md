# Security Model and Threat Architecture

This document outlines the security assumptions, potential attack vectors, and mitigation strategies for the PromptHash Stellar ecosystem.

## Security Architecture

The system relies on a hybrid architecture combining on-chain state (Soroban) with off-chain gated delivery (Unlock Service).

### Trust Boundaries
1.  **Client (Browser)**: Responsible for initial encryption and wallet interaction. Trusted to not leak the plaintext before it's encrypted.
2.  **Soroban Contract**: Trusted source of truth for "who owns what". Enforces XLM payments and immutable entitlement records.
3.  **Unlock Service**: Responsible for key unwrapping and decryption. Trusted to verify on-chain state before releasing content.

---

## Threat Model

### 1. Service-in-the-Middle (Replay Attacks)
**Scenario:** An attacker intercepts a signed challenge and attempts to use it later to unlock content.
**Mitigation:**
- **Nonces**: Every challenge includes a unique `nonce` (UUID) that the server tracks (or signs into the token).
- **TTL (Time-to-Live)**: Challenge tokens are short-lived (e.g., 5 minutes). Even if intercepted, the window of opportunity is small.
- **Server Signature**: The challenge token is signed by the server's secret, preventing attackers from forging their own valid challenges.

### 2. Double-Spend / Lack of Entitlement
**Scenario:** A user attempts to unlock content without paying, or after a transaction was reverted.
**Mitigation:**
- **On-Chain Verification**: The Unlock Service MUST query the Soroban contract's `has_access` method before performing any decryption. This ensures that the buyer's address is permanently recorded as having purchase rights.
- **Finality**: The service should wait for transaction finality (successful ledger inclusion) before acknowledging a purchase.

### 3. Server Compromise
**Scenario:** An attacker gains access to the Unlock Service's private key.
**Mitigation:**
- **Encrypted-at-Rest**: Content stored on-chain is encrypted with AES keys that are wrapped. Even with the service private key, the attacker still needs to fetch the encrypted payload from the blockchain.
- **Separation of Concerns**: The service does not store a master key for all prompts; it only holds the key used for wrapping.

### 4. Malicious Creator (Content Mismatch)
**Scenario:** A creator sells a "Gold Prompt" but puts garbage in the encrypted payload.
**Mitigation:**
- **Content Hash**: The contract stores a SHA-256 hash of the intended plaintext. When the buyer unlocks, the service re-hashes the result. If it doesn't match, the buyer has proof of fraud.
- **Reputation**: (Future) Community ratings and escrow systems can mitigate this further.

---

## Access Control Logic

The `has_access` logic in the contract is the primary gatekeeper:
```rust
fn has_access(env: Env, user: Address, prompt_id: u128) -> Result<bool, Error> {
    let prompt = Storage::require_prompt(&env, prompt_id)?;
    Ok(prompt.creator == user || Storage::has_purchase(&env, prompt_id, &user))
}
```
This ensures that ONLY the original creator or a verified buyer can ever trigger the unlock flow successfully.

---

## Encryption Flow: AES-GCM Key Wrapping

The PromptHash system uses a layered encryption approach to ensure content is encrypted at rest while allowing gated decryption on demand.

### Step 1: Client-Side Encryption (Browser)

Before submission to the contract, the creator's plaintext prompt is encrypted on the client:

```typescript
// Creator encrypts plaintext prompt
const plaintext = "Your AI prompt here...";
const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit random IV
const aesKey = crypto.getRandomValues(new Uint8Array(32)); // 256-bit AES key

const encryptedPrompt = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  aesKey,
  new TextEncoder().encode(plaintext)
);

const contentHash = sha256(plaintext); // Store for integrity validation
```

**Key Security Properties:**
- The plaintext NEVER leaves the browser until encrypted
- The AES key is generated fresh for each prompt
- IV is random per encryption
- Content hash is computed before encryption for integrity checks

### Step 2: Key Wrapping (Against Unlock Service Public Key)

The AES key itself is then wrapped using the Unlock Service's public key (RSA-OAEP or X25519):

```typescript
// Wrap the AES key against the Unlock Service's public key
const wrappedKey = await crypto.subtle.wrapKey(
  "raw",
  aesKey,
  unlockServicePublicKey,
  { name: "RSA-OAEP", hash: "SHA-256" },
  { name: "AES-GCM" }
);
```

**Rationale:**
- Only the Unlock Service can unwrap the AES key (they hold the private key)
- The encrypted prompt is useless without the AES key
- Separates concerns: browser cannot decrypt even if it wanted to

### Step 3: On-Chain Storage

The creator submits to the Soroban contract:
- **Encrypted Prompt Payload** (the output of AES-GCM encryption)
- **Wrapped AES Key** (encrypted against Unlock Service public key)
- **Encryption IV** (safe to store publicly, needed for decryption)
- **Content Hash** (SHA-256 of plaintext, for integrity checking)
- **Preview Metadata** (public, unencrypted)

None of these components can be decrypted without the Unlock Service's private key.

### Step 4: Unlock Flow (Decryption)

When a buyer requests the plaintext:

1. **Signature Challenge**: Buyer signs a nonce to prove wallet ownership
2. **Access Verification**: Unlock Service queries `has_access()` on-chain
3. **Key Unwrap**: Service unwraps the AES key using its private key:
   ```typescript
   const aesKey = await crypto.subtle.unwrapKey(
     "raw",
     wrappedKey,
     unlockServicePrivateKey,
     { name: "RSA-OAEP", hash: "SHA-256" },
     { name: "AES-GCM" },
     true,
     ["decrypt"]
   );
   ```
4. **Decryption**: Service decrypts the prompt:
   ```typescript
   const decrypted = await crypto.subtle.decrypt(
     { name: "AES-GCM", iv },
     aesKey,
     encryptedPrompt
   );
   ```
5. **Integrity Check**: Service re-computes the hash and compares to stored hash
6. **Return**: Plaintext is returned only if hash matches and access is verified

---

## Signature Verification

The Unlock Service uses wallet signatures to verify that a requestor actually controls the wallet claiming access.

### Challenge-Response Protocol

```
1. Client: GET /api/auth/challenge?wallet=G...
   Server responds: { nonce: "<UUID>", ttl: 300 }

2. Client: Signs nonce with wallet (Freighter, Albedo, etc.)
   Signature is a signed message: "Unlock PromptHash: <nonce>"

3. Client: POST /api/auth/verify
   Payload: { wallet, nonce, signature }
   
4. Server:
   a. Checks nonce has not expired and not been used
   b. Uses stellar.js to verify signature:
      const valid = StrKey.verify('signature', wallet, signature);
   c. If valid, returns challenge token (JWT with 60s TTL)
   d. If invalid, returns 401 Unauthorized
```

### Signature Format

Signatures are created using Stellar's built-in message signing protocol:

```typescript
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromPublicKey(wallet);
const message = `Unlock PromptHash: ${nonce}`;
const signature = keypair.sign(message); // Signs with private key
```

The server verifies:
```typescript
import * as StellarBase from "@stellar/base";

const isValid = StellarBase.StrKey.verify('signature', wallet, signature);
```

**Security Properties:**
- Only the wallet holder can produce a valid signature
- Nonces are one-time-use and short-lived (5 minutes)
- Signatures are cryptographically bound to the specific nonce and wallet

---

## Known Limitations

### 1. Unlock Service Trust Assumption
The Unlock Service is a trusted component with access to the decryption key. If compromised:
- **Plaintext Content** can be extracted (but only for prompts the attacker has access rights to)
- **Private Keys** for the service must be rotated
- **Mitigation**: The service should run in a secure environment with proper access controls, HSM-backed keys, and regular security audits

### 2. Network Visibility & Abuse Protection
Unlock and authentication endpoints (`/api/auth/challenge`, `/api/prompts/unlock`, `/api/bundles/unlock`) enforce multi-layered abuse prevention:
- **Rate Limiting**: `/api/auth/challenge` enforces a strict limit of max 10 requests per IP per minute.
- **Account Lockout**: After 5 consecutive failed authentication attempts (e.g. invalid cryptographic signatures), the wallet account is locked for 15 minutes (HTTP 423 `ACCOUNT_LOCKED`).
- **CAPTCHA Challenge**: When repeated failures (>=3) are detected from an IP or wallet, subsequent requests require valid CAPTCHA verification (`CAPTCHA_REQUIRED` / `CAPTCHA_INVALID`).
- **Replay Protection**: Cryptographic challenge nonces and signatures are single-use within their validity window.

### 3. Content Leakage via Metadata
Preview metadata is public:
- **Title, Image, Price**: All visible to anyone
- **Mitigation**: Creators should avoid putting sensitive information in preview text

### 4. Creator Trust
Creators are assumed to provide genuine content:
- **Scenario**: A creator publishes a high-price prompt with low-quality content
- **Mitigation**: Community ratings and dispute resolution (future feature)

### 5. Stellar Network Finality
The contract relies on Stellar's consensus for finality:
- **Scenario**: A ledger is closed with a purchase transaction, but the buyer's account is then merged
- **Mitigation**: The `has_access` check queries the current ledger state; historical revisions are not supported

### 6. Client-Side Encryption Responsibility
The browser must properly implement AES-GCM:
- **Scenario**: A malicious script in the browser steals the plaintext before encryption
- **Mitigation**: Use a Content Security Policy (CSP), verify browser security practices, consider a hardware wallet extension

---

## Recovery Procedures

### Compromised Unlock Service Private Key

**Impact**: All future decryptions could be forged by an attacker.

**Recovery Steps**:
1. Immediately rotate the Unlock Service private key
2. Issue a new key and update `PUBLIC_UNLOCK_PUBLIC_KEY` in contract state (via admin function)
3. Re-wrap all stored AES keys against the new public key (requires creator re-submission or batch re-encryption)
4. Audit logs to identify any unauthorized decryptions

### Compromised Creator Account

**Impact**: Attacker can modify listing metadata, price, or deactivate the listing.

**Recovery Steps**:
1. Leverage Stellar's wallet recovery via SEP-0005 mnemonic if available
2. Use an alternate signing key if the account has multiple signers
3. Creators should enable multi-sig on their Stellar accounts

### Malicious Content Detected

**Impact**: A buyer unlocked a prompt and found fraudulent or harmful content.

**Recovery Steps**:
1. Creator's listing is flagged for review
2. Maintainers can disable the listing (set `active = false`)
3. Future dispute resolution: buyers can provide evidence (hash mismatch, content report)
4. Refunds via contract interaction (future feature)

---

## Compliance and Audit Trail

### Structured Logging

All Unlock Service operations are logged with:
- Request ID (for tracing)
- Timestamp
- Wallet address (hashed)
- Prompt ID
- Success/failure status
- Signature verification result

Logs do NOT include:
- Plaintext prompt content
- Private keys or unencrypted AES keys
- Full wallet addresses (hashed)

### Rate Limiting

To prevent brute-force attacks:
- **Per-Wallet**: Maximum 10 unlock requests per minute
- **Per-IP**: Maximum 100 unlock requests per minute
- **Signature Verification**: Maximum 5 failed signatures per wallet per minute

Exceeded limits trigger temporary (5-minute) blocks.

---

## Future Security Enhancements

1. **Hardware Security Module (HSM)**: Store Unlock Service private key in an HSM for additional protection
2. **Zero-Knowledge Proofs**: Prove access without revealing wallet ownership
3. **Threshold Encryption**: Distribute the Unlock Service key across multiple servers
4. **Encryption Rotation**: Periodically re-encrypt prompts with new keys
5. **Dispute Resolution**: Escrow system for refunding fraudulent purchases
6. **Community Moderation**: Multi-sig approval for flagging content