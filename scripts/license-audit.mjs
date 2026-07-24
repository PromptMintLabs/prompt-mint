#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NODE_MODULES = join(ROOT, "node_modules");
const POLICY_PATH = join(ROOT, "license-policy.json");

function fail(msg) {
  console.error("\x1b[31m%s\x1b[0m", `  ERROR  ${msg}`);
  process.exitCode = 1;
}

function warn(msg) {
  console.error("\x1b[33m%s\x1b[0m", `  WARN   ${msg}`);
}

function info(msg) {
  console.log("\x1b[36m%s\x1b[0m", `  INFO   ${msg}`);
}

function success(msg) {
  console.log("\x1b[32m%s\x1b[0m", `  OK     ${msg}`);
}

const policyRaw = readFileSync(POLICY_PATH, "utf-8");
const policy = JSON.parse(policyRaw);

const ALLOWED = new Set(policy.allowed);
const DENIED = new Set(policy.denied);
const REVIEW = new Set(policy.reviewRequired);
const EXCEPTIONS = new Map();

for (const exc of policy.exceptions) {
  EXCEPTIONS.set(exc.package, exc);
}

function toKey(name, version) {
  return `${name}@${version}`;
}

function normalizeLicense(raw) {
  if (!raw) return "UNLICENSED";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const parts = raw.map(normalizeLicense).filter((l) => l !== "UNLICENSED");
    return parts.length > 0 ? `(${parts.join(" OR ")})` : "UNLICENSED";
  }
  if (raw && typeof raw === "object" && raw.type) return raw.type;
  return "UNLICENSED";
}

function readPkg(dir) {
  const pj = join(dir, "package.json");
  if (!existsSync(pj)) return null;
  try {
    return JSON.parse(readFileSync(pj, "utf-8"));
  } catch {
    return null;
  }
}

function walkModules(baseDir, parentChain) {
  const entries = new Map();

  const dirs = [];
  try {
    for (const entry of readdirSync(baseDir)) {
      const full = join(baseDir, entry);
      try {
        if (statSync(full).isDirectory()) {
          dirs.push({ name: entry, path: full });
        }
      } catch { /* skip unreadable */ }
    }
  } catch { return entries; }

  for (const { name, path: dirPath } of dirs) {
    if (name.startsWith("@")) {
      let scoped = [];
      try {
        scoped = readdirSync(dirPath);
      } catch { continue; }
      for (const sub of scoped) {
        const scopedName = `${name}/${sub}`;
        const scopedPath = join(dirPath, sub);
        processPackage(scopedPath, scopedName, parentChain, entries);
      }
    } else if (name !== ".bin" && name !== ".cache") {
      processPackage(dirPath, name, parentChain, entries);
    }
  }

  return entries;
}

function processPackage(dirPath, name, parentChain, entries) {
  let stat;
  try {
    stat = statSync(dirPath);
  } catch {
    return;
  }
  if (!stat.isDirectory()) return;

  const pkg = readPkg(dirPath);
  if (!pkg || !pkg.name) return;

  const version = pkg.version || "0.0.0";
  const licenseRaw = pkg.license || pkg.licenses;
  const license = normalizeLicense(licenseRaw);
  const chain = parentChain.concat(name);
  const key = toKey(name, version);

  entries.set(key, {
    name,
    version,
    license,
    chain,
    key,
  });

  const nestedNm = join(dirPath, "node_modules");
  if (existsSync(nestedNm)) {
    const nested = walkModules(nestedNm, chain);
    for (const [nk, nv] of nested) {
      entries.set(nk, nv);
    }
  }
}

function classify(pkg) {
  if (pkg.license === "UNLICENSED") return "unlicensed";

  const licenses = pkg.license
    .replace(/^\(|\)$/g, "")
    .split(" OR ")
    .map((s) => s.trim());

  for (const lic of licenses) {
    if (DENIED.has(lic)) return "denied";
  }
  for (const lic of licenses) {
    if (REVIEW.has(lic)) return "review";
  }
  for (const lic of licenses) {
    if (ALLOWED.has(lic)) return "allowed";
  }
  return "unknown";
}

function formatChain(chain) {
  return chain.join(" → ");
}

console.log("=== Prompt-Hash License Compliance Audit ===\n");

info(`Policy: ${POLICY_PATH}`);
info(`Allowed: ${ALLOWED.size}  |  Denied: ${DENIED.size}  |  Review: ${REVIEW.size}  |  Exceptions: ${EXCEPTIONS.size}`);
console.log("");

info("Scanning node_modules...");
const allPkgs = walkModules(NODE_MODULES, []);
console.log(`  Found ${allPkgs.size} packages.\n`);

const denied = [];
const review = [];
const unlicensed = [];
const unknown = [];

for (const [, pkg] of allPkgs) {
  const cls = classify(pkg);

  if (cls === "denied") {
    const exc = EXCEPTIONS.get(pkg.key);
    if (exc) {
      success(`Exception: ${pkg.key}  (${pkg.license}) — owner ${exc.owner}, scope ${exc.scope}, expiry ${exc.expiry}`);
      continue;
    }
    denied.push(pkg);
  } else if (cls === "review") {
    const exc = EXCEPTIONS.get(pkg.key);
    if (exc) {
      success(`Exception: ${pkg.key}  (${pkg.license}) — owner ${exc.owner}, scope ${exc.scope}, expiry ${exc.expiry}`);
      continue;
    }
    review.push(pkg);
  } else if (cls === "unlicensed") {
    unlicensed.push(pkg);
  } else if (cls === "unknown") {
    unknown.push(pkg);
  }
}

let hasFailures = false;

if (denied.length > 0) {
  hasFailures = true;
  console.log("\n--- DENIED LICENSES (blocked) ---\n");
  for (const pkg of denied) {
    fail(`${pkg.name}@${pkg.version}  license=${pkg.license}  path=${formatChain(pkg.chain)}`);
  }
}

if (review.length > 0) {
  hasFailures = true;
  console.log("\n--- REVIEW-REQUIRED LICENSES (blocked until reviewed) ---\n");
  for (const pkg of review) {
    fail(`${pkg.name}@${pkg.version}  license=${pkg.license}  path=${formatChain(pkg.chain)}`);
  }
}

if (unlicensed.length > 0) {
  hasFailures = true;
  console.log("\n--- UNLICENSED PACKAGES (blocked) ---\n");
  for (const pkg of unlicensed) {
    fail(`${pkg.name}@${pkg.version}  license=UNLICENSED  path=${formatChain(pkg.chain)}`);
  }
}

if (unknown.length > 0) {
  hasFailures = true;
  console.log("\n--- UNKNOWN LICENSES (blocked) ---\n");
  for (const pkg of unknown) {
    fail(`${pkg.name}@${pkg.version}  license=${pkg.license}  path=${formatChain(pkg.chain)}`);
  }
}

if (hasFailures) {
  console.log("");
  console.log("To add an exception, edit license-policy.json → .exceptions[].");
  console.log("Format: { package, license, owner, rationale, scope, expiry }");
  console.log("");
  process.exit(1);
}

success("All npm dependencies pass license policy.\n");
console.log(`  ${allPkgs.size} packages scanned, 0 violations.`);
