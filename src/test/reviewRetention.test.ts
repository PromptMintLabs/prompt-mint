import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pruneExpiredHelpfulVoteActivity,
  pruneRemovedReviews,
  cleanupReviewData,
  getReviews,
  addReview,
  _resetReviewStorage,
  HELPFUL_VOTE_ACTIVITY_RETENTION_MS,
  REMOVED_REVIEW_RETENTION_MS,
  StoredReview,
} from "../../api/reviews/data";
import cleanupHandler from "../../api/reviews/cleanup";

function responseRecorder() {
  let statusCode = 0;
  let body: any;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(data: any) {
      body = data;
      return response;
    },
  };
  return {
    response,
    get status() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

describe("Review retention and cleanup logic", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetReviewStorage();
  });

  describe("Helpful vote activity pruning", () => {
    it("prunes helpful vote activity older than 24 hours while keeping recent activity", () => {
      const now = Date.now();
      const testReview: StoredReview = {
        id: "retention_test_1",
        promptId: "prompt_retention_1",
        userAddress: "GUSER1111111111111111111111111111111111111111111111111111111",
        rating: 5,
        text: "Great prompt for generating tests and mocks quickly.",
        createdAt: now - 86400000 * 3,
        verified: true,
        helpfulVotes: 2,
        voters: ["GVOTER1", "GVOTER2"],
        helpfulVoteActivity: [
          { voterAddress: "GVOTER1", votedAt: now - HELPFUL_VOTE_ACTIVITY_RETENTION_MS - 10000 }, // expired (>24h)
          { voterAddress: "GVOTER2", votedAt: now - 3600000 }, // fresh (1h ago)
        ],
        editHistory: [],
      };

      addReview(testReview);

      const prunedCount = pruneExpiredHelpfulVoteActivity(now);
      expect(prunedCount).toBe(1);

      const stored = getReviews("prompt_retention_1").find((r) => r.id === "retention_test_1");
      expect(stored?.helpfulVoteActivity).toHaveLength(1);
      expect(stored?.helpfulVoteActivity?.[0].voterAddress).toBe("GVOTER2");
    });
  });

  describe("Removed review retention window", () => {
    it("preserves removed reviews within the 90-day retention window", () => {
      const now = Date.now();
      const recentRemovedReview: StoredReview = {
        id: "removed_recent",
        promptId: "prompt_retention_2",
        userAddress: "GUSER2222222222222222222222222222222222222222222222222222222",
        rating: 1,
        text: "Spam content that was recently moderated and removed.",
        createdAt: now - 86400000 * 10,
        verified: true,
        helpfulVotes: 0,
        voters: [],
        editHistory: [],
        moderation: {
          status: "removed",
          moderatorAddress: "gmoderator",
          reason: "Spam",
          updatedAt: now - 86400000 * 5, // removed 5 days ago (<90 days)
        },
      };

      addReview(recentRemovedReview);

      const { removedCount, removedReviewIds } = pruneRemovedReviews(REMOVED_REVIEW_RETENTION_MS, now);
      expect(removedReviewIds).not.toContain("removed_recent");
      expect(getReviews("prompt_retention_2").some((r) => r.id === "removed_recent")).toBe(true);
    });

    it("prunes removed reviews older than the retention window", () => {
      const now = Date.now();
      const oldRemovedReview: StoredReview = {
        id: "removed_expired",
        promptId: "prompt_retention_3",
        userAddress: "GUSER3333333333333333333333333333333333333333333333333333333",
        rating: 2,
        text: "Removed review that exceeded the 90-day retention period.",
        createdAt: now - 86400000 * 120,
        verified: true,
        helpfulVotes: 0,
        voters: [],
        editHistory: [],
        moderation: {
          status: "removed",
          moderatorAddress: "gmoderator",
          reason: "Violation",
          updatedAt: now - 86400000 * 95, // removed 95 days ago (>90 days)
        },
      };

      addReview(oldRemovedReview);

      const { removedCount, removedReviewIds } = pruneRemovedReviews(REMOVED_REVIEW_RETENTION_MS, now);
      expect(removedReviewIds).toContain("removed_expired");
      expect(getReviews("prompt_retention_3").some((r) => r.id === "removed_expired")).toBe(false);
    });

    it("preserves removed reviews with active appeals regardless of age", () => {
      const now = Date.now();
      const appealingReview: StoredReview = {
        id: "removed_with_appeal",
        promptId: "prompt_retention_4",
        userAddress: "GUSER4444444444444444444444444444444444444444444444444444444",
        rating: 3,
        text: "Removed review that is currently undergoing moderation appeal.",
        createdAt: now - 86400000 * 150,
        verified: true,
        helpfulVotes: 0,
        voters: [],
        editHistory: [],
        moderation: {
          status: "removed",
          moderatorAddress: "gmoderator",
          reason: "Disputed removal",
          updatedAt: now - 86400000 * 100,
        },
      };

      addReview(appealingReview);

      // Pass "removed_with_appeal" as an excluded review ID (active appeal in progress)
      const { removedCount, removedReviewIds } = pruneRemovedReviews(
        REMOVED_REVIEW_RETENTION_MS,
        now,
        new Set(["removed_with_appeal"]),
      );

      expect(removedReviewIds).not.toContain("removed_with_appeal");
      expect(getReviews("prompt_retention_4").some((r) => r.id === "removed_with_appeal")).toBe(true);
    });
  });

  describe("API cleanup endpoint", () => {
    it("handles cleanup POST requests and returns retention execution report", async () => {
      const recorded = responseRecorder();
      await cleanupHandler(
        {
          method: "POST",
          body: { dryRun: false },
          headers: {},
        },
        recorded.response,
      );

      expect(recorded.status).toBe(200);
      expect(recorded.body).toMatchObject({
        success: true,
        dryRun: false,
      });
      expect(typeof recorded.body.prunedVotes).toBe("number");
      expect(typeof recorded.body.removedReviews).toBe("number");
    });

    it("rejects non-POST methods", async () => {
      const recorded = responseRecorder();
      await cleanupHandler({ method: "GET" }, recorded.response);
      expect(recorded.status).toBe(405);
    });
  });
});
