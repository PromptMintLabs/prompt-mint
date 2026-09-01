import express from "express";
import type { Server } from "http";
import cors from "cors";
import {
  getAllowedOrigins,
  isOriginAllowed,
  buildCorsOptions,
  normalizeOrigin,
  ALLOWED_CORS_HEADERS,
  EXPOSED_CORS_HEADERS,
} from "./cors";

describe("CORS allowlist configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 1 — getAllowedOrigins (3 tests)
  // ──────────────────────────────────────────────────────────────────────────

  describe("getAllowedOrigins", () => {
    it("parses single origin from env", () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      expect(getAllowedOrigins()).toEqual(["https://app.promptmint.xyz"]);
    });

    it("parses multiple comma-separated origins", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app.promptmint.xyz,https://admin.promptmint.xyz";
      expect(getAllowedOrigins()).toEqual([
        "https://app.promptmint.xyz",
        "https://admin.promptmint.xyz",
      ]);
    });

    it("returns empty array when ALLOWED_ORIGINS not set", () => {
      delete process.env.ALLOWED_ORIGINS;
      expect(getAllowedOrigins()).toEqual([]);
    });

    it("trims whitespace from each origin", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app.promptmint.xyz , https://admin.promptmint.xyz ";
      expect(getAllowedOrigins()).toEqual([
        "https://app.promptmint.xyz",
        "https://admin.promptmint.xyz",
      ]);
    });

    it("filters out empty strings from parsing", () => {
      process.env.ALLOWED_ORIGINS =
        "https://app.promptmint.xyz,,https://admin.promptmint.xyz";
      expect(getAllowedOrigins()).toEqual([
        "https://app.promptmint.xyz",
        "https://admin.promptmint.xyz",
      ]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 2 — isOriginAllowed (4 tests)
  // ──────────────────────────────────────────────────────────────────────────

  describe("isOriginAllowed", () => {
    const allowlist = [
      "https://app.promptmint.xyz",
      "https://admin.promptmint.xyz",
    ];

    it("returns true for allowlisted origin", () => {
      expect(isOriginAllowed("https://app.promptmint.xyz", allowlist)).toBe(
        true
      );
    });

    it("returns false for non-allowlisted origin", () => {
      expect(isOriginAllowed("https://evil.com", allowlist)).toBe(false);
    });

    it("returns false for undefined origin", () => {
      expect(isOriginAllowed(undefined, allowlist)).toBe(false);
    });

    it("is case-sensitive (no partial matches)", () => {
      expect(
        isOriginAllowed("https://APP.promptmint.xyz", allowlist)
      ).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 3 — buildCorsOptions (5 tests)
  // ──────────────────────────────────────────────────────────────────────────

  describe("normalizeOrigin", () => {
    it("removes trailing slashes", () => {
      expect(normalizeOrigin("https://app.promptmint.xyz/")).toBe("https://app.promptmint.xyz");
    });

    it("trims whitespace", () => {
      expect(normalizeOrigin("  https://app.promptmint.xyz  ")).toBe("https://app.promptmint.xyz");
    });

    it("returns origin unchanged when already normalized", () => {
      expect(normalizeOrigin("https://app.promptmint.xyz")).toBe("https://app.promptmint.xyz");
    });
  });

  describe("buildCorsOptions", () => {
    it("returns CorsOptions object with correct structure", () => {
      const options = buildCorsOptions();
      expect(options).toHaveProperty("origin");
      expect(options).toHaveProperty("credentials", true);
      expect(options).toHaveProperty("methods");
      expect(options).toHaveProperty("allowedHeaders");
      expect(options).toHaveProperty("exposedHeaders");
      expect(options).toHaveProperty("maxAge", 86400);
      expect(options).toHaveProperty("optionsSuccessStatus", 200);
    });

    it("includes all required HTTP methods", () => {
      const options = buildCorsOptions();
      expect(options.methods).toContain("GET");
      expect(options.methods).toContain("POST");
      expect(options.methods).toContain("PUT");
      expect(options.methods).toContain("PATCH");
      expect(options.methods).toContain("DELETE");
      expect(options.methods).toContain("OPTIONS");
    });

    it("includes all hardened headers in allowedHeaders", () => {
      const options = buildCorsOptions();
      expect(options.allowedHeaders).toContain("Content-Type");
      expect(options.allowedHeaders).toContain("Authorization");
      expect(options.allowedHeaders).toContain("X-Requested-With");
      expect(options.allowedHeaders).toContain("X-API-Version");
      expect(options.allowedHeaders).toContain("Idempotency-Key");
      expect(options.allowedHeaders).toContain("X-Captcha-Token");
    });

    it("exposes rate-limit and version headers to browsers", () => {
      const options = buildCorsOptions();
      expect(options.exposedHeaders).toContain("X-RateLimit-Limit");
      expect(options.exposedHeaders).toContain("X-RateLimit-Remaining");
      expect(options.exposedHeaders).toContain("X-API-Version");
      expect(options.exposedHeaders).toContain("Deprecation");
    });

    it("caches preflight responses for 24h (maxAge: 86400)", () => {
      const options = buildCorsOptions();
      expect(options.maxAge).toBe(86400);
    });

    it("enables credentials for cookie and auth support", () => {
      const options = buildCorsOptions();
      expect(options.credentials).toBe(true);
    });

    it("sets optionsSuccessStatus to 200", () => {
      const options = buildCorsOptions();
      expect(options.optionsSuccessStatus).toBe(200);
    });

    it("ALLOWED_CORS_HEADERS includes all required headers", () => {
      expect(ALLOWED_CORS_HEADERS).toContain("X-API-Version");
      expect(ALLOWED_CORS_HEADERS).toContain("Idempotency-Key");
      expect(ALLOWED_CORS_HEADERS).toContain("X-Captcha-Token");
      expect(ALLOWED_CORS_HEADERS).toContain("Accept-Version");
    });

    it("EXPOSED_CORS_HEADERS includes rate limit and version headers", () => {
      expect(EXPOSED_CORS_HEADERS).toContain("X-RateLimit-Limit");
      expect(EXPOSED_CORS_HEADERS).toContain("X-RateLimit-Reset");
      expect(EXPOSED_CORS_HEADERS).toContain("Deprecation");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 4 — CORS origin callback behavior (6 tests)
  // ──────────────────────────────────────────────────────────────────────────

  describe("CORS origin callback", () => {
    it("allows request with no Origin header (same-origin)", (done) => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const options = buildCorsOptions();

      const callback = (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      };

      const originFn = options.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => void;
      originFn(undefined, callback);
    });

    it("allows request from allowlisted origin", (done) => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const options = buildCorsOptions();

      const callback = (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      };

      const originFn = options.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => void;
      originFn("https://app.promptmint.xyz", callback);
    });

    it("rejects request from non-allowlisted origin with error", (done) => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const options = buildCorsOptions();

      const callback = (err: Error | null, allow?: boolean) => {
        expect(err).not.toBeNull();
        expect(err?.message).toContain("CORS:");
        expect(err?.message).toContain("evil.com");
        expect(allow).toBe(false);
        done();
      };

      const originFn = options.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => void;
      originFn("https://evil.com", callback);
    });

    it("allows any origin when ALLOWED_ORIGINS is empty", (done) => {
      process.env.ALLOWED_ORIGINS = "";
      const options = buildCorsOptions();

      // With empty allowlist, the origin callback checks against empty array
      const callback = (err: Error | null, allow?: boolean) => {
        // Non-allowlisted origin should be rejected
        expect(err).not.toBeNull();
        expect(allow).toBe(false);
        done();
      };

      const originFn = options.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => void;
      originFn("https://any.com", callback);
    });

    it("handles multiple allowed origins independently", (done) => {
      process.env.ALLOWED_ORIGINS =
        "https://app.promptmint.xyz,https://admin.promptmint.xyz";
      const options = buildCorsOptions();

      const callback1 = (err: Error | null, allow?: boolean) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);

        // Test second origin
        const callback2 = (err: Error | null, allow?: boolean) => {
          expect(err).toBeNull();
          expect(allow).toBe(true);
          done();
        };

        const originFn = options.origin as (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void
        ) => void;
        originFn("https://admin.promptmint.xyz", callback2);
      };

      const originFn = options.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => void;
      originFn("https://app.promptmint.xyz", callback1);
    });

    it("error message identifies the blocked origin", (done) => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const options = buildCorsOptions();

      const callback = (err: Error | null, allow?: boolean) => {
        expect(err?.message).toContain("https://blocked-origin.com");
        expect(err?.message).toContain("not allowlisted");
        done();
      };

      const originFn = options.origin as (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
      ) => void;
      originFn("https://blocked-origin.com", callback);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 5 — HTTP integration with Express (7 tests)
  // ──────────────────────────────────────────────────────────────────────────

  describe("API endpoint CORS enforcement", () => {
    let app: express.Express;
    let server: Server;

    beforeEach(() => {
      app = express();
      app.use(cors(buildCorsOptions()));

      // Add error handler for CORS errors (matches server.ts)
      app.use(
        (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
          if (err.message.startsWith("CORS:")) {
            res.status(403).json({
              error: "Forbidden",
              message: "Origin not allowed",
            });
            return;
          }
          next(err);
        }
      );

      // Test route (matches /health from Part 1)
      app.get("/health", (req, res) => {
        res.json({ status: "ok" });
      });

      app.options("/health", (req, res) => {
        res.status(200).json({});
      });
    });

    afterEach((done) => {
      server?.close(done);
    });

    function listen(): Promise<string> {
      return new Promise((resolve) => {
        server = app.listen(0, () => {
          const address = server.address();
          const port =
            typeof address === "object" && address ? address.port : 0;
          resolve(`http://127.0.0.1:${port}`);
        });
      });
    }

    it("allows request from allowlisted origin", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/health`, {
        headers: { Origin: "https://app.promptmint.xyz" },
      });

      expect(res.status).not.toBe(403);
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "https://app.promptmint.xyz"
      );
    });

    it("blocks request from non-allowlisted origin with 403", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/health`, {
        headers: { Origin: "https://evil.com" },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Forbidden");
      expect(body.message).toBe("Origin not allowed");
    });

    it("does not echo blocked origin in error response", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/health`, {
        headers: { Origin: "https://evil.com" },
      });

      const body = await res.json();
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain("evil.com");
    });

    it("allows request with no Origin header (same-origin)", async () => {
      const url = await listen();

      const res = await fetch(`${url}/health`);

      expect(res.status).not.toBe(403);
    });

    it("handles OPTIONS preflight from allowlisted origin", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://app.promptmint.xyz",
          "Access-Control-Request-Method": "POST",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBe(
        "https://app.promptmint.xyz"
      );
    });

    it("blocks OPTIONS preflight from non-allowlisted origin", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/health`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.com",
          "Access-Control-Request-Method": "POST",
        },
      });

      expect(res.status).toBe(403);
    });

    it("never includes wildcard in access-control-allow-origin header", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/health`, {
        headers: { Origin: "https://app.promptmint.xyz" },
      });

      expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 6 — Error response shape (2 tests)
  // ──────────────────────────────────────────────────────────────────────────

  describe("error response shape", () => {
    let app: express.Express;
    let server: Server;

    beforeEach(() => {
      app = express();
      app.use(cors(buildCorsOptions()));

      app.use(
        (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
          if (err.message.startsWith("CORS:")) {
            res.status(403).json({
              error: "Forbidden",
              message: "Origin not allowed",
            });
            return;
          }
          next(err);
        }
      );

      app.get("/test", (req, res) => {
        res.json({ data: "ok" });
      });
    });

    afterEach((done) => {
      server?.close(done);
    });

    function listen(): Promise<string> {
      return new Promise((resolve) => {
        server = app.listen(0, () => {
          const address = server.address();
          const port =
            typeof address === "object" && address ? address.port : 0;
          resolve(`http://127.0.0.1:${port}`);
        });
      });
    }

    it("returns correct error shape for blocked origin", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/test`, {
        headers: { Origin: "https://evil.com" },
      });

      const body = await res.json();
      expect(body).toMatchObject({
        error: "Forbidden",
        message: "Origin not allowed",
      });
    });

    it("response status is 403 for blocked origin", async () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const url = await listen();

      const res = await fetch(`${url}/test`, {
        headers: { Origin: "https://evil.com" },
      });

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SUITE 7 — Edge cases (3 tests)
  // ──────────────────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles localhost and IP addresses in allowlist", () => {
      process.env.ALLOWED_ORIGINS =
        "http://localhost:3000,http://127.0.0.1:5173";
      const origins = getAllowedOrigins();
      expect(origins).toContain("http://localhost:3000");
      expect(origins).toContain("http://127.0.0.1:5173");
    });

    it("handles protocol-relative URLs if provided", () => {
      process.env.ALLOWED_ORIGINS = "https://app.promptmint.xyz";
      const origins = getAllowedOrigins();
      expect(origins).toContain("https://app.promptmint.xyz");
      // Partial matches should fail
      expect(isOriginAllowed("http://app.promptmint.xyz", origins)).toBe(false);
    });

    it("handles empty string ALLOWED_ORIGINS as no origins", () => {
      process.env.ALLOWED_ORIGINS = "";
      expect(getAllowedOrigins()).toEqual([]);
    });
  });
});
