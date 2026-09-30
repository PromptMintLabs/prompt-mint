import { findReview, updateReview, getReviews } from "./data";
import { negotiateVersion } from "../../src/lib/api/versionGuard";
import { withVersion } from "../../src/lib/api/payloadVersion";
import { apiError, ErrorCode } from "../../src/lib/api/errorCodes";
import { withBodySizeLimit } from "../../src/lib/api/bodySizeLimit";

interface RespondRequest {
  promptId: string;
  reviewId: string;
  sellerAddress: string;
  text: string;
  signature?: string;
}

async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const version = negotiateVersion(req, res);
  if (!version) return;

  const { promptId, reviewId, sellerAddress, text }: RespondRequest = req.body;

  if (!promptId || !reviewId || !sellerAddress || !text) {
    res.status(400).json(apiError(ErrorCode.MISSING_FIELDS, "Missing required fields", undefined, version));
    return;
  }

  if (text.trim().length < 1) {
    res.status(400).json(apiError(ErrorCode.INVALID_INPUT, "Response text is required", undefined, version));
    return;
  }

  if (text.length > 1000) {
    res.status(400).json(apiError(ErrorCode.INVALID_INPUT, "Response text must not exceed 1000 characters", undefined, version));
    return;
  }

  try {
    const review = findReview(promptId, reviewId);

    if (!review) {
      res.status(404).json({ apiVersion: version, error: "Review not found" });
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
          apiVersion: version,
          error: "Only the verified seller of this prompt can respond to reviews",
        });
        return;
      }
    }

    const now = Date.now();
    const existingResponse = review.sellerResponse;
    const responseText = text.trim();
    const isEdit = Boolean(existingResponse && existingResponse.text !== responseText);

    if (isEdit) {
      try {
        const { default: connectDb } = await import("../../server/src/db/connectDb");
        const { ReviewEditAuditLog } = await import("../../server/src/models/ReviewEditAuditLog");
        await connectDb();
        await ReviewEditAuditLog.create({
          promptId,
          reviewId,
          editorAddress: sellerAddress,
          previousText: existingResponse!.text,
          updatedText: responseText,
        });
      } catch (error) {
        console.error("Review edit audit write failed:", error);
        res.status(503).json({ error: "Unable to record review edit; no changes were made" });
        return;
      }
    }

    const updatedReview = updateReview(promptId, reviewId, {
      sellerResponse: {
        text: responseText,
        createdAt: existingResponse?.createdAt ?? now,
        editedAt: isEdit ? now : existingResponse?.editedAt,
      },
    });

    console.log(`✓ Seller response submitted for review ${reviewId} by ${sellerAddress.slice(0, 8)}...`);

    res.status(200).json(
      withVersion(
        {
          success: true,
          sellerResponse: {
            text: updatedReview?.sellerResponse?.text,
            createdAt: updatedReview?.sellerResponse?.createdAt,
            editedAt: updatedReview?.sellerResponse?.editedAt,
          },
        },
        version,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit seller response";
    console.error("Seller response error:", message);
    res.status(500).json(apiError(ErrorCode.TEMPORARY_FAILURE, message, undefined, version));
  }
}

export default withBodySizeLimit(handler);
