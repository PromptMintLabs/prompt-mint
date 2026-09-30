import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    promptId: {
      type: String,
      required: true,
      index: true,
    },
    reporterAddress: {
      type: String,
      required: true,
      lowercase: true,
    },
    reason: {
      type: String,
      enum: ["quality-issue", "misleading-content", "plagiarism", "harmful-content", "copyright", "other"],
      required: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    /**
     * Immutable public state of the reported listing at the time the report was
     * filed (#737). Preserves what was reported even if the listing is later
     * edited, archived, or deleted. Gated prompt content is never captured.
     */
    listingSnapshot: {
      type: new mongoose.Schema(
        {
          promptId: { type: String, required: true },
          capturedAt: { type: Date, required: true },
          title: { type: String },
          category: { type: String },
          image: { type: String },
          price: { type: Number },
          tags: { type: [String], default: [] },
          onChainId: { type: String },
          salesCount: { type: Number },
          listingStatus: { type: String },
        },
        { _id: false },
      ),
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    adminNotes: {
      type: String,
      default: "",
    },
    collaborationNotes: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    collaborationNotesUpdatedAt: {
      type: Date,
      default: null,
    },
    collaborationNotesUpdatedBy: {
      type: String,
      default: null,
      lowercase: true,
    },
    assignedReviewer: {
      type: String,
      default: null,
      lowercase: true,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: String,
      default: null,
      lowercase: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolution: {
      type: String,
      enum: ["upheld", "dismissed", "remediated"],
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding reports by prompt
reportSchema.index({ promptId: 1, createdAt: -1 });
reportSchema.index({ assignedReviewer: 1, status: 1, createdAt: -1 });

const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);

export default Report;
