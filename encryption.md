# Encryption & Key Protection Guide

## Overview

This document explains how sensitive secrets are protected using **AES-GCM encryption** and how the AES encryption key is protected using the `UNLOCK_PUBLIC_KEY`.

The goal is to give new contributors a clear understanding of:

* AES-GCM encryption
* Encryption key generation
* Key wrapping against the unlock public key
* The decryption flow
* Nonce and authentication-tag requirements
* Security rules contributors must follow

The system uses **hybrid encryption**, also known as **envelope encryption**.

The basic architecture is:

```text
Sensitive Data
      |
      v
+------------------+
|    AES-GCM       |
| Symmetric Crypto |
+------------------+
      |
      +--------------------+
      |                    |
      v                    v
 Ciphertext             AES Key
                           |
                           v
                    +--------------+
                    | Key Wrapping |
                    |              |
                    | Unlock Public|
                    | Key          |
                    +--------------+
                           |
                           v
                     Wrapped Key
```

The encrypted payload and wrapped AES key can then be stored together.

---

# 1. Why Hybrid Encryption?

AES-GCM is efficient for encrypting data, but it is a **symmetric** encryption algorithm.

This means the same AES key is required for both encryption and decryption.

The challenge is:

> How do we securely store or transport the AES key?

Instead of storing the AES key in plaintext, we protect it using the recipient's public-key cryptography.

This gives us two layers:

```text
Public-key cryptography
        |
        v
Protects the AES encryption key

AES-GCM
        |
        v
Protects the actual sensitive data
```

This approach is commonly called **envelope encryption**.

---

# 2. AES-GCM

## What is AES?

AES (Advanced Encryption Standard) is a symmetric encryption algorithm.

For example:

```text
AES_KEY = randomly generated 256-bit key
```

The same key is required to decrypt data that was encrypted with it.

## What is GCM?

GCM stands for **Galois/Counter Mode**.

AES-GCM provides both:

1. **Confidentiality** — prevents unauthorized users from reading the encrypted data.
2. **Integrity/authentication** — detects whether the encrypted data has been modified.

Conceptually:

```text
ciphertext, authenticationTag =
    AES-GCM-Encrypt(
        key,
        nonce,
        plaintext,
        additionalAuthenticatedData
    )
```

During decryption:

```text
plaintext =
    AES-GCM-Decrypt(
        key,
        nonce,
        ciphertext,
        authenticationTag,
        additionalAuthenticatedData
    )
```

If the authentication check fails, decryption must fail.

---

# 3. AES Key Generation

A new random AES key should be generated for the encryption operation or according to the application's documented key-management strategy.

For AES-256:

```text
AES_KEY = 256-bit cryptographically secure random value
```

The key must be generated using a **cryptographically secure random number generator**.

Do not:

* Generate keys from predictable values.
* Use passwords directly as AES keys.
* Hard-code AES keys in source code.
* Store raw production AES keys in logs.
* Reuse keys or nonces incorrectly.

---

# 4. AES-GCM Nonce

AES-GCM requires a nonce (also called an IV).

A common configuration uses a:

```text
96-bit / 12-byte nonce
```

Example:

```text
nonce = randomBytes(12)
```

The nonce does **not** need to be secret.

It can be stored alongside the ciphertext.

However:

> A nonce must never be reused with the same AES-GCM key.

A typical encrypted payload therefore contains:

```json
{
  "nonce": "...",
  "ciphertext": "...",
  "authTag": "..."
}
```

---

# 5. Authentication Tag

AES-GCM produces an authentication tag alongside the ciphertext.

The tag allows the recipient to verify that:

* The ciphertext has not been modified.
* The authentication data has not been modified.
* The ciphertext was produced with the correct key.

Conceptually:

```text
Plaintext
    |
    v
AES-GCM
    |
    +----> Ciphertext
    |
    +----> Authentication Tag
```

During decryption:

```text
Ciphertext + Authentication Tag
                |
                v
            AES-GCM
                |
       +--------+--------+
       |                 |
       v                 v
   Valid Tag         Invalid Tag
       |                 |
       v                 v
  Plaintext          FAIL
```

If authentication fails, the application must reject the data.

It must **not** attempt to use partially decrypted or unauthenticated plaintext.

---

# 6. Key Wrapping Against `UNLOCK_PUBLIC_KEY`

The AES key itself must also be protected.

The system uses the recipient's `UNLOCK_PUBLIC_KEY` for this purpose.

Conceptually:

```text
AES_KEY
   |
   v
Key wrapping / public-key encryption
   |
   | UNLOCK_PUBLIC_KEY
   v
WRAPPED_AES_KEY
```

The corresponding private key can then recover the AES key:

```text
WRAPPED_AES_KEY
       |
       v
Key unwrapping
       |
       | UNLOCK_PRIVATE_KEY
       v
    AES_KEY
```

### Important

The exact key-wrapping mechanism must match the cryptographic algorithm implemented by the system.

For example:

* RSA should use an appropriate modern scheme such as RSA-OAEP.
* Elliptic-curve systems generally require an appropriate key-agreement/KEM construction rather than simply "encrypting with an EC public key."
* AES-KW/AES-KWP may be used when a symmetric key-encryption key is available.

Contributors should always follow the algorithm and parameters defined by the implementation.

Do not substitute a different primitive without a security review.

---

# 7. Encrypted Envelope

After encryption, the system should have enough information to decrypt the payload later without exposing the sensitive plaintext or raw AES key.

A conceptual envelope looks like:

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "nonce": "...",
  "ciphertext": "...",
  "authTag": "...",
  "wrappedKey": "..."
}
```

Depending on the implementation, additional fields may be required.

For example:

```text
version
algorithm
key identifier
nonce
ciphertext
authentication tag
wrapped AES key
additional authenticated data
```

Do not assume the above JSON structure is the exact production schema. The implementation is the source of truth.

---

# 8. Encryption Flow

The complete encryption process is:

```text
1. Receive sensitive plaintext
              |
              v
2. Generate AES key
              |
              v
3. Generate unique nonce
              |
              v
4. Encrypt plaintext using AES-GCM
              |
              +------> ciphertext
              |
              +------> authentication tag
              |
              v
5. Wrap AES key using UNLOCK_PUBLIC_KEY
              |
              v
6. Store encrypted envelope
```

Conceptually:

```text
                  Sensitive Data
                        |
                        v
                +---------------+
                |   AES-GCM      |
                +---------------+
                   |         |
                   |         |
                   v         v
             Ciphertext    Auth Tag
                   |
                   |
            AES Encryption Key
                   |
                   v
          +---------------------+
          | Key Wrapping        |
          | UNLOCK_PUBLIC_KEY   |
          +---------------------+
                   |
                   v
             Wrapped Key
```

---

# 9. Decryption Flow

When an authorized component needs to recover the sensitive data:

```text
1. Load encrypted envelope
              |
              v
2. Extract wrapped AES key
              |
              v
3. Unwrap AES key using UNLOCK_PRIVATE_KEY
              |
              v
4. Extract nonce, ciphertext and authentication tag
              |
              v
5. Decrypt using AES-GCM
              |
              v
6. Verify authentication tag
              |
        +-----+-----+
        |           |
      Valid       Invalid
        |           |
        v           v
   Plaintext      FAIL
```

The application should only use the plaintext after successful authentication.

---

# 10. Encryption Sequence Diagram

```text
Contributor/App       Encryption Service       Unlock Public Key       Storage
      |                       |                       |                  |
      |  Sensitive data       |                       |                  |
      |---------------------->|                       |                  |
      |                       |                       |                  |
      |                       | Generate AES key      |                  |
      |                       |                       |                  |
      |                       | Generate nonce        |                  |
      |                       |                       |                  |
      |                       | AES-GCM encrypt       |                  |
      |                       | plaintext             |                  |
      |                       |                       |                  |
      |                       | ciphertext + tag      |                  |
      |                       |                       |                  |
      |                       | Wrap AES key          |                  |
      |                       |---------------------->|                  |
      |                       |                       |                  |
      |                       |<----------------------|                  |
      |                       |     wrapped key       |                  |
      |                       |                       |                  |
      |                       | Store encrypted       |                  |
      |                       | envelope              |                  |
      |                       |----------------------------------------->|
      |                       |                       |                  |
```

---

# 11. Decryption Sequence Diagram

```text
Application          Storage          Unlock Private Key
     |                  |                    |
     | Request data     |                    |
     |----------------->|                    |
     |                  |                    |
     |<-----------------|                    |
     | Encrypted        |                    |
     | envelope         |                    |
     |                  |                    |
     | Unwrap AES key   |                    |
     |------------------------------------->|
     |                  |                    |
     |<-------------------------------------|
     |             AES key                  |
     |                  |                    |
     | AES-GCM decrypt  |                    |
     |                  |                    |
     | Verify auth tag  |                    |
     |                  |                    |
     +--------+---------+                    |
              |
        +-----+------+
        |            |
      Valid        Invalid
        |            |
        v            v
    Plaintext       FAIL
```

---

# 12. End-to-End Example

Assume the application starts with:

```text
PLAINTEXT
    ↓
"Sensitive value"
```

### Encryption

Generate:

```text
AES_KEY
NONCE
```

Encrypt:

```text
AES-GCM(
    AES_KEY,
    NONCE,
    PLAINTEXT
)
```

Result:

```text
CIPHERTEXT
AUTH_TAG
```

Protect the AES key:

```text
WRAPPED_KEY =
    Wrap(
        UNLOCK_PUBLIC_KEY,
        AES_KEY
    )
```

Store:

```text
{
    nonce,
    ciphertext,
    authTag,
    wrappedKey
}
```

### Decryption

Retrieve:

```text
nonce
ciphertext
authTag
wrappedKey
```

Recover the AES key:

```text
AES_KEY =
    Unwrap(
        UNLOCK_PRIVATE_KEY,
        wrappedKey
    )
```

Decrypt:

```text
PLAINTEXT =
    AES-GCM-Decrypt(
        AES_KEY,
        nonce,
        ciphertext,
        authTag
    )
```

If authentication succeeds:

```text
SUCCESS → use plaintext
```

If authentication fails:

```text
FAIL → reject data
```

---

# 13. What New Contributors Must Remember

## Rule 1 — Never store plaintext secrets

Do not commit or persist sensitive values directly.

```text
BAD:

UNLOCK_PRIVATE_KEY="actual-secret"
```

Use the approved encrypted storage mechanism instead.

---

## Rule 2 — Never hard-code production keys

Never put production private keys or encryption keys directly into source code.

```text
BAD:

const privateKey = "....";
```

Production secrets should come from the approved secret-management mechanism.

---

## Rule 3 — Never log secrets

Do not log:

```text
UNLOCK_PRIVATE_KEY
AES_KEY
plaintext
```

Also be careful with:

```text
request bodies
environment variables
headers
debug output
error messages
```

Secrets can accidentally appear in logs through these paths.

---

## Rule 4 — Never reuse an AES-GCM nonce with the same key

This is a critical AES-GCM requirement.

```text
Same AES key
      +
Same nonce
      =
Dangerous
```

Always follow the nonce-generation strategy implemented by the project.

---

## Rule 5 — Never ignore authentication failures

If AES-GCM authentication fails:

```text
DO NOT:
- return plaintext
- continue processing
- retry with arbitrary keys
- silently ignore the error
```

Instead:

```text
FAIL CLOSED
```

Record a safe diagnostic event without exposing sensitive values.

---

## Rule 6 — Public keys are not private keys

The public key is intended to be distributed:

```text
UNLOCK_PUBLIC_KEY
```

The private key must remain confidential:

```text
UNLOCK_PRIVATE_KEY
```

Compromise of the private key should be treated as a critical security incident.

---

# 14. Key Rotation

If `UNLOCK_PRIVATE_KEY` is suspected or confirmed to be compromised:

1. Stop affected transaction operations.
2. Pause affected contract functionality if supported.
3. Generate a completely new key pair.
4. Update the approved secret store.
5. Rotate application credentials.
6. Transfer or rotate contract permissions where applicable.
7. Remove the compromised key from authorized systems.
8. Redeploy the application.
9. Verify the new key works.
10. Monitor the old and new accounts.
11. Assess potential customer impact.
12. Follow the project's security incident runbook.

> Rotating the application environment variable alone may not be sufficient. If the compromised account has on-chain permissions, those permissions must also be revoked or transferred.

---

# 15. Recommended Data Model

A conceptual encrypted record could look like:

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "keyId": "unlock-key-v1",
  "nonce": "<base64>",
  "ciphertext": "<base64>",
  "authTag": "<base64>",
  "wrappedKey": "<base64>"
}
```

The exact format should follow the implementation.

### Why include a version?

A version allows the encryption format to evolve.

For example:

```text
version 1 → AES-256-GCM + wrapping scheme A
version 2 → AES-256-GCM + wrapping scheme B
```

This makes future cryptographic migrations easier.

---

# 16. Additional Authenticated Data (AAD)

AES-GCM can authenticate data that does not need to be encrypted.

For example:

```text
AAD = {
    version: 1,
    keyId: "unlock-key-v1"
}
```

The AAD is authenticated but not encrypted.

Conceptually:

```text
AES-GCM(
    key,
    nonce,
    plaintext,
    AAD
)
```

During decryption, the exact same AAD must be supplied.

If it differs, authentication should fail.

This can help prevent an attacker from moving an encrypted payload between incompatible contexts.

Only use AAD when the implementation defines a stable format and consistently authenticates it during both encryption and decryption.

---

# 17. Contributor Checklist

Before submitting encryption-related changes, verify:

* [ ] Sensitive plaintext is never persisted unnecessarily.
* [ ] AES keys are generated securely.
* [ ] AES-GCM is used according to the project's approved parameters.
* [ ] Nonces are unique for each encryption under a given AES key.
* [ ] Authentication tags are always verified.
* [ ] AES keys are protected using the approved key-wrapping mechanism.
* [ ] `UNLOCK_PRIVATE_KEY` is never logged.
* [ ] Production secrets are not committed to Git.
* [ ] Test fixtures do not contain real production secrets.
* [ ] Encryption metadata is versioned where required.
* [ ] Decryption fails closed when authentication fails.
* [ ] Key rotation procedures remain functional.
* [ ] Contract authorization is considered when rotating keys.

---

# 18. Quick Mental Model

For new contributors, remember:

```text
                 ENCRYPTION
                     |
                     v
          +----------------------+
          |      AES-GCM         |
          |                      |
          | Sensitive Data       |
          |        ↓             |
          |   Ciphertext + Tag   |
          +----------------------+
                     |
                     |
                  AES KEY
                     |
                     v
          +----------------------+
          |    KEY WRAPPING      |
          |                      |
          | UNLOCK_PUBLIC_KEY    |
          +----------------------+
                     |
                     v
               WRAPPED KEY
```

And during decryption:

```text
WRAPPED KEY
     |
     | UNLOCK_PRIVATE_KEY
     v
  AES KEY
     |
     | AES-GCM
     v
Ciphertext + Tag
     |
     v
Authentication
     |
  +--+--+
  |     |
 PASS  FAIL
  |     |
  v     v
Data   Reject
```

### The key concept

**AES-GCM protects the data.**

**The public-key wrapping mechanism protects the AES key.**

**The private key recovers the AES key.**

**The GCM authentication tag determines whether the decrypted data can be trusted.**

Never treat encryption as complete until both **confidentiality and integrity** have been addressed.
