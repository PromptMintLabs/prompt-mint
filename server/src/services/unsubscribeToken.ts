import crypto from "crypto";

export interface UnsubscribePayload {
  wallet: string;
  event?: string;
  exp: number; // Unix timestamp in seconds
}

const DEFAULT_SECRET = process.env.UNSUBSCRIBE_TOKEN_SECRET || "prompthash-unsubscribe-default-secret-key-2026";
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Creates a tamper-proof HMAC-SHA256 signed unsubscribe token.
 */
export function createUnsubscribeToken(
  wallet: string,
  event?: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  secret: string = DEFAULT_SECRET
): string {
  const normalizedWallet = wallet.toLowerCase().trim();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: UnsubscribePayload = {
    wallet: normalizedWallet,
    exp,
    ...(event ? { event } : {}),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies an unsubscribe token and returns the payload if valid.
 */
export function verifyUnsubscribeToken(
  token: string,
  secret: string = DEFAULT_SECRET
): { valid: boolean; wallet?: string; event?: string; reason?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "missing_token" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "malformed_token" };
  }

  const [payloadB64, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  // Constant-time signature comparison
  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return { valid: false, reason: "invalid_signature" };
  }

  try {
    const payload: UnsubscribePayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, reason: "token_expired" };
    }

    return {
      valid: true,
      wallet: payload.wallet,
      event: payload.event,
    };
  } catch {
    return { valid: false, reason: "invalid_payload_json" };
  }
}
