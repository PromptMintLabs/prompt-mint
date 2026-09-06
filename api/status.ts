import { withObservability } from "../src/lib/observability/wrapper";
import { negotiateVersion } from "../src/lib/api/versionGuard";
import { withVersion } from "../src/lib/api/payloadVersion";
import { apiError, ErrorCode } from "../src/lib/api/errorCodes";
import { getCircuitBreaker, listCircuitBreakers } from "../src/lib/observability/circuitBreaker";
import { metrics } from "../src/lib/observability/metrics";

const STELLAR_RPC_URL =
  process.env.PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const HORIZON_URL =
  process.env.PUBLIC_STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

type ServiceStatus = "up" | "down" | "degraded";

interface ServiceCheck {
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  error?: string;
}

async function pingService(name: string, url: string, timeoutMs = 8000): Promise<ServiceCheck> {
  const breaker = getCircuitBreaker(name.toLowerCase().replace(/\s+/g, "-"));
  const start = Date.now();
  try {
    const res = await breaker.execute(() =>
      fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(timeoutMs),
      }),
    );
    const latencyMs = Date.now() - start;
    metrics.trackEndpointHealth(name, res.ok, latencyMs);
    return {
      name,
      status: res.ok ? "up" : "degraded",
      latencyMs,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    metrics.trackEndpointHealth(name, false, Date.now() - start);
    return {
      name,
      status: "down",
      latencyMs: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function pingRpc(): Promise<ServiceCheck> {
  const breaker = getCircuitBreaker("stellar-rpc");
  const start = Date.now();
  try {
    const res = await breaker.execute(() =>
      fetch(STELLAR_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] }),
        signal: AbortSignal.timeout(8000),
      }),
    );
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      metrics.trackRpcCall("getHealth", latencyMs, "error");
      metrics.trackEndpointHealth("Stellar RPC", false, latencyMs);
      return { name: "Stellar RPC", status: "degraded", latencyMs, error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { result?: { status?: string } };
    const healthy = json?.result?.status === "healthy";
    metrics.trackRpcCall("getHealth", latencyMs, healthy ? "ok" : "error");
    metrics.trackEndpointHealth("Stellar RPC", healthy, latencyMs);
    return {
      name: "Stellar RPC",
      status: healthy ? "up" : "degraded",
      latencyMs,
      ...(healthy ? {} : { error: "RPC reported unhealthy" }),
    };
  } catch (err) {
    metrics.trackRpcCall("getHealth", Date.now() - start, "error");
    metrics.trackEndpointHealth("Stellar RPC", false, Date.now() - start);
    return {
      name: "Stellar RPC",
      status: "down",
      latencyMs: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function pingUnlockService(): Promise<ServiceCheck> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const breaker = getCircuitBreaker("unlock-service");
  const start = Date.now();
  try {
    const res = await breaker.execute(() =>
      fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(6000),
      }),
    );
    const latencyMs = Date.now() - start;
    metrics.trackEndpointHealth("Unlock Service", res.ok, latencyMs);
    return {
      name: "Unlock Service",
      status: res.ok ? "up" : "degraded",
      latencyMs,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (err) {
    metrics.trackEndpointHealth("Unlock Service", false, Date.now() - start);
    return {
      name: "Unlock Service",
      status: "down",
      latencyMs: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json(apiError(ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed."));
    return;
  }

  const version = negotiateVersion(req, res);
  if (!version) return;

  const [rpc, horizon, unlock] = await Promise.all([
    pingRpc(),
    pingService("Horizon", HORIZON_URL),
    pingUnlockService(),
  ]);

  const services: ServiceCheck[] = [rpc, horizon, unlock];
  const overallStatus: ServiceStatus = services.every((s) => s.status === "up")
    ? "up"
    : services.some((s) => s.status === "up")
      ? "degraded"
      : "down";

  const uptime = typeof process.uptime === "function" ? process.uptime() : 0;

  res.status(200).json(
    withVersion(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime,
        services,
        circuitBreakers: listCircuitBreakers(),
      },
      version,
    ),
  );
}

export default withObservability(handler, "status");
