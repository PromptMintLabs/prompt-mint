import mongoose from "mongoose";
import { API_SCOPES, RATE_LIMIT_TIERS } from "../services/apiKeys";

/**
 * Persisted API key record (#287). The plaintext key is NEVER stored — only its
 * SHA-256 hash and public prefix.
 */
const apiKeySchema = new mongoose.Schema(
  {
    ownerWallet: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    prefix: {
      type: String,
      required: true,
      index: true,
    },
    hashedKey: {
      type: String,
      required: true,
    },
    scopes: {
      type: [String],
      enum: API_SCOPES,
      default: ["read"],
    },
    rateLimitTier: {
      type: String,
      enum: Object.keys(RATE_LIMIT_TIERS),
      default: "free",
    },
    requestCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** Prefix of the key this one replaced, when created via rotation. */
    rotatedFrom: {
      type: String,
      default: null,
    },
    /** When this key naturally expires (e.g. 90 days after creation). */
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    /** Overlapping grace period window when a rotated key remains temporarily valid. */
    gracePeriodUntil: {
      type: Date,
      default: null,
      index: true,
    },
    /** Flag indicating key was automatically rotated by the 90-day secrets rotation job. */
    autoRotated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

apiKeySchema.index({ ownerWallet: 1, revoked: 1 });

const ApiKey =
  mongoose.models.ApiKey || mongoose.model("ApiKey", apiKeySchema);
export default ApiKey;
