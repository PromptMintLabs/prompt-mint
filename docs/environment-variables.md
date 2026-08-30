# Environment Variables Reference

This document provides a comprehensive reference for all environment variables supported by PromptHash Stellar across frontend, serverless API, and background worker runtimes.

---

## 1. Shared & Runtime Configuration

| Variable | Required | Default | Acceptable Values | Purpose |
|---|:---:|:---:|---|---|
| `STELLAR_SCAFFOLD_ENV` | No | `development` | `development`, `staging`, `production`, `test` | Controls runtime logging verbosity, mock fallbacks, and local development configurations. |
| `XDG_CONFIG_HOME` | No | `.config` | Relative or absolute directory path | Directory where local CLI configs, keys, and cache files are stored. |
| `PORT` | No | `3000` | Valid TCP port (e.g. `3000`, `8080`) | Listening port for standalone Node.js Express server. |

---

## 2. Stellar Network & Soroban Smart Contracts

| Variable | Required | Default (Testnet) | Acceptable Values | Purpose |
|---|:---:|:---:|---|---|
| `PUBLIC_STELLAR_NETWORK` | Yes | `TESTNET` | `TESTNET`, `PUBLIC`, `FUTURENET`, `LOCAL` | Identifies the target Stellar network for wallet connection and transaction signing. |
| `PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Yes | `"Test SDF Network ; September 2015"` | Valid Stellar network passphrase | Cryptographic passphrase for signing and validating transaction envelopes. |
| `PUBLIC_STELLAR_RPC_URL` | Yes | `https://soroban-testnet.stellar.org` | HTTPS URL to Soroban RPC endpoint | Connects frontend and backend services to the Soroban RPC provider. |
| `PUBLIC_STELLAR_HORIZON_URL` | Yes | `https://horizon-testnet.stellar.org` | HTTPS URL to Horizon API | Connects to Horizon for classic ledger and payment stream queries. |
| `PUBLIC_PROMPT_HASH_CONTRACT_ID` | Yes | Placeholder | 56-character StrKey contract address (`C...`) | Address of deployed PromptHash marketplace smart contract. |
| `PUBLIC_STELLAR_NATIVE_ASSET_CONTRACT_ID` | Yes | `CDLZFC...CYSC` | 56-character StrKey contract address | Address of the Soroban native XLM Stellar Asset Contract (SAC). |
| `PUBLIC_STELLAR_SIMULATION_ACCOUNT` | No | `G...` | 56-character Stellar public address (`G...`) | Source account used for gas/footprint simulation of contract dry-runs. |

---

## 3. Serverless Cryptography & Unlock Runtime

| Variable | Required | Default | Security Notes | Purpose |
|---|:---:|:---:|---|---|
| `CHALLENGE_TOKEN_SECRET` | Yes | `super-secret...` | Must be $\ge 16$ high-entropy chars in production. | Signs and validates wallet challenge JWT tokens during prompt unlock. |
| `UNLOCK_PUBLIC_KEY` | Yes | Base64 string | Public key of the serverless decryption service. | Used by frontend to verify prompt packaging and encryption. |
| `UNLOCK_PRIVATE_KEY` | Yes | Base64 string | **Critical Secret**: Never commit or expose to clients. | Private key used on backend to unwrap seller keys and decrypt purchased prompts. |
| `PUBLIC_UNLOCK_PUBLIC_KEY` | No | Base64 string | Public key copy exposed to frontend bundles. | Frontend key copy for encryption verification. |

---

## 4. Zero-Downtime Secret Rotation

| Variable | Required | Default | Purpose |
|---|:---:|:---:|---|
| `ADMIN_ROTATION_TOKEN` | No | Unset | Bearer token required to trigger administrative key rotation endpoints. |
| `CHALLENGE_TOKEN_SECRET_PREVIOUS` | No | Unset | Holds the previous secret during rotation to prevent rejecting in-flight challenge tokens. |
| `CHALLENGE_TOKEN_ROTATION_TIMESTAMP` | No | `0` | Timestamp (epoch ms) when secret rotation took place. |
| `CHALLENGE_TOKEN_GRACE_PERIOD_MS` | No | `300000` (5 mins) | Duration in milliseconds during which previous secret remains valid. |

---

## 5. Storage & Rate Limiting

| Variable | Required | Default | Purpose |
|---|:---:|:---:|---|
| `REDIS_URL` | No | Unset (in-memory fallback) | Redis connection URL for distributed rate limiting and replay prevention across serverless instances. |
| `MONGODB_URI` | No | `mongodb://127.0.0.1:27017/prompthash` | MongoDB connection URI for persistent audit logs, reviews, and moderation state. |
