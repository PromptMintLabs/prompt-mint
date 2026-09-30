import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ReviewResponse } from "../models/ReviewResponse.js";
import {
  getCreatorReviewResponseMetrics,
  recordReviewResponse,
} from "../services/reviewResponseMetrics.js";

describe("reviewResponseMetrics", () => {
  describe("recordReviewResponse", () => {
    it("should create a review response record", async () => {
      const promptId = "test-prompt-123";
      const creatorWallet = "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G";
      const responseText = "Great feedback, thanks!";

      await recordReviewResponse(promptId, creatorWallet, responseText);

      const record = await ReviewResponse.findOne({ promptId, creatorWallet });
      expect(record).toBeDefined();
      expect(record?.responseText).toBe(responseText);
      expect(record?.promptId).toBe(promptId);
      expect(record?.creatorWallet.toLowerCase()).toBe(creatorWallet.toLowerCase());
    });
  });

  describe("getCreatorReviewResponseMetrics", () => {
    it("should return zero metrics for creator with no responses", async () => {
      const creatorWallet = "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G";

      const metrics = await getCreatorReviewResponseMetrics(creatorWallet, 30);

      expect(metrics.creatorWallet.toLowerCase()).toBe(creatorWallet.toLowerCase());
      expect(metrics.responsesCount).toBe(0);
      expect(metrics.responseRate).toBe(0);
      expect(metrics.totalReviewsReceived).toBeGreaterThanOrEqual(0);
    });
  });
});
