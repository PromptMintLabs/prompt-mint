#!/usr/bin/env node
/**
 * Reports whether the configured Soroban contract is reachable on the configured
 * network: the network, the RPC endpoint, the latest ledger, and whether the
 * contract's instance entry actually exists there.
 *
 *   node scripts/check-chain-status.mjs
 *   node scripts/check-chain-status.mjs --network=mainnet
 *   node scripts/check-chain-status.mjs --json | jq .verdict.exitCode
 *
 * Deliberately dependency-free. `@stellar/stellar-sdk` would build the ledger key
 * for us, but scripts/ is the layer that should run before anything is installed —
 * and the key we need is a fixed-size structure, so it is assembled below and pinned
 * by tests.
 *
 * Exit codes: 0 reachable, 1 unreachable / contract missing, 2 configuration does
 * not make sense (no contract id, or a mainnet endpoint asked about as testnet).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  ConfigError,
  EXIT_MISCONFIGURED,
  EXIT_UNREACHABLE,
  contractInstanceLedgerKey,
  detectNetworkMismatch,
  formatReport,
  parseAddressBook,
  resolveTargets,
  summarize,
} from "./lib/chain-status.mjs";

const HELP = `Usage: node scripts/check-chain-status.mjs [options]

  --network=<name>      testnet (default), mainnet, local… as recorded in the address book
  --contract=<name>     contract key in the address book (default: prompt_hash)
  --address-book=<path> address book to read (default: deployments/address-book.json)
  --timeout=<ms>        per-request timeout (default: 10000)
  --json                print the result as JSON instead of a report
  --help                this text

Environment overrides, useful in CI: PUBLIC_STELLAR_RPC_URL, STELLAR_NETWORK,
PUBLIC_PROMPT_HASH_CONTRACT_ID.
`;

function parseArgs(argv) {
  const options = { network: null, contract: "prompt_hash", addressBook: "deployments/address-book.json", timeout: 10_000, json: false, help: false };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--json") options.json = true;
    else if (arg.startsWith("--network=")) options.network = arg.slice("--network=".length);
    else if (arg.startsWith("--contract=")) options.contract = arg.slice("--contract=".length);
    else if (arg.startsWith("--address-book=")) options.addressBook = arg.slice("--address-book=".length);
    else if (arg.startsWith("--timeout=")) {
      const parsed = Number(arg.slice("--timeout=".length));
      if (!Number.isFinite(parsed) || parsed <= 0) throw new ConfigError(`--timeout must be a positive number of milliseconds`);
      options.timeout = parsed;
    } else {
      throw new ConfigError(`Unknown argument "${arg}". Try --help.`);
    }
  }

  return options;
}

async function rpcCall({ rpcUrl, method, params, timeout, id = 1 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(`RPC error ${payload.error.code}: ${payload.error.message}`);
    }

    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const bookPath = path.resolve(process.cwd(), options.addressBook);
  const addressBook = parseAddressBook(await readFile(bookPath, "utf8"), { source: options.addressBook });
  const target = resolveTargets({ addressBook, network: options.network, contract: options.contract, env: process.env });

  const mismatch = detectNetworkMismatch(target);
  if (mismatch && !options.json) {
    process.stderr.write(`warning: ${mismatch}\n`);
  }

  let latestLedger = null;
  let contract = null;
  let rpcError = null;

  // Built before the network call on purpose: a malformed contract id is a
  // configuration error (exit 2), not an RPC failure, and it should not be reported
  // as "the endpoint did not answer".
  const instanceKey = target.contractId ? contractInstanceLedgerKey(target.contractId) : null;

  try {
    const ledger = await rpcCall({ rpcUrl: target.rpcUrl, method: "getLatestLedger", params: {}, timeout: options.timeout });
    latestLedger = ledger?.sequence ?? null;

    if (instanceKey && latestLedger != null) {
      const entries = await rpcCall({
        rpcUrl: target.rpcUrl,
        method: "getLedgerEntries",
        params: { keys: [instanceKey] },
        timeout: options.timeout,
        id: 2,
      });

      const entry = entries?.entries?.[0];
      contract = {
        found: Boolean(entry),
        lastModifiedLedger: entry?.lastModifiedLedgerSeq ? Number(entry.lastModifiedLedgerSeq) : null,
      };
    }
  } catch (error) {
    rpcError = error.message;
  }

  const verdict = summarize({ target, latestLedger, contract });
  const exitCode = mismatch ? EXIT_MISCONFIGURED : (rpcError ? EXIT_UNREACHABLE : verdict.exitCode);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          target,
          latestLedger,
          contract,
          rpcError,
          mismatch,
          verdict: { ...verdict, exitCode },
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(`${formatReport({ target, latestLedger, contract, verdict })}\n`);
    if (rpcError) process.stderr.write(`\nrpc: ${rpcError}\n`);
    if (mismatch) process.stdout.write(`\n${mismatch}\n`);
  }

  return exitCode;
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      const prefix = error instanceof ConfigError ? "configuration" : "unexpected";
      process.stderr.write(`${prefix} error: ${error.message}\n`);
      process.exit(error instanceof ConfigError ? EXIT_MISCONFIGURED : 1);
    });
}
