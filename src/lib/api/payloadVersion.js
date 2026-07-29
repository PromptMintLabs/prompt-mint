/**
 * Payload versioning for all public API responses and webhook deliveries.
 *
 * Every response envelope and every outbound webhook payload carries a stable
 * version string so consumers can branch on it without relying on field
 * presence heuristics.
 *
 * Versioning scheme
 * -----------------
 * - Format: "YYYY-MM-DD" calendar-date strings.
 * - A new date is introduced only when a field is removed, renamed, or its
 *   semantic meaning changes in a breaking way.  Additive changes (new optional
 *   fields) do NOT require a new version.
 * - `CURRENT_API_VERSION` is the version returned when the caller does not send
 *   an `Accept-Version` header, or sends the special value "latest".
 * - `SUPPORTED_API_VERSIONS` lists every version the server still honours.
 *   Versions outside this set are rejected with 400 / UNSUPPORTED_VERSION.
 * - `WEBHOOK_SCHEMA_VERSION` tracks the shape of outbound webhook payloads
 *   independently; it follows the same date scheme.
 *
 * Backward compatibility
 * ----------------------
 * - v1 ("2024-01-01") is the implicit baseline that existed before this module
 *   was introduced.  It is listed in SUPPORTED_API_VERSIONS so that callers
 *   pinned to it receive the same response shape they always did (the
 *   `apiVersion` field is the only addition, which is purely additive).
 * - Removing a version from SUPPORTED_API_VERSIONS constitutes a breaking
 *   change and MUST be documented in docs/payload-versioning.md with at least
 *   90 days notice.
 */
// ── Constants ─────────────────────────────────────────────────────────────────
/** The version returned to callers that do not specify Accept-Version. */
export const CURRENT_API_VERSION = "2025-01-01";
/**
 * All API versions the server currently accepts.
 * Ordered from newest to oldest for fast iteration.
 */
export const SUPPORTED_API_VERSIONS = [
    "2025-01-01",
    "2024-01-01", // baseline — equivalent to pre-versioning behaviour
];
/** Schema version embedded in every outbound webhook payload. */
export const WEBHOOK_SCHEMA_VERSION = "2025-01-01";
// ── Header name ───────────────────────────────────────────────────────────────
/** HTTP request header clients use to pin a specific API version. */
export const ACCEPT_VERSION_HEADER = "accept-version";
// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Resolve which API version to use for the current request.
 *
 * Resolution order:
 * 1. Value of the `Accept-Version` request header (case-insensitive).
 * 2. The literal string "latest" → maps to CURRENT_API_VERSION.
 * 3. Missing header → CURRENT_API_VERSION.
 *
 * Returns `null` when the requested version is non-empty and not supported,
 * so the caller can respond with 400 / UNSUPPORTED_VERSION.
 */
export function resolveApiVersion(headers) {
    const raw = headers[ACCEPT_VERSION_HEADER];
    const requested = Array.isArray(raw) ? raw[0] : raw;
    if (!requested || requested.trim() === "" || requested.trim() === "latest") {
        return CURRENT_API_VERSION;
    }
    const normalised = requested.trim();
    if (SUPPORTED_API_VERSIONS.includes(normalised)) {
        return normalised;
    }
    return null; // unsupported
}
/**
 * Stamp a response body with the resolved API version.
 * The original object is not mutated; a new shallow copy is returned.
 *
 * @example
 * res.status(200).json(withVersion({ promptId: "42", plaintext: "..." }, version));
 */
export function withVersion(body, version = CURRENT_API_VERSION) {
    return { apiVersion: version, ...body };
}
/**
 * Error code surfaced when a caller requests a version the server no longer supports.
 * Kept here rather than in errorCodes.ts to avoid a circular import; the
 * string is intentionally identical to the ErrorCode pattern used elsewhere.
 */
export const UNSUPPORTED_VERSION_CODE = "UNSUPPORTED_VERSION";
