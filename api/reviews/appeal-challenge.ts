import { createChallengeToken } from "../../src/lib/auth/challenge";
import { findReviewById } from "./data";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { address, reviewId } = req.body ?? {};
  if (typeof address !== "string" || typeof reviewId !== "string" || !address.trim() || !reviewId.trim()) {
    res.status(400).json({ error: "address and reviewId are required" });
    return;
  }

  const review = findReviewById(reviewId.trim());
  if (!review || review.userAddress.toLowerCase() !== address.trim().toLowerCase()) {
    res.status(404).json({ error: "Review not found or not eligible for appeal" });
    return;
  }
  if (review.moderation?.status !== "removed") {
    res.status(409).json({ error: "Only removed reviews can be appealed" });
    return;
  }

  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    res.status(500).json({ error: "Challenge signing is not configured" });
    return;
  }

  res.status(200).json(
    createChallengeToken(secret, address.trim(), `review-appeal:${reviewId.trim()}`),
  );
}