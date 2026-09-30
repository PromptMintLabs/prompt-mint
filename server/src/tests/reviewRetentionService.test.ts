import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getReviewRetentionConfig,
  runReviewRetentionCleanup,
} from "../services/reviewRetentionService.js";
import { ReviewEditAuditLog } from "../models/ReviewEditAuditLog.js";
import { Appeal } from "../models/Appeal.js";

describe("reviewRetentionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getReviewRetentionConfig", () => {
    it("should return default retention periods when env vars are not set", () => {
      const config = getReviewRetentionConfig();
      expect(config.removedReviewRetentionDays).toBe(90);
      expect(config.auditLogRetentionDays).toBe(365);
      expect(config.appealAttachmentRetentionDays).toBe(180);
    });
  });

  describe("runReviewRetentionCleanup", () => {
    it("should count audit logs and attachments in dry-run mode without modifying records", async () => {
      vi.spyOn(Appeal, "find").mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { reviewId: "review_active_1", status: "open" },
        ]),
      } as any);

      vi.spyOn(ReviewEditAuditLog, "countDocuments").mockResolvedValue(5 as any);
      vi.spyOn(Appeal, "countDocuments").mockResolvedValue(2 as any);
      const deleteAuditSpy = vi.spyOn(ReviewEditAuditLog, "deleteMany");
      const updateAppealSpy = vi.spyOn(Appeal, "updateMany");

      const report = await runReviewRetentionCleanup({ dryRun: true });

      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.auditLogsPruned).toBe(5);
      expect(report.appealAttachmentsPruned).toBe(2);
      expect(report.activeAppealsPreserved).toBe(1);
      expect(report.excludedActiveAppealReviewIds).toContain("review_active_1");
      expect(deleteAuditSpy).not.toHaveBeenCalled();
      expect(updateAppealSpy).not.toHaveBeenCalled();
    });

    it("should execute deletions and updates in live mode", async () => {
      vi.spyOn(Appeal, "find").mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      } as any);

      const deleteAuditSpy = vi.spyOn(ReviewEditAuditLog, "deleteMany").mockResolvedValue({
        deletedCount: 12,
      } as any);

      const updateAppealSpy = vi.spyOn(Appeal, "updateMany").mockResolvedValue({
        modifiedCount: 3,
      } as any);

      const report = await runReviewRetentionCleanup({ dryRun: false });

      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(false);
      expect(report.auditLogsPruned).toBe(12);
      expect(report.appealAttachmentsPruned).toBe(3);
      expect(deleteAuditSpy).toHaveBeenCalled();
      expect(updateAppealSpy).toHaveBeenCalled();
    });
  });
});
