import type { Request } from "express";
import crypto from "crypto";
import connectDb from "../db/connectDb";
import Prompt from "../models/Prompt";
import PromptVersion from "../models/PromptVersion";
import Purchase from "../models/Purchase";
import User from "../models/User";
import LicenseTerm from "../models/LicenseTerm";
import { AppError } from "../lib/AppError";
import { asyncRoute } from "../lib/asyncRoute";
import { recordMarketplaceTransaction } from "../services/transactionHistoryService";
import { enqueuePromptUpdateNotifications } from "../services/notificationService";

function getWalletAddress(req: Request): string | null {
  const candidate =
    String(req.body.walletAddress || req.query.walletAddress || req.headers["x-user-address"] || "").trim();
  return candidate === "" ? null : candidate.toLowerCase();
}

function computeContentHash(encryptedPayload: string): string {
  return crypto.createHash("sha256").update(encryptedPayload, "utf8").digest("hex").toLowerCase();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ((error as any).code === 11000 || String(error.message).includes("duplicate key"))
  );
}

export const PublishPromptVersion = asyncRoute(async (req, res) => {
  await connectDb();
  const promptId = String(req.params.id);
  const walletAddress = getWalletAddress(req);
  const { encryptedPayload, encryptedPayloadRef, changelog = "", contentHash } = req.body;

  if (!walletAddress || !encryptedPayload || !encryptedPayloadRef) {
    throw new AppError(
      "walletAddress, encryptedPayload, and encryptedPayloadRef are required.",
      walletAddress ? 400 : 401,
      walletAddress ? "MISSING_FIELDS" : "UNAUTHENTICATED",
    );
  }

  const user = await User.findOne({ walletAddress });
  if (!user) throw new AppError("User not found.", 404, "NOT_FOUND");

  const prompt = await Prompt.findById(promptId);
  if (!prompt) throw new AppError("Prompt not found.", 404, "NOT_FOUND");
  if (process.env.NODE_ENV === "test") {
    console.debug("debug-owner-check", { promptOwner: prompt.owner, userId: user._id, walletAddress });
  }
  const isOwner = String(prompt.owner) === String(user._id) ||
    String(prompt.owner).toLowerCase() === String(walletAddress).toLowerCase();
  if (!isOwner) {
    throw new AppError("Prompt not found or not owned by this wallet.", 403, "FORBIDDEN");
  }

  const computedHash = computeContentHash(encryptedPayload);
  if (contentHash && String(contentHash).trim().toLowerCase() !== computedHash) {
    throw new AppError("Encrypted payload hash verification failed.", 400, "INTEGRITY_FAILURE");
  }

  const latestVersion = await PromptVersion.findOne({ promptId }, undefined, { sort: { versionIndex: -1 } });
  const nextVersion = (latestVersion?.versionIndex ?? 0) + 1;

  try {
    const createdVersion = await PromptVersion.create({
      promptId,
      versionIndex: nextVersion,
      contentHash: computedHash,
      encryptedPayloadRef,
      changelog,
      createdBy: walletAddress,
    });

    await Prompt.findByIdAndUpdate(promptId, { currentVersionIndex: nextVersion });

    enqueuePromptUpdateNotifications({
      promptId,
      promptTitle: prompt.title,
      versionIndex: nextVersion,
      changelog,
    });

    res.status(201).json({
      id: String(createdVersion._id),
      versionNumber: createdVersion.versionIndex,
      contentHash: createdVersion.contentHash,
      encryptedPayloadRef: createdVersion.encryptedPayloadRef,
      changelog: createdVersion.changelog,
      createdAt: createdVersion.createdAt,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("A concurrent version conflict occurred.", 409, "CONCURRENT_VERSION_CONFLICT");
    }
    throw error;
  }
});

export const ListPromptVersions = asyncRoute(async (req, res) => {
  await connectDb();
  const promptId = String(req.params.id);
  const walletAddress = getWalletAddress(req);

  if (!walletAddress) {
    throw new AppError("walletAddress is required to list versions.", 401, "UNAUTHENTICATED");
  }

  const user = await User.findOne({ walletAddress });
  if (!user) throw new AppError("User not found.", 404, "NOT_FOUND");

  const prompt = await Prompt.findById(promptId);
  if (!prompt) throw new AppError("Prompt not found.", 404, "NOT_FOUND");

  const purchase = await Purchase.findOne({ promptId, buyerWallet: walletAddress });
  if (!purchase && String(prompt.owner) !== String(user._id) && String(prompt.owner).toLowerCase() !== String(walletAddress).toLowerCase()) {
    throw new AppError("Unauthorized to view prompt version history.", 403, "FORBIDDEN");
  }

  const versions = await PromptVersion.find(
    { promptId },
    "versionIndex changelog createdAt contentHash",
    { sort: { versionIndex: 1 } },
  );

  res.json(
    versions.map((version) => ({
      versionNumber: version.versionIndex,
      changelog: version.changelog,
      createdAt: version.createdAt,
      contentHash: version.contentHash,
    })),
  );
});

export const GetPromptVersionDetail = asyncRoute(async (req, res) => {
  await connectDb();
  const promptId = String(req.params.id);
  const versionIndex = Number(req.params.versionIndex);
  const walletAddress = getWalletAddress(req);

  if (!walletAddress) {
    throw new AppError("walletAddress is required to view version details.", 401, "UNAUTHENTICATED");
  }

  if (!Number.isInteger(versionIndex) || versionIndex < 1) {
    throw new AppError("versionIndex must be a positive integer.", 400, "INVALID_VERSION");
  }

  const user = await User.findOne({ walletAddress });
  if (!user) throw new AppError("User not found.", 404, "NOT_FOUND");

  const prompt = await Prompt.findById(promptId);
  if (!prompt) throw new AppError("Prompt not found.", 404, "NOT_FOUND");

  const purchase = await Purchase.findOne({ promptId, buyerWallet: walletAddress });
  const isOwner = String(prompt.owner) === String(user._id) || String(prompt.owner).toLowerCase() === String(walletAddress).toLowerCase();
  if (!isOwner && (!purchase || purchase.versionIndex < versionIndex)) {
    throw new AppError("Unauthorized to access this prompt version.", 403, "FORBIDDEN");
  }

  const version = await PromptVersion.findOne({ promptId, versionIndex });
  if (!version) {
    throw new AppError("Version not found.", 404, "NOT_FOUND");
  }

  res.json({
    versionNumber: version.versionIndex,
    contentHash: version.contentHash,
    encryptedPayloadRef: version.encryptedPayloadRef,
    changelog: version.changelog,
    createdAt: version.createdAt,
  });
});

export const PostPromptUpdate = asyncRoute(async (req, res) => {
  await connectDb();
  const promptId = String(req.params.id);
  const walletAddress = getWalletAddress(req);
  const { changelog = "" } = req.body;

  if (!walletAddress) {
    throw new AppError("walletAddress is required.", 401, "UNAUTHENTICATED");
  }

  const user = await User.findOne({ walletAddress });
  if (!user) throw new AppError("User not found.", 404, "NOT_FOUND");

  const prompt = await Prompt.findById(promptId);
  if (!prompt) throw new AppError("Prompt not found.", 404, "NOT_FOUND");

  const isOwner = String(prompt.owner) === String(user._id) ||
    String(prompt.owner).toLowerCase() === String(walletAddress).toLowerCase();
  if (!isOwner) {
    throw new AppError("Prompt not found or not owned by this wallet.", 403, "FORBIDDEN");
  }

  const latestVersion = await PromptVersion.findOne({ promptId }, undefined, { sort: { versionIndex: -1 } });
  const nextVersion = (latestVersion?.versionIndex ?? 0) + 1;

  const createdVersion = await PromptVersion.create({
    promptId,
    versionIndex: nextVersion,
    contentHash: computeContentHash(`update-${Date.now()}`),
    encryptedPayloadRef: "",
    changelog,
    createdBy: walletAddress,
  });

  await Prompt.findByIdAndUpdate(promptId, { currentVersionIndex: nextVersion });

  res.status(201).json({
    id: String(createdVersion._id),
    versionNumber: createdVersion.versionIndex,
    changelog: createdVersion.changelog,
    createdAt: createdVersion.createdAt,
  });
});

export const GetPromptVersions = asyncRoute(async (req, res) => {
  await connectDb();
  const promptId = String(req.params.promptId || req.params.id);
  if (!promptId) throw new AppError("promptId is required.", 400, "MISSING_FIELDS");

  const versions = await PromptVersion.find(
    { promptId },
    "versionIndex changelog createdAt contentHash",
    { sort: { versionIndex: 1 } },
  );

  res.json(
    versions.map((version) => ({
      ...version.toObject(),
      versionNumber: version.versionIndex,
    })),
  );
});

export const RecordPurchase = asyncRoute(async (req, res) => {
  await connectDb();
  const { promptId, walletAddress, txHash = "" } = req.body;

  if (!promptId || !walletAddress) {
    throw new AppError("promptId and walletAddress are required.", 400, "MISSING_FIELDS");
  }

  const prompt = await Prompt.findById(promptId);
  if (!prompt) throw new AppError("Prompt not found.", 404, "NOT_FOUND");

  const termsVersion = prompt.termsVersion ?? 1;
  const licenseTerm = await LicenseTerm.findOne({ version: termsVersion });

  const purchase = await Purchase.create({
    promptId,
    buyerWallet: walletAddress.toLowerCase(),
    versionIndex: prompt.currentVersionIndex ?? 1,
    txHash,
    termsSnapshot: {
      termsVersion,
      termsTitle: licenseTerm?.title ?? "Standard License",
      termsContent: licenseTerm?.content ?? "Standard marketplace license terms.",
      acceptedAt: new Date(),
    },
  });

  const ownerWallet = typeof prompt.owner === "object" && prompt.owner !== null && "walletAddress" in prompt.owner
    ? String((prompt.owner as { walletAddress?: string }).walletAddress ?? "")
    : "";

  if (ownerWallet) {
    await recordMarketplaceTransaction({
      promptOnChainId: prompt.onChainId ?? String(prompt._id),
      promptMongoId: String(prompt._id),
      promptTitle: prompt.title,
      buyerWallet: walletAddress.toLowerCase(),
      creatorWallet: ownerWallet,
      priceStroops: Math.round(Number(prompt.price) * 10_000_000),
      txHash,
      occurredAt: purchase.createdAt ?? new Date(),
    });
  }

  res.status(201).json({ message: "Purchase recorded.", versionIndex: purchase.versionIndex });
});

export const GetBuyerVersion = asyncRoute(async (req, res) => {
  await connectDb();
  const promptId = String(req.query.promptId || "");
  const buyerWallet = String(req.query.buyerWallet || "").toLowerCase();

  if (!promptId || !buyerWallet) {
    throw new AppError("promptId and buyerWallet query params are required.", 400, "MISSING_FIELDS");
  }

  const purchase = await Purchase.findOne({
    promptId,
    buyerWallet,
  });

  if (!purchase) {
    throw new AppError("No purchase record found.", 404, "NOT_FOUND");
  }

  const version = await PromptVersion.findOne({
    promptId,
    versionIndex: purchase.versionIndex,
  }).lean();

  if (version) {
    return res.json({
      versionIndex: purchase.versionIndex,
      changelog: version.changelog,
      encryptedPayloadRef: version.encryptedPayloadRef,
      contentHash: version.contentHash,
      purchasedAt: purchase.createdAt,
    });
  }

  const prompt = await Prompt.findById(promptId).lean();
  res.json({
    versionIndex: purchase.versionIndex,
    changelog: "",
    content: (prompt as any)?.content ?? null,
    purchasedAt: purchase.createdAt,
  });
});
