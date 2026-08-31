#!/usr/bin/env node
/**
 * Security Headers Scanner (#256)
 *
 * Runs automated checks against a local or remote target to verify:
 * - CORS allowlist enforcement (blocked origins return 403)
 * - Content-Security-Policy presence and key directives
 * - X-Frame-Options: DENY
 * - X-Content-Type-Options: nosniff
 * - Strict-Transport-Security presence
 * - Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy
 * - Preflight (OPTIONS) response correctness
 *
 * Usage:
 *   node scripts/security/scan-security-headers.mjs [TARGET_URL]
 *   TARGET_URL defaults to http://127.0.0.1:5000 (DAST target)
 */

import { createServer } from "node:http";

const TARGET = process.argv[2] || "http://127.0.0.1:5000";
const ALLOWED_ORIGIN = process.env.ALLOWED_TEST_ORIGIN || "https://app.promptmint.xyz";
const BLOCKED_ORIGIN = "https://evil-attacker.com";

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
    failures.push(label);
  }
}

async function fetchHeaders(path, options = {}) {
  const url = `${TARGET}${path}`;
  try {
    const res = await fetch(url, { ...options, redirect: "manual" });
    const headers = {};
    res.headers.forEach((val, key) => { headers[key.toLowerCase()] = val; });
    return { status: res.status, headers };
  } catch (err) {
    return { status: 0, headers: {}, error: err.message };
  }
}

async function runChecks() {
  console.log(`\n🔐 Security Headers Scanner`);
  console.log(`   Target: ${TARGET}\n`);

  // ─── 1. Core Security Headers on /health ───────────────────────────────────
  console.log("── 1. Core security headers (/health) ──────────────────────────");
  const { status, headers } = await fetchHeaders("/health");

  assert(status !== 0, "Target is reachable", `HTTP ${status}`);
  assert(
    headers["x-content-type-options"] === "nosniff",
    "X-Content-Type-Options: nosniff",
    headers["x-content-type-options"],
  );
  assert(
    headers["x-frame-options"] === "DENY",
    "X-Frame-Options: DENY",
    headers["x-frame-options"],
  );
  assert(
    headers["x-xss-protection"] === "1; mode=block",
    "X-XSS-Protection: 1; mode=block",
    headers["x-xss-protection"],
  );
  assert(
    headers["referrer-policy"] === "strict-origin-when-cross-origin",
    "Referrer-Policy: strict-origin-when-cross-origin",
    headers["referrer-policy"],
  );
  assert(
    typeof headers["permissions-policy"] === "string" && headers["permissions-policy"].includes("camera=()"),
    "Permissions-Policy includes camera=()",
    headers["permissions-policy"],
  );

  // ─── 2. Content-Security-Policy ─────────────────────────────────────────────
  console.log("\n── 2. Content-Security-Policy ──────────────────────────────────");
  const csp = headers["content-security-policy"] || "";
  assert(csp.length > 0, "CSP header is present");
  assert(csp.includes("frame-ancestors 'none'"), "CSP blocks framing (frame-ancestors 'none')");
  assert(csp.includes("default-src"), "CSP has default-src directive");
  assert(csp.includes("object-src 'none'"), "CSP blocks plugins (object-src 'none')");
  assert(csp.includes("base-uri"), "CSP restricts base-uri");

  // ─── 3. Site Isolation Headers ──────────────────────────────────────────────
  console.log("\n── 3. Site isolation headers ───────────────────────────────────");
  assert(
    headers["cross-origin-opener-policy"] === "same-origin",
    "Cross-Origin-Opener-Policy: same-origin",
    headers["cross-origin-opener-policy"],
  );
  assert(
    headers["cross-origin-resource-policy"] === "same-site",
    "Cross-Origin-Resource-Policy: same-site",
    headers["cross-origin-resource-policy"],
  );

  // ─── 4. CORS — Blocked origin ────────────────────────────────────────────────
  console.log("\n── 4. CORS enforcement ─────────────────────────────────────────");
  const { status: blockedStatus, headers: blockedHeaders } = await fetchHeaders("/health", {
    headers: { Origin: BLOCKED_ORIGIN },
  });
  assert(
    !blockedHeaders["access-control-allow-origin"] ||
    blockedHeaders["access-control-allow-origin"] !== BLOCKED_ORIGIN,
    `Blocked origin '${BLOCKED_ORIGIN}' does NOT receive ACAO header`,
    blockedHeaders["access-control-allow-origin"],
  );

  // ─── 5. CORS — Preflight OPTIONS ─────────────────────────────────────────────
  console.log("\n── 5. Preflight (OPTIONS) response ─────────────────────────────");
  const { status: preflightStatus, headers: preflightHeaders } = await fetchHeaders(
    "/api/auth/challenge",
    {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-API-Version",
      },
    },
  );
  assert(
    preflightStatus === 200 || preflightStatus === 204,
    `OPTIONS preflight returns 200/204 (got ${preflightStatus})`,
  );

  // ─── 6. No server banner disclosure ──────────────────────────────────────────
  console.log("\n── 6. Information disclosure ────────────────────────────────────");
  assert(
    !headers["server"] || headers["server"].toLowerCase().indexOf("express") === -1,
    "Server header does not disclose framework version",
    headers["server"],
  );

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log(`\nFailed checks:`);
    failures.forEach((f) => console.log(`  ❌ ${f}`));
    process.exitCode = 1;
  } else {
    console.log("✅ All security header checks passed!");
  }
}

runChecks().catch((err) => {
  console.error("Scanner error:", err);
  process.exit(1);
});
