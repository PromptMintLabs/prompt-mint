import { Request, Response } from "express";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { Buffer } from "buffer";
import { Keypair } from "@stellar/stellar-sdk";
import User from "../models/User";
import Report from "../models/Report";
import Vote from "../models/Vote";
import Purchase from "../models/Purchase";
import WebhookSubscription from "../models/WebhookSubscription";
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

function verifyChallengeToken(secret: string, token: string, address: string, promptId: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) throw new Error("Malformed challenge token.");
  
  const expectedSignature = signPayload(secret, encodedPayload);
  const received = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("Invalid challenge token signature.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (payload.address !== address || payload.promptId !== promptId) {
    throw new Error("Challenge token does not match the requested prompt unlock.");
  }
  if (payload.expiresAt < Date.now()) {
    throw new Error("Challenge token has expired.");
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
    res.status(400).json({ success: false, error: "address is required." });
    return;
  }
  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, error: "Configuration error." });
    return;
  }
  const challenge = createChallengeToken(secret, String(address), "export");
  res.status(200).json(challenge);
};

export const RequestExport = async (req: Request, res: Response): Promise<void> => {
  const { address, signature, token } = req.body;
  if (!address || !signature || !token) {
    res.status(400).json({ success: false, error: "address, signature, and token are required." });
    return;
  }
  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, error: "Configuration error." });
    return;
  }

  try {
    const payload = verifyChallengeToken(secret, token, String(address), "export");
    const message = buildChallengeMessage(payload);
    const isValid = verifyChallengeSignature(String(address), message, String(signature));
    
    if (!isValid) {
      res.status(401).json({ success: false, error: "Invalid signature." });
      return;
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
        excluded: ["auditLogs", "reviews"] // reviews are excluded because they are stored off-chain in a separate Vercel function's ephemeral memory
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
  } catch (error: any) {
    res.status(401).json({ success: false, error: error.message || "Failed to verify challenge." });
  }
};

export const DownloadExport = async (req: Request, res: Response): Promise<void> => {
  const { exportId } = req.params;
  if (!exportId) {
    res.status(400).json({ success: false, error: "exportId is required." });
    return;
  }

  const redisKey = `export:${exportId}`;
  const data = await cacheGet(redisKey);

  if (!data) {
    res.status(410).json({ success: false, error: "Export link has expired or is invalid." });
    return;
  }

  await cacheDel(redisKey);
  res.setHeader("Content-Disposition", `attachment; filename="export_${exportId}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(data);
};
