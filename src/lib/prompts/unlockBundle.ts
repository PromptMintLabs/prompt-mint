/**
 * unlockBundle
 *
 * Client-side orchestration for the bundle unlock flow:
 *   challenge → wallet sign → POST /api/bundles/unlock → verify hashes
 *
 * Each returned item has its content hash re-verified client-side before
 * the plaintext is surfaced to the UI, keeping the same integrity guarantee
 * that single-prompt unlock provides.
 */
import { ERROR_MESSAGES, type ApiErrorResponse } from "@/lib/api/errorCodes";
import { hashPromptPlaintext } from "@/lib/crypto/promptCrypto";

type SignMessageFn = (
  _message: string,
) => Promise<{ signedMessage?: string } | string>;

export interface UnlockedBundleItem {
  promptId: string;
  title: string;
  contentHash: string;
  plaintext: string;
}

export interface UnlockBundleResult {
  bundleId: string;
  title: string;
  items: UnlockedBundleItem[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function parseApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | ApiErrorResponse
    | { error?: string }
    | null;

  if (payload && typeof payload === "object" && "code" in payload && payload.code) {
    const code = payload.code as keyof typeof ERROR_MESSAGES;
    return ERROR_MESSAGES[code] ?? (payload as any).error ?? "Failed to unlock bundle.";
  }

  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    return String(payload.error);
  }

  return "Failed to unlock bundle.";
}

function extractSignedMessage(
  signature: { signedMessage?: string } | string,
): string {
  if (typeof signature === "string") return signature;
  if (!signature?.signedMessage) {
    throw new Error("Wallet did not return a signed message.");
  }
  return signature.signedMessage;
}

async function requestChallenge(address: string, bundleId: string) {
  // Reuse the same challenge endpoint — it accepts any promptId/bundleId string.
  const response = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, promptId: bundleId }),
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

async function requestBundleUnlock(params: {
  token: string;
  bundleId: string;
  address: string;
  signedMessage: string;
}): Promise<{
  bundleId: string;
  title: string;
  items: Array<{
    promptId: string;
    title: string;
    contentHash: string;
    plaintext: string;
  }>;
}> {
  const response = await fetch("/api/bundles/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Unlock an entire purchased bundle via the challenge → sign → unlock flow.
 *
 * @param address    Buyer's Stellar address.
 * @param bundleId   On-chain bundle ID (string or bigint).
 * @param signMessage  Wallet signing function.
 * @returns          Resolved bundle with decrypted plaintext for every item.
 */
export async function unlockBundleContent(
  address: string,
  bundleId: string | bigint | number,
  signMessage: SignMessageFn,
): Promise<UnlockBundleResult> {
  const id =
    typeof bundleId === "bigint"
      ? bundleId.toString()
      : String(bundleId);

  // 1. Request challenge bound to (address, bundleId)
  const challenge = await requestChallenge(address, id);

  // 2. Ask wallet to sign the challenge message
  const signature = await signMessage(challenge.challenge);
  if (!signature) {
    throw new Error("User declined message signing.");
  }
  const signedMessage = extractSignedMessage(signature);

  // 3. POST to the bundle unlock endpoint
  const unlocked = await requestBundleUnlock({
    token: challenge.token,
    bundleId: id,
    address,
    signedMessage,
  });

  // 4. Client-side integrity check on every item
  const verifiedItems: UnlockedBundleItem[] = [];
  for (const item of unlocked.items) {
    const recomputedHash = await hashPromptPlaintext(item.plaintext);
    if (item.contentHash && recomputedHash !== item.contentHash.toLowerCase()) {
      throw new Error(
        ERROR_MESSAGES.INTEGRITY_FAILURE ??
          `Integrity check failed for prompt #${item.promptId}.`,
      );
    }
    verifiedItems.push(item);
  }

  return {
    bundleId: unlocked.bundleId,
    title: unlocked.title,
    items: verifiedItems,
  };
}
