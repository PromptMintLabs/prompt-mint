import mongoose from "mongoose";

const creatorDigestDeliverySchema = new mongoose.Schema(
  {
    creatorWallet: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    weekStart: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["sending", "sent", "failed"],
      required: true,
      default: "sending",
    },
    claimedAt: Date,
    sentAt: Date,
  },
  { timestamps: true },
);

creatorDigestDeliverySchema.index({ creatorWallet: 1, weekStart: 1 }, { unique: true });
creatorDigestDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const CreatorDigestDelivery =
  mongoose.models.CreatorDigestDelivery || mongoose.model("CreatorDigestDelivery", creatorDigestDeliverySchema);

export default CreatorDigestDelivery;