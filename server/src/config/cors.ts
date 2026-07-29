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
 * Parses the ALLOWED_ORIGINS environment variable into an array.
 * Expects comma-separated origins:
 * ALLOWED_ORIGINS=https://app.promptmint.xyz,https://admin.promptmint.xyz
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  if (!raw.trim()) return [];
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

/**
 * Checks whether a given origin is in the allowlist.
 * Returns false for undefined/null origins.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[]
): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

/**
 * CORS options object for use with the cors middleware.
 * Dynamically checks each request's origin against the allowlist.
 */
export function buildCorsOptions(): CorsOptions {
  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // No origin header — same-origin or server-to-server — allow
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isOriginAllowed(origin, getAllowedOrigins())) {
        callback(null, true);
      } else {
        callback(
          new Error(`CORS: Origin '${origin}' is not allowlisted`),
          false
        );
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200,
  };
}
