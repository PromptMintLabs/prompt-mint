import { readFile } from "node:fs/promises";

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  console.error(
    "Usage: node scripts/load/compare-results.mjs BASELINE CANDIDATE",
  );
  process.exit(2);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
const components = [
  ["application", "component_application_duration"],
  ["database", "component_database_duration"],
  ["rpc", "component_rpc_duration"],
];

function p95(result, metric) {
  return result.metrics?.[metric]?.values?.["p(95)"] ?? null;
}

console.log("component\tbaseline_p95_ms\tcandidate_p95_ms\tdelta");
for (const [component, metric] of components) {
  const before = p95(baseline, metric);
  const after = p95(candidate, metric);
  const delta =
    before && after
      ? `${(((after - before) / before) * 100).toFixed(1)}%`
      : "n/a";
  console.log(`${component}\t${before ?? "n/a"}\t${after ?? "n/a"}\t${delta}`);
}

const beforeLimited =
  baseline.metrics?.rate_limit_responses?.values?.rate ?? null;
const afterLimited =
  candidate.metrics?.rate_limit_responses?.values?.rate ?? null;
console.log(
  `rate-limit\t${beforeLimited ?? "n/a"}\t${afterLimited ?? "n/a"}\t${
    beforeLimited !== null && afterLimited !== null
      ? `${((afterLimited - beforeLimited) * 100).toFixed(2)}pp`
      : "n/a"
  }`,
);

const failedThresholds = Object.entries(candidate.metrics || {})
  .filter(([, metric]) => metric.thresholds)
  .flatMap(([name, metric]) =>
    Object.entries(metric.thresholds)
      .filter(([, threshold]) => !threshold.ok)
      .map(([threshold]) => `${name}: ${threshold}`),
  );
if (failedThresholds.length) {
  console.error(`Failed thresholds:\n- ${failedThresholds.join("\n- ")}`);
  process.exitCode = 1;
}
