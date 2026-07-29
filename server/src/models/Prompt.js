import mongoose from "mongoose";

const promptSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minLength: 3,
      maxLength: 100,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minLength: 10,
    },
    rating: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Marketing",
        "Creative Writing",
        "Programming",
        "Music",
        "Gaming",
        "Other",
      ],
      default: "Other",
    },
    currentVersionIndex: {
      type: Number,
      default: 1,
      min: 1,
    },
    // Anti-plagiarism fields (Issue #133)
    similarityFlag: {
      type: String,
      enum: ["clean", "suspicious", "highly_similar"],
      default: "clean",
      index: true,
    },
    similarityScore: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    similarTo: {
      // onChainId of the most similar existing prompt, if flagged.
      type: String,
      default: null,
    },
    similarityCheckedAt: {
      type: Date,
      default: null,
    },
    onChainId: {
      type: String,
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    listingStatus: {
      type: String,
      enum: ['draft', 'ready', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    reviewChecklist: {
      contentQuality: { type: Boolean, default: false },
      imageValid: { type: Boolean, default: false },
      pricingSet: { type: Boolean, default: false },
      categoryAssigned: { type: Boolean, default: false },
      termsAccepted: { type: Boolean, default: false },
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          return v.length <= 10 && v.every(tag => tag.length <= 30);
        },
        message: 'Maximum 10 tags, each up to 30 characters'
      }
    },
    savedPrompts: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    salesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    termsVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);
promptSchema.index({ title: 1 });

// Marketplace query patterns — compound indexes for common filters + sort
promptSchema.index({ listingStatus: 1, isActive: 1, createdAt: -1 });
promptSchema.index({ listingStatus: 1, isActive: 1, category: 1, createdAt: -1 });
promptSchema.index({ listingStatus: 1, isActive: 1, tags: 1, createdAt: -1 });
promptSchema.index({ listingStatus: 1, isActive: 1, price: 1, createdAt: -1 });
promptSchema.index({ listingStatus: 1, isActive: 1, rating: 1, createdAt: -1 });
promptSchema.index({ owner: 1, createdAt: -1 });
promptSchema.index({ owner: 1, listingStatus: 1, updatedAt: -1 });
promptSchema.index({ savedPrompts: 1, createdAt: -1 });
promptSchema.index({ owner: 1, previewCount: -1 });
promptSchema.index({ onChainId: 1, isActive: 1 });

// Check if the model exists before creating it
const Prompt = mongoose.models.Prompt || mongoose.model("Prompt", promptSchema);

export default Prompt;
