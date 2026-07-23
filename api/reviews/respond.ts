import { findReview, updateReview, getReviews } from "./data";

interface RespondRequest {
  promptId: string;
  reviewId: string;
  sellerAddress: string;
  text: string;
  signature?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { promptId, reviewId, sellerAddress, text }: RespondRequest = req.body;

  if (!promptId || !reviewId || !sellerAddress || !text) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (text.trim().length < 1) {
    res.status(400).json({ error: "Response text is required" });
    return;
  }

  if (text.length > 1000) {
    res.status(400).json({ error: "Response text must not exceed 1000 characters" });
    return;
  }

  try {
    const review = findReview(promptId, reviewId);

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const reviews = getReviews(promptId);
    const isSeller = reviews.some(
      (r) => r.userAddress.toLowerCase() === sellerAddress.toLowerCase()
    );

    if (!isSeller) {
      const mockSellerAddress = process.env.MOCK_SELLER_ADDRESS;
      if (!mockSellerAddress || sellerAddress.toLowerCase() !== mockSellerAddress.toLowerCase()) {
        res.status(403).json({
          error: "Only the verified seller of this prompt can respond to reviews",
        });
        return;
      }
    }

    const now = Date.now();
    const existingResponse = review.sellerResponse;

    const updatedReview = updateReview(promptId, reviewId, {
      sellerResponse: {
        text: text.trim(),
        createdAt: existingResponse?.createdAt ?? now,
        editedAt: existingResponse ? now : undefined,
      },
    });

    console.log(
      `✓ Seller response submitted for review ${reviewId} by ${sellerAddress.slice(0, 8)}...`
    );

    res.status(200).json({
      success: true,
      sellerResponse: {
        text: updatedReview?.sellerResponse?.text,
        createdAt: updatedReview?.sellerResponse?.createdAt,
        editedAt: updatedReview?.sellerResponse?.editedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit seller response";
    console.error("Seller response error:", message);
    res.status(500).json({ error: message });
  }
}
