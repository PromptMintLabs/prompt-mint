import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    username: {
      type: String,
      //   required: true,
      unique: true,
      trim: true,
      minLength: 3,
      maxLength: 30,
    },
    rating: {
      type: Number,
      default: 4,
      min: 1,
      max: 5,
    },
    verifiedLinks: {
      type: [
        {
          label: { type: String, required: true, trim: true, maxlength: 40 },
          url: { type: String, required: true, trim: true },
          verifiedAt: { type: Date, required: true },
          verificationMethod: { type: String, required: true, trim: true },
        },
      ],
      default: [],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    notificationPreferences: {
      promptPurchased: { type: Boolean, default: true },
      promptUpdated: { type: Boolean, default: true },
      newReviews: { type: Boolean, default: true },
      priceAlerts: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      weeklyCreatorDigest: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  },
);

// Check if the model exists before creating it
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
