/**
 * CORS allowlist configuration for API endpoints.
 *
 * Behavior:
 * - Requests from allowlisted origins receive CORS headers
 * - Requests from non-allowlisted origins are blocked with 403
 * - Wildcard (*) is never used in production
 * - Credentials are supported only for allowlisted origins
 *
 * Edge cases:
 * - Empty ALLOWED_ORIGINS → block all cross-origin requests
 * - Missing Origin header → allowed (same-origin or server-to-server)
 * - OPTIONS preflight → responds with correct headers or 403
 */

import type { CorsOptions } from "cors";

/**
 * Normalizes an origin string (removes trailing slashes).
 */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/**
 * Parses the ALLOWED_ORIGINS environment variable into an array.
 * Expects comma-separated origins:
 * ALLOWED_ORIGINS=https://app.promptmint.xyz,https://admin.promptmint.xyz
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .filter((o) => {
      // In production, reject wildcards
      if (process.env.NODE_ENV === "production" && o === "*") {
        console.warn("[CORS] Wildcard '*' origin is prohibited in production and ignored.");
        return false;
      }
      return true;
    })
    .map(normalizeOrigin);
}

/**
 * Checks whether a given origin is in the allowlist.
 * Returns false for undefined/null origins.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized) || allowedOrigins.includes(origin);
}

/**
 * Standard allowed HTTP headers for CORS requests
 */
export const ALLOWED_CORS_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "X-API-Version",
  "Idempotency-Key",
  "X-Captcha-Token",
  "Accept",
  "Accept-Version",
];

/**
 * Headers exposed to browser clients
 */
export const EXPOSED_CORS_HEADERS = [
  "X-RateLimit-Limit",
  "X-RateLimit-Remaining",
  "X-RateLimit-Reset",
  "X-API-Version",
  "Deprecation",
];

/**
 * CORS options object for use with the cors middleware.
 * Dynamically checks each request's origin against the allowlist.
 */
export function buildCorsOptions(): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = getAllowedOrigins();

      // No origin header — same-origin or server-to-server — allow
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(
          new Error(`CORS: Origin '${origin}' is not allowlisted`),
          false,
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ALLOWED_CORS_HEADERS,
    exposedHeaders: EXPOSED_CORS_HEADERS,
    maxAge: 86400, // 24 hours preflight cache
    optionsSuccessStatus: 200,
  };
}

