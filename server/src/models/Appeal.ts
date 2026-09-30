import mongoose from "mongoose";

export const APPEAL_STATUSES = [
  "open",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type AppealStatus = (typeof APPEAL_STATUSES)[number];

const evidenceRefSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    redactedRef: { type: String, required: true },
  },
  { _id: false },
);

const appealAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { _id: false },
);

const historyEntrySchema = new mongoose.Schema(
  {
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    actor: { type: String, required: true, lowercase: true },
    timestamp: { type: Date, required: true, default: () => new Date() },
    reason: { type: String, required: true },
    evidenceRefs: { type: [evidenceRefSchema], default: [] },
  },
  { _id: false },
);

const appealSchema = new mongoose.Schema(
  {
    appealId: { type: String, unique: true, sparse: true },
    decisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ModerationDecision",
      default: null,
      index: true,
    },
    reviewId: { type: String, default: null, index: true },
    appellantAddress: { type: String, required: true, lowercase: true, index: true },
    status: { type: String, enum: APPEAL_STATUSES, default: "open", index: true },
    statement: { type: String, required: true, maxlength: 3000 },
    evidenceRefs: { type: [evidenceRefSchema], default: [] },
    attachments: { type: [appealAttachmentSchema], default: [] },
    resolverAddress: { type: String, default: null, lowercase: true },
    resolutionReason: { type: String, default: null },
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true },
);

appealSchema.index(
  { decisionId: 1, appellantAddress: 1 },
  { unique: true, partialFilterExpression: { decisionId: { $type: "objectId" } } },
);
appealSchema.index(
  { reviewId: 1, appellantAddress: 1 },
  { unique: true, partialFilterExpression: { reviewId: { $type: "string" } } },
);

export const Appeal = mongoose.models.Appeal || mongoose.model("Appeal", appealSchema);
