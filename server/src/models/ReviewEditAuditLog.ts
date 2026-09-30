import mongoose from "mongoose";

const reviewEditAuditLogSchema = new mongoose.Schema(
  {
    promptId: { type: String, required: true, index: true },
    reviewId: { type: String, required: true, index: true },
    editorAddress: { type: String, required: true, lowercase: true, index: true },
    previousText: { type: String, required: true },
    updatedText: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reviewEditAuditLogSchema.index({ promptId: 1, createdAt: -1 });
reviewEditAuditLogSchema.index({ reviewId: 1, createdAt: -1 });

reviewEditAuditLogSchema.pre("findOneAndUpdate", function () {
  throw new Error("Review edit audit records are immutable.");
});
reviewEditAuditLogSchema.pre("updateOne", function () {
  throw new Error("Review edit audit records are immutable.");
});
reviewEditAuditLogSchema.pre("updateMany", function () {
  throw new Error("Review edit audit records are immutable.");
});

export const ReviewEditAuditLog =
  mongoose.models.ReviewEditAuditLog ||
  mongoose.model("ReviewEditAuditLog", reviewEditAuditLogSchema);