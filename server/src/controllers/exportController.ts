import { Request, Response } from "express";
import { AppError } from "../lib/AppError";
import { asyncRoute } from "../lib/asyncRoute";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";
import User from "../models/User";
import Report from "../models/Report";
import Vote from "../models/Vote";
import Purchase from "../models/Purchase";
import WebhookSubscription from "../models/WebhookSubscription";
import Notification from "../models/Notification";
import { cacheSet, cacheGet, cacheDel } from "../services/cacheService";
import connectDb from "../db/connectDb";

// Internal auth challenge logic, mirrored from src/lib/auth/challenge.ts
function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signPayload(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function buildChallengeMessage(payload: any) {
  return `prompt-hash unlock:${payload.address}:${payload.promptId}:${payload.nonce}:${payload.expiresAt}`;
}

function createChallengeToken(secret: string, address: string, promptId: string) {
  const payload = {
    address,
    promptId,
    nonce: randomUUID(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(secret, encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    challenge: buildChallengeMessage(payload),
    expiresAt: payload.expiresAt,
    nonce: payload.nonce,
  };
}

function getActiveSecrets(): string[] {
  const secrets: string[] = [];
  const primary = process.env.CHALLENGE_TOKEN_SECRET;
  if (primary) secrets.push(primary);
  const previous = process.env.CHALLENGE_TOKEN_SECRET_PREVIOUS;
  const rotationTimestamp = parseInt(process.env.CHALLENGE_TOKEN_ROTATION_TIMESTAMP || "0", 10);
  const gracePeriodMs = parseInt(process.env.CHALLENGE_TOKEN_GRACE_PERIOD_MS || "604800000", 10);
  if (previous && rotationTimestamp && Date.now() - rotationTimestamp < gracePeriodMs) {
    secrets.push(previous);
  }
  return secrets;
}

function verifyChallengeToken(secret: string | string[], token: string, address: string, promptId: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) throw new AppError("Malformed challenge token.", 400, "CHALLENGE_MALFORMED");
  
  const secrets = Array.isArray(secret) ? secret : [secret];
  const received = Buffer.from(signature, "utf8");
  
  let validSignature = false;
  for (const s of secrets) {
    const expectedSignature = signPayload(s, encodedPayload);
    const expected = Buffer.from(expectedSignature, "utf8");
    if (received.length === expected.length && timingSafeEqual(received, expected)) {
      validSignature = true;
      break;
    }
  }

  if (!validSignature) {
    throw new AppError("Invalid challenge token signature.", 401, "CHALLENGE_INVALID_SIGNATURE");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (payload.address !== address || payload.promptId !== promptId) {
    throw new AppError("Challenge token does not match the requested prompt unlock.", 403, "CHALLENGE_MISMATCH");
  }
  if (payload.expiresAt < Date.now()) {
    throw new AppError("Challenge token has expired.", 410, "CHALLENGE_EXPIRED");
  }
  return payload;
}

function verifyChallengeSignature(address: string, message: string, signatureBase64: string): boolean {
  try {
    const keypair = Keypair.fromPublicKey(address);
    return keypair.verify(Buffer.from(message, "utf8"), Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

export const GenerateExportChallenge = (req: Request, res: Response): void => {
  const { address } = req.body;
  if (!address) {
    res.status(400).json({ error: "address is required.", code: "MISSING_FIELDS" });
    return;
  }
  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Configuration error." });
    return;
  }
  const challenge = createChallengeToken(secret, String(address), "export");
  res.status(200).json(challenge);
};

export const RequestExport = asyncRoute(async (req: Request, res: Response) => {
  const { address, signature, token } = req.body;
  if (!address || !signature || !token) {
    throw new AppError("address, signature, and token are required.", 400, "MISSING_FIELDS");
  }
  const activeSecrets = getActiveSecrets();
  if (activeSecrets.length === 0) {
    throw new AppError("Configuration error.", 500);
  }

  const payload = verifyChallengeToken(activeSecrets, token, String(address), "export");
  const message = buildChallengeMessage(payload);
  const isValid = verifyChallengeSignature(String(address), message, String(signature));
  
  if (!isValid) {
    throw new AppError("Invalid signature.", 401, "INVALID_SIGNATURE");
  }

  await connectDb();

  const [user, reports, votes, purchases, webhookSubscriptions] = await Promise.all([
    User.findOne({ walletAddress: address.toLowerCase() }).lean(),
    Report.find({ reporterAddress: address.toLowerCase() }).lean(),
    Vote.find({ voterWallet: address.toLowerCase() }).lean(),
    Purchase.find({ buyerWallet: address.toLowerCase() }).lean(),
    WebhookSubscription.find({ walletAddress: address.toLowerCase() }).lean(),
  ]);

  const exportData = {
    inventory: {
      included: ["profile", "preferences", "purchases", "reports", "votes", "webhookSubscriptions"],
      excluded: ["auditLogs", "reviews"]
    },
    data: {
      profile: user ? { username: user.username, rating: user.rating, createdAt: user.createdAt, updatedAt: user.updatedAt } : null,
      preferences: user?.notificationPreferences || null,
      purchases,
      reports,
      votes,
      webhookSubscriptions
    }
  };

  const exportId = randomUUID();
  const redisKey = `export:${exportId}`;
  await cacheSet(redisKey, JSON.stringify(exportData), 3600);

  res.status(200).json({
    success: true,
    exportId,
    expiresIn: 3600,
    downloadUrl: `/api/user/export/download/${exportId}`
  });
});

// ─── Account deletion (#91: data retention & deletion policies) ───────────────
//
// Mirrors the export challenge/signature flow above so only the wallet owner
// can request deletion. Off-chain personal data (profile, notification
// preferences, webhook subscriptions) is removed. Records that constitute
// marketplace/on-chain history -- purchases, marketplace transactions,
// votes, and moderation reports -- are intentionally retained so that
// on-chain access authority and audit integrity are unaffected, per
// docs/legal/data-retention-policy.md.

export const GenerateDeletionChallenge = (req: Request, res: Response): void => {
  const { address } = req.body;
  if (!address) {
    res.status(400).json({ error: "address is required.", code: "MISSING_FIELDS" });
    return;
  }
  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Configuration error." });
    return;
  }
  const challenge = createChallengeToken(secret, String(address), "delete-account");
  res.status(200).json(challenge);
};

export const RequestAccountDeletion = asyncRoute(async (req: Request, res: Response) => {
  const { address, signature, token } = req.body;
  if (!address || !signature || !token) {
    throw new AppError("address, signature, and token are required.", 400, "MISSING_FIELDS");
  }
  const activeSecrets = getActiveSecrets();
  if (activeSecrets.length === 0) {
    throw new AppError("Configuration error.", 500);
  }

  const payload = verifyChallengeToken(activeSecrets, token, String(address), "delete-account");
  const message = buildChallengeMessage(payload);
  const isValid = verifyChallengeSignature(String(address), message, String(signature));

  if (!isValid) {
    throw new AppError("Invalid signature.", 401, "INVALID_SIGNATURE");
  }

  await connectDb();

  const walletAddress = String(address).toLowerCase();

  const [userResult, webhookResult, notificationResult] = await Promise.all([
    User.deleteOne({ walletAddress }),
    WebhookSubscription.deleteMany({ walletAddress }),
    Notification.deleteMany({ walletAddress }),
  ]);

  res.status(200).json({
    success: true,
    deleted: {
      profile: userResult.deletedCount > 0,
      webhookSubscriptions: webhookResult.deletedCount,
      notifications: notificationResult.deletedCount,
    },
    retained: {
      collections: ["purchases", "marketplaceTransactions", "votes", "reports"],
      reason:
        "Marketplace purchase records, votes, and moderation reports are retained to preserve on-chain access authority, audit integrity, and marketplace history. These records reference your wallet address but store no additional personal profile data.",
    },
  });
});

export const DownloadExport = asyncRoute(async (req: Request, res: Response) => {
  const { exportId } = req.params;
  if (!exportId) {
    throw new AppError("exportId is required.", 400, "MISSING_FIELDS");
  }

  const redisKey = `export:${exportId}`;
  const data = await cacheGet(redisKey);

  if (!data) {
    throw new AppError("Export link has expired or is invalid.", 410, "EXPORT_EXPIRED");
  }

  await cacheDel(redisKey);
  res.setHeader("Content-Disposition", `attachment; filename="export_${exportId}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(data);
});
