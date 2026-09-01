#!/usr/bin/env node
/**
 * Lightweight DAST target for OWASP ZAP.
 *
 * Serves the published OpenAPI document and a faithful stub of the Prompt Mint
 * HTTP API so ZAP can exercise endpoints without MongoDB/Redis. Responses use
 * the same security headers as production (see docs/security-headers.md).
 *
 * Usage: node scripts/security/dast-target.mjs
 * Env:   DAST_PORT (default 5000)
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.DAST_PORT || 5000);
const OPENAPI_PATH = resolve(ROOT, "server/spec/openapi.yaml");

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'",
  "Cache-Control": "no-store",
  Server: "prompt-mint-dast",
};

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 300 * 1024) {
        reject(Object.assign(new Error("payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseJson(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("Invalid JSON");
    err.status = 400;
    throw err;
  }
}

const PROMPTS = [
  {
    id: "prompt_demo_1",
    title: "Demo listing",
    category: "Software Development",
    previewText: "Generate a production-ready implementation plan.",
    price: 10000000,
    active: true,
  },
];

async function handle(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname, searchParams } = url;
  const method = (req.method || "GET").toUpperCase();

  if (method === "GET" && (pathname === "/openapi.yaml" || pathname === "/openapi.yml")) {
    if (!existsSync(OPENAPI_PATH)) {
      send(res, 404, { error: "OpenAPI spec not found" });
      return;
    }
    send(res, 200, readFileSync(OPENAPI_PATH, "utf8"), "application/yaml; charset=utf-8");
    return;
  }

  if (method === "GET" && pathname === "/health") {
    send(res, 200, {
      status: "ok",
      indexer: { lastProcessedLedger: 0, timestamp: new Date().toISOString() },
      backup: { enabled: false, lastBackupAt: null },
    });
    return;
  }

  if (method === "GET" && pathname === "/robots.txt") {
    send(
      res,
      200,
      [
        "User-agent: *",
        "Allow: /",
        "Allow: /prompts/",
        "Disallow: /api/prompts/*/unlock",
        "Disallow: /api/auth/",
        "Disallow: /admin/",
        "",
        "Sitemap: http://localhost:5000/sitemap.xml",
        "",
      ].join("\n"),
      "text/plain; charset=utf-8",
    );
    return;
  }

  if (pathname === "/api/seo/controls") {
    if (method === "GET") {
      const promptId = searchParams.get("promptId");
      if (!promptId) {
        send(res, 400, { error: "Missing required promptId parameter." });
        return;
      }
      send(res, 200, {
        promptId,
        controls: {
          index: true,
          follow: true,
          noarchive: false,
          nosnippet: false,
          canonicalUrl: "",
        },
      });
      return;
    }
    if (method === "POST") {
      const body = parseJson(await readBody(req));
      send(res, 200, { promptId: body.promptId || "unknown", controls: body });
      return;
    }
  }

  if (method === "GET" && pathname === "/api/prompts") {
    send(res, 200, { prompts: PROMPTS, page: 1, pageSize: PROMPTS.length });
    return;
  }

  const promptMatch = pathname.match(/^\/api\/prompts\/([^/]+)$/);
  if (method === "GET" && promptMatch) {
    const prompt = PROMPTS.find((p) => p.id === promptMatch[1]) || PROMPTS[0];
    send(res, 200, prompt);
    return;
  }

  if (method === "POST" && pathname === "/api/prompts") {
    const body = parseJson(await readBody(req));
    if (!body.title || !body.price) {
      send(res, 400, { error: "MISSING_FIELDS", fields: { title: "required", price: "required" } });
      return;
    }
    send(res, 201, { id: "prompt_created", ...body });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/challenge") {
    const body = parseJson(await readBody(req));
    if (!body.address) {
      send(res, 400, { error: "MISSING_FIELDS", code: "MISSING_FIELDS" });
      return;
    }
    send(res, 200, {
      challenge: "dast-challenge",
      expiresAt: Date.now() + 60_000,
    });
    return;
  }

  if (method === "POST" && pathname === "/api/prompts/unlock") {
    send(res, 401, { error: "INVALID_SIGNATURE", code: "INVALID_SIGNATURE" });
    return;
  }

  if (method === "GET" && pathname === "/api/creators/reputation") {
    send(res, 200, { creators: [], updatedAt: new Date().toISOString() });
    return;
  }

  if (method === "GET" && pathname.startsWith("/api/")) {
    send(res, 404, { error: "NOT_FOUND" });
    return;
  }

  send(res, 404, { error: "NOT_FOUND" });
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err.status || 500;
    send(res, status, { error: err.message || "Server error" });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`DAST target listening on http://127.0.0.1:${PORT}`);
});
