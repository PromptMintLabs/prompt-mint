/**
 * Webhook signature verification and status evaluator (#755).
 *
 * Implements client-side / runtime verification against the scheme documented in
 * `server/docs/webhook-signatures.md`:
 *
 *   sha256=<hex(HMAC-SHA256(subscription_secret, raw_request_body))>
 *
 * Timestamps must be within a configurable tolerance window (default: 300s / 5 mins).
 * Comparisons are executed in constant time to prevent timing attacks.
 */

export type WebhookSignatureStatus =
  | "verified"
  | "invalid"
  | "expired"
  | "missing_secret"
  | "missing_signature"
  | "unverified";

export interface WebhookVerificationResult {
  status: WebhookSignatureStatus;
  isValid: boolean;
  computedSignature?: string;
  receivedSignature?: string;
  timestampDeltaSeconds?: number;
  message: string;
}

export interface WebhookVerificationInput {
  secret?: string;
  rawBody: string;
  signature?: string;
  timestamp?: string | number;
  toleranceSeconds?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300; // 5 minutes

/**
 * Constant-time string equality comparison.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Computes HMAC-SHA256 hex digest using the Web Crypto API or Node crypto fallback.
 */
export async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for older test environments
  try {
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHmac("sha256", secret).update(body).digest("hex");
  } catch {
    throw new Error("No cryptographic provider available for HMAC computation.");
  }
}

/**
 * Verifies a webhook signature and returns a status evaluation result.
 */
export async function evaluateWebhookSignature(
  input: WebhookVerificationInput,
): Promise<WebhookVerificationResult> {
  const {
    secret,
    rawBody,
    signature,
    timestamp,
    toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  } = input;

  if (!secret) {
    return {
      status: "missing_secret",
      isValid: false,
      message: "Subscription secret is required to verify signature.",
    };
  }

  if (!signature) {
    return {
      status: "missing_signature",
      isValid: false,
      message: "No signature header provided in the webhook delivery.",
    };
  }

  // Normalize received signature format (strip optional sha256= prefix for matching)
  const normalizedReceived = signature.trim();
  const hexOnlyReceived = normalizedReceived.startsWith("sha256=")
    ? normalizedReceived.slice(7)
    : normalizedReceived;

  // Timestamp freshness check
  if (timestamp !== undefined && timestamp !== null) {
    const parsedTime = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
    if (isNaN(parsedTime)) {
      return {
        status: "invalid",
        isValid: false,
        receivedSignature: signature,
        message: "Webhook timestamp could not be parsed.",
      };
    }

    const now = Date.now();
    const ageSeconds = Math.abs(now - parsedTime) / 1000;

    if (ageSeconds > toleranceSeconds) {
      return {
        status: "expired",
        isValid: false,
        receivedSignature: signature,
        timestampDeltaSeconds: Math.round(ageSeconds),
        message: `Webhook delivery timestamp is outside the acceptance window (${Math.round(ageSeconds)}s > ${toleranceSeconds}s).`,
      };
    }
  }

  try {
    const computedHex = await computeHmacSha256Hex(secret, rawBody);
    const formattedExpected = `sha256=${computedHex}`;

    const isMatch =
      timingSafeEqual(normalizedReceived, formattedExpected) ||
      timingSafeEqual(hexOnlyReceived, computedHex);

    if (!isMatch) {
      return {
        status: "invalid",
        isValid: false,
        computedSignature: formattedExpected,
        receivedSignature: signature,
        message: "Signature mismatch: computed HMAC does not match received signature.",
      };
    }

    return {
      status: "verified",
      isValid: true,
      computedSignature: formattedExpected,
      receivedSignature: signature,
      message: "Webhook signature and timestamp successfully verified.",
    };
  } catch (err) {
    return {
      status: "invalid",
      isValid: false,
      receivedSignature: signature,
      message: err instanceof Error ? err.message : "Cryptographic verification error.",
    };
  }
}
