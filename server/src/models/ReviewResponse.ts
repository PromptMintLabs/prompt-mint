import mongoose from "mongoose";

/**
 * ReviewResponse — Issue #723
 *
 * Tracks when creators respond to reviews on their prompts.
 * Used to calculate review response rate metrics.
 */

const reviewResponseSchema = new mongoose.Schema(
  {
    promptId: {
      type: String,
      required: true,
      index: true,
    },
    creatorWallet: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    responseText: {
      type: String,
      required: true,
      minLength: 1,
      maxLength: 1000,
    },
    respondedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

reviewResponseSchema.index({ promptId: 1, creatorWallet: 1 });
reviewResponseSchema.index({ creatorWallet: 1, respondedAt: -1 });

export const ReviewResponse =
  mongoose.models.ReviewResponse ||
  mongoose.model("ReviewResponse", reviewResponseSchema);
