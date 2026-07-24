import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { gzipSync } from "zlib";
import {
  checkBudgets,
  ROUTE_BUDGETS,
  type BuildRouteData,
  type BudgetReport,
  type ContributorEntry,
} from "../src/test/performance/budgets.ts";

const DIST_ASSETS = resolve(process.cwd(), "dist", "assets");
const REPORT_PATH = resolve(process.cwd(), "budget-report.json");

function getGzippedSize(filePath: string): number {
  const content = readFileSync(filePath);
  return gzipSync(content).length;
}

function extractRouteFromChunkName(filename: string): string | null {
  const knownRoutes = Object.keys(ROUTE_BUDGETS);
  const lower = filename.toLowerCase();
  for (const route of knownRoutes) {
    if (lower.includes(route.toLowerCase().replace("-", "")) || lower.includes(route.toLowerCase())) {
      return route;
    }
  }
  return null;
}

function analyzeBuildAssets(): BuildRouteData[] {
  if (!existsSync(DIST_ASSETS)) {
    console.error(`Build output not found at ${DIST_ASSETS}. Run 'yarn build' first.`);
    process.exit(1);
  }

  const files = readdirSync(DIST_ASSETS);
  const jsFiles = files.filter((f) => f.endsWith(".js"));
  const imageFiles = files.filter((f) => /\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(f));

  const routeChunks: Map<string, ContributorEntry[]> = new Map();
  const routeImageSizes: Map<string, number> = new Map();
  const unmatched: ContributorEntry[] = [];

  for (const file of jsFiles) {
    const filePath = join(DIST_ASSETS, file);
    const gzipSizeBytes = getGzippedSize(filePath);
    const gzipSizeKB = Math.round((gzipSizeBytes / 1024) * 100) / 100;
    const entry: ContributorEntry = { name: file, size: gzipSizeKB };
    const route = extractRouteFromChunkName(file);

    if (route) {
      const existing = routeChunks.get(route) ?? [];
      existing.push(entry);
      routeChunks.set(route, existing);
    } else {
      unmatched.push(entry);
    }
  }

  for (const file of imageFiles) {
    const sizeBytes = readFileSync(join(DIST_ASSETS, file)).length;
    const sizeKB = Math.round((sizeBytes / 1024) * 100) / 100;
    const route = extractRouteFromChunkName(file);

    if (route) {
      routeImageSizes.set(route, (routeImageSizes.get(route) ?? 0) + sizeKB);
    }
  }

  const knownRoutes = Object.keys(ROUTE_BUDGETS);
  return knownRoutes.map((route) => {
    const deps = routeChunks.get(route) ?? [];
    const totalJS = deps.reduce((sum, d) => sum + d.size, 0);
    const totalImg = routeImageSizes.get(route) ?? 0;

    return {
      route,
      jsSize: totalJS > 0 ? totalJS : (unmatched.length > 0 ? 0 : undefined),
      imageSize: totalImg,
      dependencies: [...deps, ...unmatched],
    };
  });
}

function renderReport(report: BudgetReport): void {
  const failures = report.filter((r) => !r.pass);
  const passes = report.filter((r) => r.pass);

  console.log("\n========================================");
  console.log("  Performance Budget Report");
  console.log("========================================\n");

  for (const r of report) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(`  [${icon}] Route: ${r.route} (${r.profile})`);

    if (r.violations.length > 0) {
      for (const v of r.violations) {
        console.log(
          `    ${v.metric}: actual ${v.actual} exceeds budget ${v.budget}`,
        );
      }
      if (r.topContributors.length > 0) {
        console.log(`    Top contributors:`);
        for (const c of r.topContributors) {
          console.log(`      - ${c.name}: ${c.size} kB`);
        }
      }
    }
    console.log("");
  }

  console.log(`  ${passes.length} passed, ${failures.length} failed\n`);
}

function main(): void {
  const profile = (process.argv[2] as "desktop" | "mobile" | "reduced-capability") ?? "desktop";
  const buildData = analyzeBuildAssets();
  const report = checkBudgets(buildData, profile);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Budget report written to ${REPORT_PATH}`);

  renderReport(report);

  const failures = report.filter((r) => !r.pass);
  if (failures.length > 0) {
    console.log("Performance budget violations detected!");
    process.exit(1);
  }

  console.log("All performance budgets passed.");
}

main();
