import http from "k6/http";
import exec from "k6/execution";
import { check, fail, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend } from "k6/metrics";

const baseUrl = (__ENV.BASE_URL || "").replace(/\/$/, "");
const rpcUrl = __ENV.RPC_URL || "https://soroban-testnet.stellar.org";
const contractId = __ENV.CONTRACT_ID || "";
const resultsPath = __ENV.RESULTS_PATH || "load-results/summary.json";
const duration = __ENV.DURATION || "2m";

function positiveInt(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function requiredPositiveInt(name) {
  if (!__ENV[name]) {
    throw new Error(`${name} is required.`);
  }
  return positiveInt(name, 0);
}

function assertSafeTarget() {
  if (__ENV.LOAD_TEST_ACK !== "isolated-test-data") {
    throw new Error(
      "Set LOAD_TEST_ACK=isolated-test-data after completing the runbook checklist.",
    );
  }
  let target;
  try {
    target = new URL(baseUrl);
  } catch {
    throw new Error("BASE_URL must be an absolute URL.");
  }
  const safeHost =
    /(^localhost$|^127\.0\.0\.1$|staging|test|dev|preview)/i.test(
      target.hostname,
    );
  const forbiddenHost =
    /(^|\.)promptmint\.(com|app|io)$|prompt-mint.*prod/i.test(target.hostname);
  if (!safeHost || forbiddenHost) {
    throw new Error(`Refusing load test target: ${target.hostname}`);
  }
  if (!/testnet/i.test(__ENV.NETWORK || "")) {
    throw new Error("NETWORK must explicitly identify Stellar testnet.");
  }
  if (!contractId) {
    throw new Error("CONTRACT_ID must be an isolated testnet contract.");
  }
}

assertSafeTarget();

const fixtures = new SharedArray("authorized unlock fixtures", () => {
  const path = __ENV.FIXTURES_FILE || "./fixtures/generated.json";
  const parsed = JSON.parse(open(path));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      "FIXTURES_FILE must contain at least one authorized unlock fixture.",
    );
  }
  for (const fixture of parsed) {
    if (
      fixture.fixtureTag !== "promptmint-load-test" ||
      !fixture.address ||
      !fixture.promptId ||
      !fixture.token ||
      !fixture.signedMessage
    ) {
      throw new Error(
        "Every fixture must be tagged promptmint-load-test and fully populated.",
      );
    }
  }
  return parsed;
});

const appLatency = new Trend("component_application_duration", true);
const databaseLatency = new Trend("component_database_duration", true);
const rpcLatency = new Trend("component_rpc_duration", true);
const challengeAccepted = new Rate("challenge_accepted");
const unlockSucceeded = new Rate("unlock_succeeded");
const rateLimited = new Rate("rate_limit_responses");
const indexingRpcSucceeded = new Rate("indexing_rpc_succeeded");

const browseRate = positiveInt("BROWSE_RATE", 20);
const challengeRate = positiveInt("CHALLENGE_RATE", 2);
const unlockRate = positiveInt("UNLOCK_RATE", 1);
const indexRate = positiveInt("INDEX_RATE", 4);
const preAllocatedVUs = positiveInt("PREALLOCATED_VUS", 20);
const indexStartLedger = requiredPositiveInt("INDEX_START_LEDGER");

export const options = {
  discardResponseBodies: true,
  scenarios: {
    browse_catalog: {
      executor: "constant-arrival-rate",
      exec: "browseCatalog",
      rate: browseRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs,
      tags: { flow: "browse", component: "application_database" },
    },
    challenge_issuance: {
      executor: "constant-arrival-rate",
      exec: "issueChallenge",
      rate: challengeRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs,
      startTime: "5s",
      tags: { flow: "challenge", component: "application_rate_limit" },
    },
    authorized_unlock: {
      executor: "constant-arrival-rate",
      exec: "authorizedUnlock",
      rate: unlockRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs,
      startTime: "10s",
      maxVUs: preAllocatedVUs * 2,
      tags: { flow: "unlock", component: "application_rpc" },
    },
    indexer_event_reads: {
      executor: "constant-arrival-rate",
      exec: "readIndexerEvents",
      rate: indexRate,
      timeUnit: "1s",
      duration,
      preAllocatedVUs,
      startTime: "15s",
      tags: { flow: "indexing", component: "rpc" },
    },
    indexer_health: {
      executor: "constant-vus",
      exec: "readIndexerHealth",
      vus: 1,
      duration,
      startTime: "15s",
      tags: { flow: "indexing", component: "application_database" },
    },
  },
  thresholds: {
    "http_req_failed{flow:browse}": ["rate<0.01"],
    "http_req_duration{flow:browse}": ["p(95)<750"],
    challenge_accepted: ["rate>0.95"],
    "http_req_duration{flow:challenge}": ["p(95)<500"],
    unlock_succeeded: ["rate>0.98"],
    "http_req_duration{flow:unlock}": ["p(95)<1500"],
    indexing_rpc_succeeded: ["rate>0.99"],
    "component_rpc_duration{flow:indexing}": ["p(95)<1000"],
    "http_req_failed{flow:indexer_health}": ["rate<0.01"],
    dropped_iterations: ["count==0"],
  },
};

function fixtureForIteration() {
  const index = exec.scenario.iterationInTest;
  if (index >= fixtures.length) {
    fail(
      `Authorized unlock fixtures exhausted at iteration ${index}; provide at least rate × duration fixtures.`,
    );
  }
  return fixtures[index];
}

function syntheticClientIp(iteration) {
  const third = Math.floor(iteration / 250) % 250;
  const fourth = (iteration % 250) + 1;
  return `198.51.${third}.${fourth}`;
}

export function browseCatalog() {
  const fixture = fixtures[exec.scenario.iterationInTest % fixtures.length];
  const response = http.get(
    `${baseUrl}/api/reviews/list?promptId=${encodeURIComponent(fixture.promptId)}`,
    { tags: { flow: "browse", component: "application_database" } },
  );
  appLatency.add(response.timings.duration, { flow: "browse" });
  databaseLatency.add(response.timings.waiting, { flow: "browse" });
  check(response, { "browse returns 200": (res) => res.status === 200 });
}

export function issueChallenge() {
  const fixture = fixtures[exec.scenario.iterationInTest % fixtures.length];
  const response = http.post(
    `${baseUrl}/api/auth/challenge`,
    JSON.stringify({ address: fixture.address, promptId: fixture.promptId }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": syntheticClientIp(exec.scenario.iterationInTest),
      },
      tags: { flow: "challenge", component: "application_rate_limit" },
    },
  );
  appLatency.add(response.timings.duration, { flow: "challenge" });
  challengeAccepted.add(response.status === 200);
  rateLimited.add(response.status === 429, { flow: "challenge" });
  check(response, { "challenge is accepted": (res) => res.status === 200 });
}

export function authorizedUnlock() {
  const fixture = fixtureForIteration();
  const response = http.post(
    `${baseUrl}/api/prompts/unlock`,
    JSON.stringify({
      address: fixture.address,
      promptId: fixture.promptId,
      token: fixture.token,
      signedMessage: fixture.signedMessage,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": syntheticClientIp(exec.scenario.iterationInTest),
      },
      tags: { flow: "unlock", component: "application_rpc" },
    },
  );
  appLatency.add(response.timings.duration, { flow: "unlock" });
  unlockSucceeded.add(response.status === 200);
  rateLimited.add(response.status === 429, { flow: "unlock" });
  check(response, {
    "authorized unlock succeeds": (res) => res.status === 200,
  });
}

export function readIndexerEvents() {
  const response = http.post(
    rpcUrl,
    JSON.stringify({
      jsonrpc: "2.0",
      id: exec.scenario.iterationInTest,
      method: "getEvents",
      params: {
        startLedger: indexStartLedger,
        filters: [{ type: "contract", contractIds: [contractId] }],
        pagination: { limit: positiveInt("INDEX_PAGE_SIZE", 100) },
      },
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { flow: "indexing", component: "rpc" },
      responseType: "text",
    },
  );
  rpcLatency.add(response.timings.duration, { flow: "indexing" });
  let rpcError = true;
  try {
    rpcError = Boolean(response.json("error"));
  } catch {
    rpcError = true;
  }
  const ok = response.status === 200 && !rpcError;
  indexingRpcSucceeded.add(ok);
  check(response, { "indexer RPC event read succeeds": () => ok });
}

export function readIndexerHealth() {
  const response = http.get(`${baseUrl}/api/health`, {
    tags: { flow: "indexer_health", component: "application_database" },
  });
  appLatency.add(response.timings.duration, { flow: "indexer_health" });
  databaseLatency.add(response.timings.waiting, { flow: "indexer_health" });
  check(response, {
    "indexer health returns 200": (res) => res.status === 200,
  });
  sleep(5);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data.metrics, null, 2),
    [resultsPath]: JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        target: baseUrl,
        network: __ENV.NETWORK,
        contractId,
        rates: { browseRate, challengeRate, unlockRate, indexRate, duration },
        metrics: data.metrics,
      },
      null,
      2,
    ),
  };
}
