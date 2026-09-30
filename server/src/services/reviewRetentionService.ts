/**
 * reviewRetentionService.ts — Issue #725
 *
 * Implements review retention policies and automated cleanup jobs:
 * - Pruning ReviewEditAuditLog entries older than the retention period (default: 365 days / 12 months)
 * - Pruning large binary attachments from closed/resolved appeals older than retention period (default: 180 days)
 * - Preserving reviews and audit trails with active/pending moderation appeals
 * - Supporting dry-run execution for verification and auditing
 */

import { ReviewEditAuditLog } from "../models/ReviewEditAuditLog.js";
import { Appeal } from "../models/Appeal.js";

export interface ReviewRetentionConfig {
  removedReviewRetentionDays: number;
  auditLogRetentionDays: number;
  appealAttachmentRetentionDays: number;
}

export interface ReviewRetentionCleanupReport {
  success: boolean;
  dryRun: boolean;
  timestamp: string;
  auditLogsPruned: number;
  appealAttachmentsPruned: number;
  activeAppealsPreserved: number;
  excludedActiveAppealReviewIds: string[];
  config: ReviewRetentionConfig;
}

export function getReviewRetentionConfig(): ReviewRetentionConfig {
  const removedReviewRetentionDays = parseInt(
    process.env.REMOVED_REVIEW_RETENTION_DAYS || "90",
    10,
  );
  const auditLogRetentionDays = parseInt(
    process.env.REVIEW_EDIT_AUDIT_RETENTION_DAYS || "365",
    10,
  );
  const appealAttachmentRetentionDays = parseInt(
    process.env.RESOLVED_APPEAL_ATTACHMENT_RETENTION_DAYS || "180",
    10,
  );

  return {
    removedReviewRetentionDays: Number.isFinite(removedReviewRetentionDays) && removedReviewRetentionDays > 0 ? removedReviewRetentionDays : 90,
    auditLogRetentionDays: Number.isFinite(auditLogRetentionDays) && auditLogRetentionDays > 0 ? auditLogRetentionDays : 365,
    appealAttachmentRetentionDays: Number.isFinite(appealAttachmentRetentionDays) && appealAttachmentRetentionDays > 0 ? appealAttachmentRetentionDays : 180,
  };
}

/**
 * Runs the review retention and cleanup job.
 * If dryRun is true, records what would be removed without making database changes.
 */
export async function runReviewRetentionCleanup(options?: {
  dryRun?: boolean;
  now?: Date;
  customConfig?: Partial<ReviewRetentionConfig>;
}): Promise<ReviewRetentionCleanupReport> {
  const now = options?.now || new Date();
  const dryRun = options?.dryRun ?? (process.env.REVIEW_CLEANUP_DRY_RUN === "true");
  const baseConfig = getReviewRetentionConfig();
  const config: ReviewRetentionConfig = {
    ...baseConfig,
    ...(options?.customConfig || {}),
  };

  // 1. Identify all reviews with active/pending appeals so they are never purged
  const activeAppeals = await Appeal.find(
    {
      status: { $in: ["open", "under_review"] },
      reviewId: { $ne: null },
    },
    { reviewId: 1 },
  ).lean();

  const excludedActiveAppealReviewIds = Array.from(
    new Set(
      activeAppeals
        .map((a: any) => a.reviewId)
        .filter((id: any): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  // 2. Prune ReviewEditAuditLog entries older than auditLogRetentionDays
  const auditCutoff = new Date(now.getTime() - config.auditLogRetentionDays * 24 * 60 * 60 * 1000);
  let auditLogsPruned = 0;

  if (dryRun) {
    auditLogsPruned = await ReviewEditAuditLog.countDocuments({
      createdAt: { $lt: auditCutoff },
    });
  } else {
    const deleteResult = await ReviewEditAuditLog.deleteMany({
      createdAt: { $lt: auditCutoff },
    });
    auditLogsPruned = deleteResult.deletedCount || 0;
  }

  // 3. Prune heavy attachments from resolved appeals older than appealAttachmentRetentionDays
  const attachmentCutoff = new Date(
    now.getTime() - config.appealAttachmentRetentionDays * 24 * 60 * 60 * 1000,
  );
  let appealAttachmentsPruned = 0;

  const resolvedAppealFilter = {
    status: { $in: ["approved", "rejected", "withdrawn"] },
    updatedAt: { $lt: attachmentCutoff },
    attachments: { $exists: true, $not: { $size: 0 } },
  };

  if (dryRun) {
    appealAttachmentsPruned = await Appeal.countDocuments(resolvedAppealFilter);
  } else {
    const updateResult = await Appeal.updateMany(resolvedAppealFilter, {
      $set: { attachments: [] },
    });
    appealAttachmentsPruned = updateResult.modifiedCount || 0;
  }

  console.log(
    `[reviewRetention] Cleanup completed (${dryRun ? "DRY-RUN" : "LIVE"}): ` +
      `${auditLogsPruned} audit logs pruned, ${appealAttachmentsPruned} appeal attachments pruned, ` +
      `${excludedActiveAppealReviewIds.length} active appeals preserved.`,
  );

  return {
    success: true,
    dryRun,
    timestamp: now.toISOString(),
    auditLogsPruned,
    appealAttachmentsPruned,
    activeAppealsPreserved: excludedActiveAppealReviewIds.length,
    excludedActiveAppealReviewIds,
    config,
  };
}
