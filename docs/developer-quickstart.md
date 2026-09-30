# Developer Quickstart

Get PromptHash Stellar running locally and make a first Soroban contract interaction in about 25 minutes. This guide uses the repository's pinned toolchains and the development configuration in `environments.toml`.

## What you will have

- The React/Vite frontend at `http://localhost:5173`
- A validated local environment file
- Passing frontend and Soroban contract checks
- A first `get_all_prompts` contract read, or a deterministic local contract test when you do not have a testnet contract yet

## 0. Prerequisites (5 minutes)

Install these before cloning:

- Git
- Node.js 22 or newer
- Corepack (included with current Node.js distributions)
- Rustup and Rust 1.89.0
- Stellar CLI with Soroban support
- Bash, WSL, or Git Bash for the deployment script

Docker Desktop is optional. It is useful for MongoDB/Redis and the auxiliary Express API, but it is not required for the frontend or contract test quickstart.

Verify the tools:

```bash
node --version       # v22 or newer
corepack --version
rustup --version
stellar --version
```

The repository pins Rust in `rust-toolchain.toml` and the WebAssembly target is `wasm32v1-none`.

## 1. Clone and install (4 minutes)

```bash
git clone https://github.com/PromptMintLabs/prompt-mint.git
cd prompt-mint
corepack enable
yarn install
rustup target add wasm32v1-none
```

The optional MongoDB-backed server has a separate dependency set:

```bash
cd server
npm install
cd ..
```

Skip the server install if you only need the frontend and contract workflow.

## 2. Configure local environment (5 minutes)

Create the root environment file:

```bash
cp .env.example .env
```

For a frontend-only start, the template's development values are enough to launch Vite with warnings. For contract reads, replace these placeholders with values for the same Stellar network:

| Variable | Development value |
|---|---|
| `STELLAR_SCAFFOLD_ENV` | `development` |
| `XDG_CONFIG_HOME` | `.config` |
| `PUBLIC_STELLAR_NETWORK` | `TESTNET` |
| `PUBLIC_STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `PUBLIC_STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `PUBLIC_STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `PUBLIC_PROMPT_HASH_CONTRACT_ID` | deployed `C...` contract ID |
| `PUBLIC_STELLAR_NATIVE_ASSET_CONTRACT_ID` | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| `PUBLIC_STELLAR_SIMULATION_ACCOUNT` | funded `G...` account |

The unlock API additionally needs `CHALLENGE_TOKEN_SECRET`, `UNLOCK_PUBLIC_KEY`, and `UNLOCK_PRIVATE_KEY`. Generate real development values before testing unlock; never use production keys or commit `.env`.

Check configuration without printing secret values:

```bash
yarn check:setup --warn-only
```

For a strict check, after filling all required variables, run `yarn check:setup`.

## 3. Run the frontend (2 minutes)

```bash
yarn dev
```

Open <http://localhost:5173>. The command runs the local setup validator in warning mode and then starts Vite. Leave this terminal running. Stop it with `Ctrl+C`.

## 4. Run the contract checks (5 minutes)

In a second terminal at the repository root:

```bash
cargo test -p prompt-hash
```

This compiles and exercises the `prompt-hash` Soroban contract with the SDK test environment and mock asset contract. It does not need an RPC endpoint, wallet, MongoDB, or testnet funds.

This is the fastest first contract interaction when you are onboarding without a deployed contract: the tests invoke contract methods through Soroban's in-memory environment.

## 5. First live contract interaction (optional, 8+ minutes)

Use this path when you have Stellar testnet access and want a real RPC interaction. The script creates or reuses the `config_admin`, `config_admin_two`, `config_admin_three`, `upgrade_admin`, `upgrade_admin_two`, `upgrade_admin_three`, and `fee_wallet` identities, funds them through Friendbot, deploys the contract, initializes it, and calls `get_all_prompts`.

Run from Git Bash or WSL at the repository root:

```bash
NETWORK=testnet bash scripts/deploy.sh
```

At the end, the script prints the contract ID and `Current prompts count`. It also synchronizes the contract ID and network settings into `.env` and `.env.local`.

To repeat the first read manually:

```bash
stellar contract invoke \
  --id <CONTRACT_ID_FROM_DEPLOY_OUTPUT> \
  --source admin \
  --network testnet \
  -- \
  get_all_prompts
```

The expected result for a newly initialized contract is an empty collection. A non-empty collection is also valid if the contract already contains listings.

For a local Soroban network instead, start the network supported by your Stellar CLI, then run:

```bash
NETWORK=local bash scripts/deploy.sh
```

The script handles the local RPC URL, native XLM asset contract, identities, deployment, initialization, and the same `get_all_prompts` verification.

## 6. Optional Express API (2 minutes)

Only needed for MongoDB-backed draft, buyer, webhook, or server routes:

```bash
cp server/.env.example server/.env
cd server
npm run dev
```

The auxiliary API listens on `http://localhost:5000` in the current server implementation. Start MongoDB first if a route needs persistence. The frontend remains on port `5173`.

## Checkpoint

You are ready to develop when these checks succeed:

```bash
yarn check:setup --warn-only
yarn test:frontend --run
cargo test -p prompt-hash
```

Then confirm the browser at <http://localhost:5173> and, when using testnet, confirm `stellar contract invoke ... get_all_prompts` returns a collection.

## Common problems

| Symptom | Fix |
|---|---|
| `yarn` is not recognized | Run `corepack enable`, reopen the terminal, and run `yarn --version`. |
| Rust target missing | Run `rustup target add wasm32v1-none`; the pinned toolchain may install automatically on the first Cargo command. |
| `stellar` is not recognized | Install the Stellar CLI with Soroban support and verify `stellar --version` before running deployment. |
| Vite starts but contract reads fail | Ensure network, passphrase, RPC URL, contract ID, and simulation account all belong to the same network. |
| Friendbot or deployment fails | Check testnet connectivity and account funding; rerun the script, which reuses generated identities. |
| Strict setup check reports placeholders | Replace the `C...`, `G...`, and dummy base64 values in `.env`; `--warn-only` is intentionally suitable for the frontend-only start. |

For the full environment matrix and serverless unlock configuration, continue with [`environments.md`](environments.md). For contributor workflows and CI checks, see [`contributing.md`](contributing.md).
