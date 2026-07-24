import { findReviewById, updateReview } from "../reviews/data";
import { addModerationLog, isAuthorizedModerator } from "./data";

type Action = "review_removed" | "review_approved" | "user_warned";
interface BulkAction { action: Action; targetId: string; targetType: "review" | "user"; reason: string; details?: string; }

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { moderatorAddress, confirmed, actions } = (req.body ?? {}) as {
    moderatorAddress?: string;
    confirmed?: boolean;
    actions?: BulkAction[];
  };
  if (!moderatorAddress) return res.status(401).json({ error: "Moderator address is required" });
  if (!isAuthorizedModerator(moderatorAddress)) return res.status(403).json({ error: "Unauthorized: Only authorized moderators can perform actions" });
  if (confirmed !== true) return res.status(400).json({ error: "Bulk actions require confirmed: true" });
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 50) return res.status(400).json({ error: "Provide between 1 and 50 actions" });

  const errors: Array<{ index: number; error: string }> = [];
  const applied = [];
  for (const [index, item] of actions.entries()) {
    if (!item || !["review_removed", "review_approved", "user_warned"].includes(item.action) || !item.targetId || !item.reason?.trim()) {
      errors.push({ index, error: "Invalid action, target, or reason" }); continue;
    }
    if ((item.action === "user_warned") !== (item.targetType === "user")) {
      errors.push({ index, error: "Action does not match target type" }); continue;
    }
    if (item.targetType === "review") {
      const review = findReviewById(item.targetId);
      if (!review) { errors.push({ index, error: "Review not found" }); continue; }
      updateReview(review.promptId, review.id, {
        moderation: { status: item.action === "review_removed" ? "removed" : "approved", moderatorAddress, reason: item.reason.trim(), updatedAt: Date.now() },
      });
    }
    applied.push(addModerationLog({ ...item, reason: item.reason.trim(), details: item.details?.trim(), moderatorAddress }));
  }
  return res.status(errors.length ? 207 : 200).json({ success: errors.length === 0, applied, errors });
}
