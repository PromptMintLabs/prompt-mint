import {
  buildChallengeMessage,
  verifyChallengeSignature,
  verifyChallengeToken,
} from "../../src/lib/auth/challenge";

const MODERATOR_ADDRESSES = (process.env.MODERATOR_ADDRESSES ?? "")
  .split(",")
  .map((address) => address.trim().toLowerCase())
  .filter(Boolean);

function escapeCsv(value: string): string {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { address: moderatorAddress, token, signedMessage } = req.body ?? {};

  if (typeof moderatorAddress !== "string" || !moderatorAddress || !token || !signedMessage) {
    res.status(400).json({ error: "address, token, and signedMessage are required" });
    return;
  }

  if (MODERATOR_ADDRESSES.length === 0) {
    res.status(503).json({ error: "Review edit audit export is not configured" });
    return;
  }

  if (!MODERATOR_ADDRESSES.includes(moderatorAddress.toLowerCase())) {
    res.status(403).json({ error: "Unauthorized: Only authorized moderators can export review edits" });
    return;
  }

  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    res.status(500).json({ error: "Challenge signing is not configured" });
    return;
  }

  let challengeMessage: string;
  try {
    const payload = verifyChallengeToken(secret, token, moderatorAddress, "review-audit-export");
    challengeMessage = buildChallengeMessage(payload);
  } catch {
    res.status(401).json({ error: "Invalid or expired export challenge" });
    return;
  }

  if (!verifyChallengeSignature(moderatorAddress, challengeMessage, signedMessage)) {
    res.status(401).json({ error: "Invalid moderator signature" });
    return;
  }

  try {
    const { default: connectDb } = await import("../../server/src/db/connectDb");
    const { ReviewEditAuditLog } = await import("../../server/src/models/ReviewEditAuditLog");
    await connectDb();

    const entries = await ReviewEditAuditLog.find({}).sort({ createdAt: -1 }).lean();
    const rows = [
      ["edited_at", "prompt_id", "review_id", "editor_address", "previous_text", "updated_text"],
      ...entries.map((entry: any) => [
        new Date(entry.createdAt).toISOString(),
        entry.promptId,
        entry.reviewId,
        entry.editorAddress,
        entry.previousText,
        entry.updatedText,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => escapeCsv(String(value))).join(",")).join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="review-edit-audit.csv"');
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(csv);
  } catch (error) {
    console.error("Review edit audit export failed:", error);
    res.status(500).json({ error: "Failed to export review edit audit log" });
  }
}