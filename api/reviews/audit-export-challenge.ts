import { createChallengeToken } from "../../src/lib/auth/challenge";

const MODERATOR_ADDRESSES = (process.env.MODERATOR_ADDRESSES ?? "")
  .split(",")
  .map((address) => address.trim().toLowerCase())
  .filter(Boolean);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  if (!address) {
    res.status(400).json({ error: "address is required" });
    return;
  }

  if (MODERATOR_ADDRESSES.length === 0) {
    res.status(503).json({ error: "Review edit audit export is not configured" });
    return;
  }

  if (!MODERATOR_ADDRESSES.includes(address.toLowerCase())) {
    res.status(403).json({ error: "Unauthorized: Only authorized moderators can export review edits" });
    return;
  }

  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    res.status(500).json({ error: "Challenge signing is not configured" });
    return;
  }

  res.status(200).json(createChallengeToken(secret, address, "review-audit-export"));
}