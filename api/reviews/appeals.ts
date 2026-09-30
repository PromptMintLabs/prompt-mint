import { randomUUID } from "node:crypto";
import {
  buildChallengeMessage,
  verifyChallengeSignature,
  verifyChallengeToken,
} from "../../src/lib/auth/challenge";
import { findReviewById } from "./data";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 3 * 1024 * 1024;
const MAX_REASON_LENGTH = 3000;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"]);

interface SubmittedAttachment {
  name: string;
  size: number;
  content: string;
}

function detectContentType(data: Buffer): string | undefined {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    const hasUnsupportedControl = Array.from(text).some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    });
    if (!hasUnsupportedControl) return "text/plain";
  } catch {
    return undefined;
  }
  return undefined;
}

function decodeAttachments(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_FILES) {
    throw new Error(`Attach no more than ${MAX_FILES} supporting files`);
  }

  let totalBytes = 0;
  const attachments = value.map((item: SubmittedAttachment) => {
    if (!item || typeof item.name !== "string" || typeof item.content !== "string") {
      throw new Error("Invalid supporting file");
    }
    const data = Buffer.from(item.content, "base64");
    if (!data.length || data.toString("base64") !== item.content || data.length !== item.size) {
      throw new Error("Supporting file data is invalid");
    }
    if (data.length > MAX_FILE_BYTES) throw new Error("Each supporting file must be 1 MB or smaller");

    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_FILE_BYTES) throw new Error("Supporting files must total 3 MB or less");

    const contentType = detectContentType(data);
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      throw new Error("Use PDF, PNG, JPEG, WebP, or plain text supporting files");
    }

    const name = item.name
      .replace(/[\\/]/g, "")
      .split("")
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code > 31 && code !== 127;
      })
      .join("")
      .trim()
      .slice(0, 120);
    if (!name) throw new Error("Supporting file name is required");

    return { name, contentType, size: data.length, data };
  });

  return attachments;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { address, reviewId, reason, token, signedMessage } = req.body ?? {};
  if (
    typeof address !== "string" || typeof reviewId !== "string" ||
    typeof reason !== "string" || typeof token !== "string" ||
    typeof signedMessage !== "string"
  ) {
    res.status(400).json({ error: "address, reviewId, reason, token, and signedMessage are required" });
    return;
  }

  const normalizedAddress = address.trim();
  const normalizedReviewId = reviewId.trim();
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 20 || normalizedReason.length > MAX_REASON_LENGTH) {
    res.status(400).json({ error: "Appeal reason must be between 20 and 3000 characters" });
    return;
  }

  const review = findReviewById(normalizedReviewId);
  if (!review || review.userAddress.toLowerCase() !== normalizedAddress.toLowerCase()) {
    res.status(404).json({ error: "Review not found or not eligible for appeal" });
    return;
  }
  if (review.moderation?.status !== "removed") {
    res.status(409).json({ error: "Only removed reviews can be appealed" });
    return;
  }

  const secret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    res.status(500).json({ error: "Challenge signing is not configured" });
    return;
  }

  let challengeMessage: string;
  try {
    const payload = verifyChallengeToken(
      secret,
      token,
      normalizedAddress,
      `review-appeal:${normalizedReviewId}`,
    );
    challengeMessage = buildChallengeMessage(payload);
  } catch {
    res.status(401).json({ error: "Invalid or expired appeal challenge" });
    return;
  }

  if (!verifyChallengeSignature(normalizedAddress, challengeMessage, signedMessage)) {
    res.status(401).json({ error: "Invalid wallet signature" });
    return;
  }

  let attachments;
  try {
    attachments = decodeAttachments(req.body.attachments ?? []);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid supporting files" });
    return;
  }

  try {
    const { default: connectDb } = await import("../../server/src/db/connectDb");
    const { Appeal } = await import("../../server/src/models/Appeal");
    await connectDb();

    const appealId = randomUUID();
    const submittedAt = new Date();
    const evidenceRefs = attachments.map((attachment: { name: string }) => ({
      label: attachment.name,
      redactedRef: "supporting-file",
    }));
    await Appeal.create({
      appealId,
      decisionId: null,
      reviewId: normalizedReviewId,
      appellantAddress: normalizedAddress.toLowerCase(),
      statement: normalizedReason,
      status: "open",
      evidenceRefs,
      attachments,
      history: [{
        fromStatus: null,
        toStatus: "open",
        actor: normalizedAddress.toLowerCase(),
        timestamp: submittedAt,
        reason: normalizedReason,
        evidenceRefs,
      }],
    });

    res.status(201).json({
      appealId,
      reviewId: normalizedReviewId,
      status: "submitted",
      submittedAt: submittedAt.toISOString(),
      attachments: attachments.map(({ name, contentType, size }: { name: string; contentType: string; size: number }) => ({
        name,
        contentType,
        size,
      })),
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ error: "An appeal has already been submitted for this review" });
      return;
    }
    console.error("Appeal submission failed:", error);
    res.status(500).json({ error: "Failed to submit appeal" });
  }
}