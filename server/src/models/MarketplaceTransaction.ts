import mongoose from "mongoose";

export type MarketplaceTransactionKind = "purchase" | "license_transfer";

const marketplaceTransactionSchema = new mongoose.Schema(
  {
    promptOnChainId: {
      type: String,
      required: true,
      index: true,
    },
    promptMongoId: {
      type: String,
      default: "",
      index: true,
    },
    promptTitle: {
      type: String,
      default: "Prompt",
    },
    buyerWallet: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    creatorWallet: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    priceStroops: {
      type: Number,
      required: true,
      min: 0,
    },
    txHash: {
      type: String,
      default: "",
      index: true,
    },
    kind: {
      type: String,
      enum: ["purchase", "license_transfer"],
      default: "purchase",
    },
    ledger: {
      type: Number,
      default: null,
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

marketplaceTransactionSchema.index(
  { buyerWallet: 1, promptOnChainId: 1, txHash: 1 },
  { unique: true, sparse: true },
);
marketplaceTransactionSchema.index({ buyerWallet: 1, occurredAt: -1 });
marketplaceTransactionSchema.index({ creatorWallet: 1, occurredAt: -1 });
marketplaceTransactionSchema.index({ promptOnChainId: 1, occurredAt: -1 });

const MarketplaceTransaction =
  mongoose.models.MarketplaceTransaction ||
  mongoose.model("MarketplaceTransaction", marketplaceTransactionSchema);

export default MarketplaceTransaction;
