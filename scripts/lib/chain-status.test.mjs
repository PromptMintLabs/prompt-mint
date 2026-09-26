// @vitest-environment node
// These cover a Node-only module: it decodes base32 into a Buffer and the CLI that
// uses it runs under Node, so the suite-wide jsdom default is the wrong environment here.
import { describe, expect, it } from "vitest";

import {
  ConfigError,
  EXIT_MISCONFIGURED,
  EXIT_OK,
  EXIT_UNREACHABLE,
  contractInstanceLedgerKey,
  detectNetworkMismatch,
  formatReport,
  parseAddressBook,
  resolveTargets,
  summarize,
} from "./chain-status.mjs";

const BOOK = {
  contracts: {
    prompt_hash: {
      local: {
        contractId: "C3F4A7D90B6E2C18F43A7D90B6E2C18F43A7D90B6E2C18F43A7D90",
        network: "standalone",
        rpcUrl: "http://localhost:8000/soroban/rpc",
        networkPassphrase: "Standalone Network ; February 2017",
      },
      testnet: {
        contractId: "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
        network: "testnet",
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
        deployedAt: "2026-09-01T00:00:00.000Z",
      },
      mainnet: {
        contractId: "",
        network: "mainnet",
        rpcUrl: "https://mainnet.sorobanrpc.com",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      },
    },
  },
};

describe("parseAddressBook", () => {
  it("parses an address book object or its JSON text", () => {
    expect(parseAddressBook(BOOK).contracts.prompt_hash).toBeDefined();
    expect(parseAddressBook(JSON.stringify(BOOK)).contracts.prompt_hash).toBeDefined();
  });

  it("names the file when the JSON is broken", () => {
    expect(() => parseAddressBook("{ not json", { source: "deployments/address-book.json" })).toThrow(
      /deployments\/address-book\.json is not valid JSON/,
    );
  });

  it("refuses a document that is not an address book", () => {
    expect(() => parseAddressBook({ schemaVersion: 1 })).toThrow(ConfigError);
    expect(() => parseAddressBook({ schemaVersion: 1 })).toThrow(/no "contracts" object/);
  });
});

describe("resolveTargets", () => {
  it("defaults to testnet and reports where the choice came from", () => {
    const target = resolveTargets({ addressBook: BOOK, env: {} });

    expect(target.network).toBe("testnet");
    expect(target.rpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(target.contractId).toBe(BOOK.contracts.prompt_hash.testnet.contractId);
    expect(target.source).toBe("address book");
  });

  it("lets the flag win, then the environment, then the address book", () => {
    expect(resolveTargets({ addressBook: BOOK, network: "mainnet", env: { STELLAR_NETWORK: "testnet" } }).network).toBe("mainnet");
    expect(resolveTargets({ addressBook: BOOK, env: { STELLAR_NETWORK: "mainnet" } }).network).toBe("mainnet");
    expect(resolveTargets({ addressBook: BOOK, env: { STELLAR_NETWORK: "mainnet" } }).source).toBe("environment");
  });

  it("prefers PUBLIC_STELLAR_RPC_URL over the recorded endpoint", () => {
    const target = resolveTargets({ addressBook: BOOK, env: { PUBLIC_STELLAR_RPC_URL: "https://rpc.internal.example" } });

    expect(target.rpcUrl).toBe("https://rpc.internal.example");
  });

  it("lists what is available instead of failing silently on an unknown network", () => {
    expect(() => resolveTargets({ addressBook: BOOK, network: "futurenet", env: {} })).toThrow(/Available: local, testnet, mainnet/);
  });

  it("reports an unknown contract key", () => {
    expect(() => resolveTargets({ addressBook: BOOK, contract: "nope", env: {} })).toThrow(/Known contracts: prompt_hash/);
  });

  it("returns an empty contract id rather than pretending there is one", () => {
    const target = resolveTargets({ addressBook: BOOK, network: "mainnet", env: {} });

    expect(target.contractId).toBe("");
  });
});

describe("detectNetworkMismatch", () => {
  it("flags a mainnet endpoint asked about as testnet", () => {
    expect(detectNetworkMismatch({ network: "testnet", rpcUrl: "https://mainnet.sorobanrpc.com" })).toMatch(
      /looks like a mainnet endpoint, but the target network is testnet/,
    );
  });

  it("flags the reverse", () => {
    expect(detectNetworkMismatch({ network: "mainnet", rpcUrl: "https://soroban-testnet.stellar.org" })).toMatch(/looks like a testnet endpoint/);
  });

  it("accepts matching endpoints and local ones", () => {
    expect(detectNetworkMismatch({ network: "testnet", rpcUrl: "https://soroban-testnet.stellar.org" })).toBeNull();
    expect(detectNetworkMismatch({ network: "mainnet", rpcUrl: "https://mainnet.sorobanrpc.com" })).toBeNull();
    expect(detectNetworkMismatch({ network: "local", rpcUrl: "http://localhost:8000/soroban/rpc" })).toBeNull();
  });

  it("says nothing about an endpoint it has no opinion on", () => {
    expect(detectNetworkMismatch({ network: "testnet", rpcUrl: "https://rpc.internal.example" })).toBeNull();
  });
});

describe("summarize", () => {
  const target = { network: "testnet", rpcUrl: "https://soroban-testnet.stellar.org", contractId: "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE" };

  it("is ok when the RPC and the contract both answer", () => {
    const verdict = summarize({ target, latestLedger: 1234, contract: { found: true, lastModifiedLedger: 1200 } });

    expect(verdict.level).toBe("ok");
    expect(verdict.exitCode).toBe(EXIT_OK);
    expect(verdict.headline).toMatch(/is live on testnet \(ledger 1234\)/);
  });

  it("separates an RPC that is down from a contract that is missing", () => {
    const down = summarize({ target, latestLedger: null, contract: null });
    const missing = summarize({ target, latestLedger: 1234, contract: { found: false } });

    expect(down.exitCode).toBe(EXIT_UNREACHABLE);
    expect(down.headline).toMatch(/did not return a ledger/);
    expect(missing.exitCode).toBe(EXIT_UNREACHABLE);
    expect(missing.headline).toMatch(/was not found on testnet/);
    expect(missing.detail).toMatch(/may be deployed under a different id/);
  });

  it("calls a missing contract id a configuration problem, not an outage", () => {
    const verdict = summarize({ target: { ...target, contractId: "" }, latestLedger: 1234, contract: null });

    expect(verdict.exitCode).toBe(EXIT_MISCONFIGURED);
    expect(verdict.headline).toMatch(/No contract id recorded/);
  });
});

describe("formatReport", () => {
  it("states the facts a reader needs to reproduce the check", () => {
    const report = formatReport({
      target: { network: "testnet", rpcUrl: "https://soroban-testnet.stellar.org", contractId: "CA3D5…6YQGAXE", networkPassphrase: "Test SDF Network ; September 2015", source: "flag" },
      latestLedger: 42,
      contract: { found: true, lastModifiedLedger: 40 },
      verdict: summarize({ target: { contractId: "x" }, latestLedger: 42, contract: { found: true } }),
    });

    expect(report).toContain("network          testnet (flag)");
    expect(report).toContain("latest ledger    42");
    expect(report).toContain("instance         present, last modified at ledger 40");
    expect(report).toContain("OK:");
  });
});

describe("contractInstanceLedgerKey", () => {
  const CONTRACT_ID = "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";

  it("assembles the fixed 48-byte LedgerKey.contractData structure", () => {
    const key = Buffer.from(contractInstanceLedgerKey(CONTRACT_ID), "base64");

    expect(key).toHaveLength(48);
    expect(key.readUInt32BE(0)).toBe(6); // LedgerEntryType.CONTRACT_DATA
    expect(key.readUInt32BE(4)).toBe(1); // SC_ADDRESS_TYPE_CONTRACT
    expect(key.readUInt32BE(40)).toBe(20); // SCV_LEDGER_KEY_CONTRACT_INSTANCE
    expect(key.readUInt32BE(44)).toBe(1); // PERSISTENT
  });

  it("matches the key the SDK builds for a live testnet contract", () => {
    // Not derived here: this is the value @stellar/stellar-sdk's
    // xdr.LedgerKey.contractData(...).toXDR("base64") returns for
    // CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, and a key with exactly
    // these bytes was answered with that contract's instance entry by
    // https://soroban-testnet.stellar.org (getLedgerEntries, ledger 4847363). Pinning it
    // is what keeps a hand-assembled key honest: change a tag and this test says so.
    const LIVE_CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    const SDK_KEY_BASE64 = "AAAABgAAAAHXkotywnA8z+r365/0701QSlWouXn8m0UOoshCtNHOYQAAABQAAAAB";

    expect(contractInstanceLedgerKey(LIVE_CONTRACT_ID)).toBe(SDK_KEY_BASE64);
    expect(Buffer.from(SDK_KEY_BASE64, "base64").subarray(8, 40).toString("hex")).toBe(
      // From StrKey.decodeContract in @stellar/stellar-sdk for the same id.
      "d7928b72c2703ccfeaf7eb9ff4ef4d504a55a8b979fc9b450ea2c842b4d1ce61",
    );
  });

  it("carries the contract bytes, not the base32 text", () => {
    const key = Buffer.from(contractInstanceLedgerKey(CONTRACT_ID), "base64");
    const embedded = key.subarray(8, 40);

    expect(embedded).toHaveLength(32);
    expect(embedded.equals(Buffer.from(CONTRACT_ID.slice(1), "utf8"))).toBe(false);
    expect(embedded.toString("base64")).not.toContain(CONTRACT_ID.slice(1, 10));
  });

  it("refuses anything that is not a contract id, with a readable reason", () => {
    expect(() => contractInstanceLedgerKey("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")).toThrow(
      /is not a contract id/,
    );
    expect(() => contractInstanceLedgerKey("tooshort")).toThrow(ConfigError);
  });
});
