import { ERROR_MESSAGES, type ApiErrorResponse } from "@/lib/api/errorCodes";
import { hashPromptPlaintext } from "@/lib/crypto/promptCrypto";
import {
  ChallengeRequestBody,
  parseRequestBody,
  UnlockRequestBody,
} from "@/lib/api/requestSchemas";

// eslint-disable-next-line no-unused-vars
type SignMessageFn = (_message: string) => Promise<{ signedMessage?: string } | string>;

export const WALLET_DISCONNECTED_DURING_UNLOCK_MESSAGE =
  "Wallet disconnected during unlock. Reconnect your wallet to continue decrypting this prompt.";

export class WalletDisconnectedDuringUnlockError extends Error {
  constructor(message = WALLET_DISCONNECTED_DURING_UNLOCK_MESSAGE) {
    super(message);
    this.name = "WalletDisconnectedDuringUnlockError";
  }
}

export interface UnlockPromptContentOptions {
  isWalletConnected?: () => boolean;
}

/**
 * Cryptographic provenance metadata returned by the unlock API and
 * re-verified client-side.
 *
 * status values:
 *   "verified"   — SHA-256 of decrypted plaintext matches the on-chain stored hash.
 *   "failed"     — Hash mismatch; content is withheld and a diagnostic event is emitted.
 *   "unavailable"— The listing was created before content hashes were stored on-chain.
 */
export interface IntegrityMetadata {
  status: "verified" | "failed" | "unavailable";
  /** SHA-256 hex digest recomputed from the decrypted plaintext. */
  computedHash: string;
  /** Hex digest committed by the creator at listing time, or null if absent. */
  storedHash: string | null;
}

export interface UnlockResult {
  promptId: string;
  title: string;
  contentHash: string;
  plaintext: string;
  decryptedContent: string;
  /** Provenance metadata for buyer-facing verification UI. */
  integrity: IntegrityMetadata;
}

async function parseApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | ApiErrorResponse
    | { error?: string }
    | null;

  if (payload && typeof payload === "object" && "code" in payload && payload.code) {
    const code = payload.code as keyof typeof ERROR_MESSAGES;
    return ERROR_MESSAGES[code] ?? payload.error ?? "Failed to unlock prompt.";
  }

  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    return String(payload.error);
  }

  return "Failed to unlock prompt.";
}

function extractSignedMessage(
  signature: { signedMessage?: string } | string,
): string {
  if (typeof signature === "string") {
    return signature;
  }
  if (!signature?.signedMessage) {
    throw new Error("Wallet did not return a signed message.");
  }
  return signature.signedMessage;
}

async function requestChallenge(address: string, promptId: string) {
  const parsed = parseRequestBody(ChallengeRequestBody, { address, promptId });
  if (!parsed.success) {
    throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
  }

  const response = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<{
    token: string;
    challenge: string;
    expiresAt: number;
    nonce: string;
  }>;
}

async function requestUnlock(params: {
  token: string;
  promptId: string;
  address: string;
  signedMessage: string;
}) {
  const parsed = parseRequestBody(UnlockRequestBody, params);
  if (!parsed.success) {
    throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
  }

  const response = await fetch("/api/prompts/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json() as Promise<{
    promptId: string;
    title: string;
    contentHash: string;
    plaintext: string;
    integrity?: IntegrityMetadata;
  }>;
}

function normalizePromptId(promptId: string | bigint | number): string {
  return typeof promptId === "bigint" ? promptId.toString() : String(promptId);
}

function assertWalletStillConnected(options?: UnlockPromptContentOptions) {
  if (options?.isWalletConnected && !options.isWalletConnected()) {
    throw new WalletDisconnectedDuringUnlockError();
  }
}

/**
 * Unlock a purchased prompt via challenge → wallet sign → unlock API.
 * Re-verifies the returned plaintext hash client-side when contentHash is present.
 */
export async function unlockPromptContent(
  address: string,
  promptId: string | bigint | number,
  signMessage: SignMessageFn,
  options?: UnlockPromptContentOptions,
): Promise<UnlockResult> {
  const id = normalizePromptId(promptId);

  assertWalletStillConnected(options);
  const challenge = await requestChallenge(address, id);
  assertWalletStillConnected(options);
  const signature = await signMessage(challenge.challenge);
  assertWalletStillConnected(options);

  if (!signature) {
    throw new Error("User declined message signing.");
  }

  const signedMessage = extractSignedMessage(signature);
  const unlocked = await requestUnlock({
    token: challenge.token,
    promptId: id,
    address,
    signedMessage,
  });

  // If the server explicitly reports an integrity failure, surface a safe error.
  // Content is withheld server-side; no plaintext is present to display.
  if (unlocked?.integrity?.status === "failed") {
    throw new Error(ERROR_MESSAGES.INTEGRITY_FAILURE);
  }

  // When the server marks the stored hash unavailable, skip client-side re-verification
  // and propagate the unavailable status so the UI can render the correct badge state.
  if (unlocked?.integrity?.status === "unavailable") {
    return {
      ...unlocked,
      decryptedContent: unlocked.plaintext,
      integrity: unlocked.integrity,
    };
  }

  // Client-side re-verification: recompute SHA-256 from the decrypted plaintext and
  // compare against the hash the server returned. This is an independent second check
  // that catches any transport or serialization corruption after the server's own check.
  const recomputedHash = await hashPromptPlaintext(unlocked.plaintext);
  if (unlocked.contentHash && recomputedHash !== unlocked.contentHash.toLowerCase()) {
    throw new Error(ERROR_MESSAGES.INTEGRITY_FAILURE);
  }

  // Build a canonical IntegrityMetadata object. If the server already sent one (verified
  // path), prefer it; otherwise construct one from the client-side check.
  const integrity: IntegrityMetadata = unlocked.integrity ?? {
    status: "verified",
    computedHash: recomputedHash,
    storedHash: unlocked.contentHash ?? null,
  };

  return {
    ...unlocked,
    decryptedContent: unlocked.plaintext,
    integrity,
  };
}

/** @deprecated Use unlockPromptContent — txHash is ignored; access is verified on-chain. */
export async function unlockPrompt(
  itemId: string,
  _txHash: string,
  signMessage: SignMessageFn,
  address?: string,
  options?: UnlockPromptContentOptions,
): Promise<{ decryptedContent: string; plaintext: string }> {
  if (!address) {
    throw new Error("Connect a Stellar wallet before unlocking.");
  }

  const result = await unlockPromptContent(address, itemId, signMessage, options);
  return {
    decryptedContent: result.plaintext,
    plaintext: result.plaintext,
  };
}
