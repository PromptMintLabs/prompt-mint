/**
 * Pure logic for scripts/check-chain-status.mjs.
 *
 * Kept out of the CLI itself so the decisions — which network, which contract,
 * whether the config is self-consistent — are testable without a network call. The
 * CLI only does I/O, and this file is where a reviewer can see the rules.
 */

/** Host a network's RPC endpoint is expected to be under, used to catch mix-ups. */
export const NETWORK_HOST_HINTS = {
  standalone: ["localhost", "127.0.0.1"],
  local: ["localhost", "127.0.0.1"],
  testnet: ["testnet", "futurenet"],
  mainnet: ["mainnet", "public"],
};

export const EXIT_OK = 0;
export const EXIT_UNREACHABLE = 1;
export const EXIT_MISCONFIGURED = 2;

export class ConfigError extends Error {}

/** Parse the address book, failing with a readable message rather than a stack. */
export function parseAddressBook(raw, { source = "deployments/address-book.json" } = {}) {
  let book;
  try {
    book = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    throw new ConfigError(`${source} is not valid JSON: ${error.message}`);
  }

  if (!book || typeof book !== "object" || !book.contracts || typeof book.contracts !== "object") {
    throw new ConfigError(`${source} has no "contracts" object — is this the address book?`);
  }

  return book;
}

/**
 * Work out what to check: the network, its RPC endpoint, and the contract id.
 *
 * `network` wins over the address book's ordering, and the address book wins over
 * environment defaults, because a deployment that was actually recorded is a better
 * description of "where this project is" than a guess.
 */
export function resolveTargets({ addressBook, network, contract = "prompt_hash", env = {} }) {
  const entry = addressBook.contracts?.[contract];
  if (!entry) {
    throw new ConfigError(
      `No entry for contract "${contract}" in the address book. Known contracts: ${Object.keys(
        addressBook.contracts || {},
      ).join(", ") || "none"}.`,
    );
  }

  const chosen = network || env.STELLAR_NETWORK || env.PUBLIC_STELLAR_NETWORK || "testnet";
  const target = entry[chosen];

  if (!target) {
    throw new ConfigError(
      `The address book has no "${chosen}" deployment for ${contract}. Available: ${Object.keys(entry).join(", ")}.`,
    );
  }

  const rpcUrl = env.PUBLIC_STELLAR_RPC_URL || target.rpcUrl || "";
  if (!rpcUrl) {
    throw new ConfigError(
      `No RPC URL for ${contract} on ${chosen}: set PUBLIC_STELLAR_RPC_URL or record rpcUrl in the address book.`,
    );
  }

  const contractId = (env.PUBLIC_PROMPT_HASH_CONTRACT_ID || target.contractId || "").trim();

  return {
    network: chosen,
    rpcUrl,
    networkPassphrase: target.networkPassphrase || "",
    contractId,
    deployedAt: target.deployedAt || null,
    source: network ? "flag" : env.STELLAR_NETWORK ? "environment" : "address book",
  };
}

/**
 * The mismatch this tool exists to catch: a mainnet endpoint asked about as if it
 * were testnet (or the reverse), which looks like "the contract is missing" until you
 * notice you are talking to the wrong chain.
 */
export function detectNetworkMismatch({ network, rpcUrl }) {
  const hints = NETWORK_HOST_HINTS[network];
  if (!hints) return null;

  const host = String(rpcUrl).toLowerCase();
  const contradicting = Object.entries(NETWORK_HOST_HINTS).find(
    ([other, otherHints]) =>
      other !== network &&
      !hints.some((hint) => host.includes(hint)) &&
      otherHints.some((hint) => host.includes(hint)),
  );

  if (!contradicting) return null;

  return `RPC URL ${rpcUrl} looks like a ${contradicting[0]} endpoint, but the target network is ${network}.`;
}

/**
 * Turn the two RPC answers into a verdict and an exit code.
 *
 * `latestLedger: null` means the RPC never answered — that is an outage or a wrong
 * URL, not a missing contract, and the two say different things to whoever is on call.
 */
export function summarize({ target, latestLedger, contract }) {
  if (!target.contractId) {
    return {
      level: "warn",
      exitCode: EXIT_MISCONFIGURED,
      headline: `No contract id recorded for prompt_hash on ${target.network}.`,
      detail:
        "The RPC endpoint can still be checked, but there is nothing deployed to look for. " +
        "Deploy the contract or set PUBLIC_PROMPT_HASH_CONTRACT_ID.",
    };
  }

  if (latestLedger == null) {
    return {
      level: "error",
      exitCode: EXIT_UNREACHABLE,
      headline: `RPC ${target.rpcUrl} did not return a ledger.`,
      detail: "The endpoint is down, unreachable, or not a Soroban RPC. Nothing about the contract can be concluded from this.",
    };
  }

  if (!contract?.found) {
    return {
      level: "error",
      exitCode: EXIT_UNREACHABLE,
      headline: `Contract ${shortenId(target.contractId)} was not found on ${target.network} (ledger ${latestLedger}).`,
      detail:
        "The RPC answers, so this is about the contract: it may be deployed under a different id, " +
        "or on another network.",
    };
  }

  return {
    level: "ok",
    exitCode: EXIT_OK,
    headline: `Contract ${shortenId(target.contractId)} is live on ${target.network} (ledger ${latestLedger}).`,
    detail: `Instance entry read from ${target.rpcUrl}.`,
  };
}

/**
 * XDR for LedgerKey.contractData(contract, LedgerKeyContractInstance, persistent).
 *
 *   LedgerKey union tag            6   (CONTRACT_DATA)
 *   SCAddress union tag            1   (SC_ADDRESS_TYPE_CONTRACT) + 32-byte hash
 *   SCVal union tag               20   (SCV_LEDGER_KEY_CONTRACT_INSTANCE)
 *   ContractDataDurability         1   (PERSISTENT)
 *
 * 48 bytes, constant, so the only variable part is the contract id — which is why this
 * can live without @stellar/stellar-sdk: scripts/ is the layer that has to run before
 * anything is installed. The bytes are pinned by a test against the key the SDK builds
 * for a live testnet contract, and that same key is what the public testnet RPC answers
 * an instance lookup with.
 */
export function contractInstanceLedgerKey(contractId) {
  const strKey = String(contractId).trim();
  if (!/^C[A-Z2-7]{55}$/.test(strKey)) {
    throw new ConfigError(`"${contractId}" is not a contract id (expected C followed by 55 base32 characters).`);
  }

  // StrKey is base32 (no padding) of version byte 0x10 || 32-byte payload || 2-byte
  // CRC16 — 35 bytes, 280 bits, i.e. 56 base32 characters *including* the leading C.
  // Decoding only what follows the C drops the first ten bits of the encoding and turns
  // the version byte into nonsense (0x1a for a real testnet contract, measured).
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of strKey) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new ConfigError(`"${contractId}" contains "${char}", which is not base32.`);
    bits += index.toString(2).padStart(5, "0");
  }

  const payload = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) payload.push(parseInt(bits.slice(i, i + 8), 2));

  if (payload[0] !== 0x10) {
    throw new ConfigError(`"${contractId}" does not decode to a contract id (version byte ${payload[0]}).`);
  }

  const raw = Buffer.from(payload.slice(1, 33));
  if (raw.length !== 32) {
    throw new ConfigError(`"${contractId}" does not decode to 32 bytes of contract id.`);
  }

  const key = Buffer.alloc(48);
  let offset = 0;
  const writeUint32 = (value) => {
    key.writeUInt32BE(value, offset);
    offset += 4;
  };

  writeUint32(6); // LedgerEntryType.CONTRACT_DATA
  writeUint32(1); // SCAddressType.SC_ADDRESS_TYPE_CONTRACT
  raw.copy(key, offset);
  offset += 32;
  writeUint32(20); // SCValType.SCV_LEDGER_KEY_CONTRACT_INSTANCE
  writeUint32(1); // ContractDataDurability.PERSISTENT

  return key.toString("base64");
}

export function shortenId(id) {
  if (!id) return "(none)";
  return id.length <= 14 ? id : `${id.slice(0, 6)}…${id.slice(-5)}`;
}

/** Human-readable report. `--json` callers use the object instead. */
export function formatReport({ target, latestLedger, contract, verdict }) {
  const lines = [
    "Chain status",
    `  network          ${target.network} (${target.source})`,
    `  rpc              ${target.rpcUrl}`,
    `  contract         ${target.contractId || "(not recorded)"}`,
    `  network passphrase ${target.networkPassphrase || "(not recorded)"}`,
    `  latest ledger    ${latestLedger ?? "unavailable"}`,
  ];

  if (contract?.found) {
    lines.push(`  instance         present${contract.lastModifiedLedger ? `, last modified at ledger ${contract.lastModifiedLedger}` : ""}`);
  } else if (contract && !contract.found && latestLedger != null) {
    lines.push("  instance         not found");
  }

  lines.push("", `${verdict.level === "ok" ? "OK" : verdict.level.toUpperCase()}: ${verdict.headline}`, `  ${verdict.detail}`);

  return lines.join("\n");
}
