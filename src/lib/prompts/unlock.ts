export type UnlockErrorCode = 
  | "rejected_signing"
  | "unlock_api_failed"
  | "integrity_validation_failed";

export class UnlockError extends Error {
  code: UnlockErrorCode;
  constructor(message: string, code: UnlockErrorCode) {
    super(message);
    this.name = "UnlockError";
    this.code = code;
  }
}

export async function unlockPrompt(
  itemId: string, 
  txHash: string,
  signMessage: (message: string) => Promise<any>,
  options?: { forceFailure?: boolean }
): Promise<{ decryptedContent: string }> {
  
  // 1. Request cryptographic signature from the user's wallet
  // Added a dynamic nonce to support challenge refresh flow
  const challenge = `Unlock prompt ${itemId} with tx ${txHash} at ${Date.now()}`;
  let signature;
  try {
    signature = await signMessage(challenge);
  } catch (err: any) {
    throw new UnlockError("User declined transaction signing", "rejected_signing");
  }
  
  if (!signature) {
    throw new UnlockError("User declined transaction signing", "rejected_signing");
  }

  // 2. Integrity Validation
  if (!itemId || !txHash) {
    throw new UnlockError("Missing item ID or transaction hash for unlock validation", "integrity_validation_failed");
  }

  // 3. Send the signature to the backend to retrieve the decrypted prompt content
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (options?.forceFailure) {
        return reject(new UnlockError("Backend unlock verification failed", "unlock_api_failed"));
      }
      resolve({ decryptedContent: `[Decrypted Secret Content for Prompt #${itemId}]\n\nSystem prompt: Act as a senior engineer...` });
    }, 1500);
  });
}

// Wrapper for backward compatibility with existing components
export const unlockPromptContent = async (
  arg1: string,
  arg2: string,
  signMessage: (message: string) => Promise<any>
) => {
  // Detect legacy call shape (address, promptId, signMessage) vs new (itemId, txHash, signMessage)
  // Stellar addresses typically start with 'G' and are 56 characters long.
  const isLegacy = arg1.startsWith("G") || arg1.length === 56;
  const itemId = isLegacy ? arg2 : arg1;
  const txHash = isLegacy ? arg1 : arg2;

  const response = await unlockPrompt(itemId, txHash, signMessage);
  return {
    ...response,
    plaintext: response.decryptedContent,
  };
};