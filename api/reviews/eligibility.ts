/**
 * Review Eligibility Endpoint
 *
 * Verifies if a user address is eligible to submit a review for a specific prompt.
 * Requirements:
 * 1. Verified purchase access on-chain.
 * 2. Has not already submitted a review for this prompt.
 */

import { hasAccess, type PromptHashConfig } from "../../src/lib/stellar/promptHashClient";

interface StoredReview {
  id: string;
  promptId: string;
  userAddress: string;
  rating: number;
  text: string;
  createdAt: number;
  verified: boolean;
}

// In-memory review storage reference
const reviewStorage = new Map<string, StoredReview[]>();

function getServerConfig(): PromptHashConfig {
  const rpcUrl = process.env.PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const networkPassphrase =
    process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
  const promptHashContractId = process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID ?? "";
  const nativeAssetContractId =
    process.env.PUBLIC_STELLAR_NATIVE_ASSET_CONTRACT_ID ??
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
  const simulationAccount =
    process.env.PUBLIC_STELLAR_SIMULATION_ACCOUNT ?? process.env.UNLOCK_PUBLIC_KEY ?? "";

  return {
    rpcUrl,
    networkPassphrase,
    promptHashContractId,
    nativeAssetContractId,
    simulationAccount,
    allowHttp: new URL(rpcUrl).hostname === "localhost",
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const promptId = (req.query?.promptId || req.body?.promptId) as string;
  const userAddress = (req.query?.userAddress || req.body?.userAddress) as string;

  if (!promptId || !userAddress) {
    res.status(400).json({ error: "Missing required promptId or userAddress" });
    return;
  }

  try {
    const config = getServerConfig();

    // Check on-chain verified purchase access
    let verified = false;
    try {
      verified = await hasAccess(config, userAddress, promptId);
    } catch {
      // In dev or test environments without contract ID, default to false unless simulation mode
      verified = false;
    }

    if (!verified) {
      res.status(200).json({
        eligible: false,
        verified: false,
        alreadyReviewed: false,
        reason: "Only verified purchasers with on-chain access can submit reviews.",
      });
      return;
    }

    // Check for previous review submission
    const existingReviews = reviewStorage.get(promptId) || [];
    const alreadyReviewed = existingReviews.some(
      (r) => r.userAddress.toLowerCase() === userAddress.toLowerCase()
    );

    if (alreadyReviewed) {
      res.status(200).json({
        eligible: false,
        verified: true,
        alreadyReviewed: true,
        reason: "You have already submitted a review for this prompt.",
      });
      return;
    }

    res.status(200).json({
      eligible: true,
      verified: true,
      alreadyReviewed: false,
      reason: "Verified purchaser eligible to review.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check review eligibility";
    console.error("Eligibility check error:", message);
    res.status(500).json({ error: message });
  }
}
