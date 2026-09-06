/**
 * Stable error codes for the challenge and unlock API endpoints.
 *
 * The frontend maps these codes to actionable recovery states.
 * Sensitive backend details are never included in user-facing responses.
 */

import type { ApiVersion } from "./payloadVersion";
import { CURRENT_API_VERSION } from "./payloadVersion";

export const ErrorCode = {
  // ── Request errors (4xx) ──────────────────────────────────────────────────

  /** One or more required request fields are missing or malformed. */
  MISSING_FIELDS: "MISSING_FIELDS",

  /** The HTTP method is not allowed on this endpoint. */
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",

  /** The request input failed validation. */
  INVALID_INPUT: "INVALID_INPUT",

  // ── Auth / access errors (4xx) ────────────────────────────────────────────

  /** The challenge token has expired. The client should request a new one. */
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",

  /** The challenge token is invalid (bad signature, wrong address/promptId). */
  CHALLENGE_INVALID: "CHALLENGE_INVALID",

  /** The unlock challenge nonce was already consumed (signature replay). */
  CHALLENGE_REPLAY: "CHALLENGE_REPLAY",

  /** The wallet signature does not match the challenge message. */
  INVALID_SIGNATURE: "INVALID_SIGNATURE",

  /** The wallet has not purchased access to this prompt. */
  ACCESS_NOT_PURCHASED: "ACCESS_NOT_PURCHASED",

  // ── Rate limiting & abuse prevention (4xx/429) ───────────────────────────

  /** Too many requests from this IP address. */
  RATE_LIMIT_IP: "RATE_LIMIT_IP",

  /** Too many requests from this wallet address. */
  RATE_LIMIT_WALLET: "RATE_LIMIT_WALLET",

  /** Account is temporarily locked due to too many failed authentication attempts. */
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",

  /** CAPTCHA verification is required to complete this request. */
  CAPTCHA_REQUIRED: "CAPTCHA_REQUIRED",

  /** The provided CAPTCHA token is invalid or expired. */
  CAPTCHA_INVALID: "CAPTCHA_INVALID",

  // ── Analytics errors (4xx) ────────────────────────────────────────────────

  /** The event name is not part of the registered analytics taxonomy. */
  UNKNOWN_EVENT: "UNKNOWN_EVENT",

  /** The event payload failed validation against its taxonomy schema. */
  INVALID_EVENT_PAYLOAD: "INVALID_EVENT_PAYLOAD",

  // ── Server errors (5xx) ───────────────────────────────────────────────────

  /** The server is missing required configuration (never expose details). */
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",

  /** Prompt content integrity check failed (hash mismatch). */
  INTEGRITY_FAILURE: "INTEGRITY_FAILURE",

  /** A temporary backend failure occurred. The client may retry. */
  TEMPORARY_FAILURE: "TEMPORARY_FAILURE",

  /** The version requested via Accept-Version is not supported by this server. */
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",

  /** The encrypted payload exceeds the on-chain storage limit. */
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",

  /** The buyer's wallet has insufficient balance for this purchase. */
  WALLET_NOT_FUNDED: "WALLET_NOT_FUNDED",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Standard API error response shape.
 *
 * Every error response — regardless of HTTP status code — carries `apiVersion`
 * so clients can always know which schema they are parsing.
 *
 * @example
 * { "apiVersion": "2025-01-01", "error": "The challenge token has expired.", "code": "CHALLENGE_EXPIRED" }
 */
export interface ApiErrorResponse {
  /** Stable date-string identifying the payload schema. Always present. */
  apiVersion: ApiVersion;
  /** Human-readable message safe to display to the user. */
  error: string;
  /** Stable machine-readable code the frontend uses for recovery logic. */
  code: ErrorCode;
  /** Unix ms timestamp of when the rate limit resets (only present on 429). */
  reset?: number;
  /** Flag indicating CAPTCHA verification is required. */
  captchaRequired?: boolean;
  /** Unix ms timestamp when the account lock expires. */
  lockedUntil?: number;
}

/**
 * Build a standard error response body.
 *
 * @param code    - Stable ErrorCode constant.
 * @param message - Human-readable message safe to show to the user.
 * @param extra   - Optional overrides / extensions (e.g. `{ reset: ... }`).
 * @param version - API version to stamp; defaults to CURRENT_API_VERSION.
 */
export function apiError(
  code: ErrorCode,
  message: string,
  extra?: Partial<Omit<ApiErrorResponse, "apiVersion" | "error" | "code">>,
  version: ApiVersion = CURRENT_API_VERSION,
): ApiErrorResponse {
  return { apiVersion: version, error: message, code, ...extra };
}

/**
 * Frontend-friendly messages keyed by error code.
 * Import this in the frontend unlock client to map codes to UI copy.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  MISSING_FIELDS:
    "Some required fields are missing from your request. Please fill in all required fields and try again.",
  METHOD_NOT_ALLOWED:
    "This action isn't available here. Refresh the page and try again — if it keeps happening, please contact support.",
  INVALID_INPUT: "Some of the information you entered isn't valid. Please review your entries and try again.",
  CHALLENGE_EXPIRED: "Your unlock session has expired for your security. Please restart the unlock flow to get a new one.",
  CHALLENGE_INVALID: "This unlock request is no longer valid. Please restart the unlock flow from the prompt page.",
  CHALLENGE_REPLAY:
    "This unlock signature was already used. Request a fresh challenge from the prompt page and sign again.",
  INVALID_SIGNATURE: "We couldn't verify your wallet signature. Please try signing the request again in your wallet.",
  ACCESS_NOT_PURCHASED: "You haven't purchased access to this prompt yet. Purchase it from the prompt page to unlock the content.",
  RATE_LIMIT_IP: "Too many requests from your network. Please wait a minute before trying again.",
  RATE_LIMIT_WALLET: "Too many unlock attempts for this wallet. Please wait a few minutes before trying again.",
  ACCOUNT_LOCKED:
    "Account is temporarily locked due to 5 consecutive failed authentication attempts. Please wait before trying again.",
  CAPTCHA_REQUIRED: "Additional verification is required. Please complete the CAPTCHA and try again.",
  CAPTCHA_INVALID: "CAPTCHA verification failed. Please try completing the CAPTCHA again.",
  UNKNOWN_EVENT: "This action could not be recorded because it isn't recognized. Please refresh the page and try again.",
  INVALID_EVENT_PAYLOAD: "This action could not be recorded due to a data mismatch. Please refresh the page and try again.",
  CONFIGURATION_ERROR:
    "The service is temporarily unavailable due to a server issue on our end. Please try again shortly, or contact support if it persists.",
  INTEGRITY_FAILURE:
    "This prompt's content could not be cryptographically verified, so it has been withheld for your protection. Please contact support and include the prompt ID.",
  TEMPORARY_FAILURE: "A temporary server error occurred. Please try again in a moment — your data has not been lost.",
  UNSUPPORTED_VERSION:
    "Your app version is out of date for this request. Please refresh or update the app and try again.",
  PAYLOAD_TOO_LARGE:
    "Your prompt content is too large to store on-chain. Please shorten it to under 4,000 characters and try again.",
  WALLET_NOT_FUNDED:
    "Your wallet doesn't have enough balance to complete this purchase. Please fund your wallet and try again.",
};
