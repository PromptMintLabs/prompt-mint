import mongoose from "mongoose";

/**
 * Append-only store for privacy-safe product analytics events. The set of
 * valid `event` names and the shape of `properties` are enforced upstream by
 * the taxonomy in `src/lib/analytics/taxonomy.ts` before a document ever
 * reaches this model — this schema intentionally stays permissive on
 * `properties` (Mixed) so the two layers don't have to be kept in lockstep,
 * but it still forbids the fields that must never be persisted.
 */

const analyticsEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      required: true,
      index: true,
    },
    // One-way hash of the wallet address, never the raw address.
    walletHash: {
      type: String,
      default: null,
      index: true,
    },
    promptId: {
      type: String,
      default: null,
      index: true,
    },
    // Client-reported event time, clamped server-side to a bounded drift window.
    occurredAt: {
      type: Date,
      required: true,
    },
    requestId: {
      type: String,
      default: null,
      index: true,
    },
    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // No plaintext, no raw wallet address, no IP, no free-text fields —
    // enforced by the taxonomy schemas before recordAnalyticsEvent is called.
  },
  {
    timestamps: true,
  },
);

analyticsEventSchema.index({ event: 1, createdAt: -1 });
analyticsEventSchema.index({ walletHash: 1, createdAt: -1 });
analyticsEventSchema.index({ promptId: 1, createdAt: -1 });

// Append-only: analytics events are immutable once recorded.
analyticsEventSchema.pre("findOneAndUpdate", function () {
  throw new Error("AnalyticsEvent records are immutable.");
});
analyticsEventSchema.pre("updateOne", function () {
  throw new Error("AnalyticsEvent records are immutable.");
});
analyticsEventSchema.pre("updateMany", function () {
  throw new Error("AnalyticsEvent records are immutable.");
});

export const AnalyticsEvent =
  mongoose.models.AnalyticsEvent || mongoose.model("AnalyticsEvent", analyticsEventSchema);
