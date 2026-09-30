import { withObservability } from "../src/lib/observability/wrapper";
import { IndexerState } from "../server/src/models/IndexerState";
import connectDb from "../server/src/db/connectDb";
import { negotiateVersion } from "../src/lib/api/versionGuard";
import { withVersion } from "../src/lib/api/payloadVersion";
import mongoose from "mongoose";
import { getRedisClient } from "../src/lib/observability/redisClient";
import { rpcUrl, promptHashContractId } from "../src/lib/env";
import { Server } from "@stellar/stellar-sdk/rpc";
import { Contract, xdr } from "@stellar/stellar-sdk";

async function checkDependency(name: string, checkFn: () => Promise<void>) {
  const start = performance.now();
  let status = "down";
  try {
    await checkFn();
    status = "up";
  } catch (error) {
    console.error(`Health check failed for ${name}:`, error);
  }
  return {
    status,
    latencyMs: Math.round(performance.now() - start),
    lastCheck: new Date().toISOString()
  };
}

function verifyContractIdConfig(): { valid: boolean; contractId?: string; error?: string } {
  const contractId = process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID?.trim();
  if (!contractId) {
    return { valid: false, error: "PUBLIC_PROMPT_HASH_CONTRACT_ID is missing or unconfigured" };
  }
  if (!/^C[A-Z0-9]{55}$/.test(contractId)) {
    return { valid: false, contractId, error: "PUBLIC_PROMPT_HASH_CONTRACT_ID format is invalid" };
  }
  return { valid: true, contractId };
}

async function verifyRpcReachability(timeoutMs = 5000): Promise<{ reachable: boolean; error?: string }> {
  const rpcUrl = process.env.PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { reachable: false, error: `RPC responded with HTTP ${res.status}` };
    }
    const json = (await res.json()) as { result?: { status?: string } };
    if (json?.result?.status === "healthy") {
      return { reachable: true };
    }
    return {
      reachable: false,
      error: json?.result?.status ? `RPC status is ${json.result.status}` : "RPC returned invalid health response",
    };
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : "RPC ping failed" };
  }
}

async function handler(_req: any, res: any) {
  const version = negotiateVersion(_req, res);
  if (!version) return;

  let state: any = null;
  try {
    await connectDb();
    state = await IndexerState.findOne({ key: "prompt_hash_contract" });
  } catch (error) {
    // Ignore DB connection errors if indexer state is optional in standalone mode
    console.error("Health check DB error:", error);
  }

  const contractCheck = verifyContractIdConfig();
  const rpcCheck = await verifyRpcReachability();

  const isHealthy = contractCheck.valid && rpcCheck.reachable;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json(
    withVersion(
      {
        status: isHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: typeof process.uptime === "function" ? process.uptime() : 0,
        indexer: {
          lastProcessedLedger: state?.lastIndexedLedger || 0,
        },
        rpc: {
          status: rpcCheck.reachable ? "up" : "down",
          ...(rpcCheck.error ? { error: rpcCheck.error } : {}),
        },
        contractConfig: {
          configured: contractCheck.valid,
          ...(contractCheck.error ? { error: contractCheck.error } : {}),
        },
      },
      version,
    ),
  );
}

export default withObservability(handler, "health");