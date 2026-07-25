import { hasAccess, type PromptHashConfig } from "../../src/lib/stellar/promptHashClient";
import { findReview, updateReview } from "./data";

interface EditReviewRequest {
  promptId: string;
  reviewId: string;
  userAddress: string;
  rating: number;
  text: string;
}

function getServerConfig(): PromptHashConfig {
  const rpcUrl = process.env.PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
  return {
    rpcUrl,
    networkPassphrase: process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
    promptHashContractId: process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID ?? "",
    nativeAssetContractId: process.env.PUBLIC_STELLAR_NATIVE_ASSET_CONTRACT_ID ?? "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    simulationAccount: process.env.PUBLIC_STELLAR_SIMULATION_ACCOUNT ?? process.env.UNLOCK_PUBLIC_KEY ?? "",
    allowHttp: new URL(rpcUrl).hostname === "localhost",
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });
  const { promptId, reviewId, userAddress, rating, text }: EditReviewRequest = req.body ?? {};
  if (!promptId || !reviewId || !userAddress || !Number.isInteger(rating) || !text) {
    return res.status(400).json({ error: "Missing or invalid required fields" });
  }
  if (rating < 1 || rating > 5 || text.trim().length < 10 || text.length > 500) {
    return res.status(400).json({ error: "Rating must be 1-5 and review text must be 10-500 characters" });
  }
  try {
    const review = findReview(String(promptId), String(reviewId));
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(403).json({ error: "Only the review author can edit this review" });
    }
    if (!(await hasAccess(getServerConfig(), userAddress, promptId))) {
      return res.status(403).json({ error: "Your on-chain access is required to edit this review" });
    }
    const now = Date.now();
    const updated = updateReview(promptId, reviewId, {
      rating,
      text: text.trim(),
      editedAt: now,
      editHistory: [...review.editHistory, { editedAt: now, editorAddress: userAddress, previousRating: review.rating, previousText: review.text }],
    });
    return res.status(200).json({ success: true, review: updated && { id: updated.id, rating: updated.rating, text: updated.text, editedAt: updated.editedAt } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to edit review";
    console.error("Review edit error:", message);
    return res.status(500).json({ error: message });
  }
}
