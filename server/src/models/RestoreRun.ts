import mongoose from "mongoose";

const restoreRunSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["success", "failure"], required: true, index: true },
    durationMs: { type: Number, default: null },
    errorMessage: { type: String, default: null },
    validation: {
      integrity: { type: Boolean, default: null },
      schema: { type: Boolean, default: null },
      counts: { type: Boolean, default: null },
      indexerReconciled: { type: Boolean, default: null },
    },
  },
  { timestamps: true },
);

export const RestoreRun =
  mongoose.models.RestoreRun || mongoose.model("RestoreRun", restoreRunSchema);
