import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewClient } from "../lib/reviews/reviewClient";

describe("Review Helpful Votes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("ReviewClient.voteReview", () => {
    it("returns voted:true when voting for the first time", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            voted: true,
            helpfulVotes: 4,
            message: "Vote recorded",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await ReviewClient.voteReview("1", "review_1", "GVOTER12345");
      expect(res.voted).toBe(true);
      expect(res.helpfulVotes).toBe(4);
    });

    it("toggles vote off when voting again (dedup)", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            voted: false,
            helpfulVotes: 2,
            message: "Vote removed",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await ReviewClient.voteReview("1", "review_1", "GVOTER12345");
      expect(res.voted).toBe(false);
      expect(res.helpfulVotes).toBe(2);
    });

    it("throws an error when user votes on own review", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "You cannot vote on your own review" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        ReviewClient.voteReview("1", "review_1", "GABC123XYZ456DEF789GHI012JKL345MNO678PQR901STU234VWX567YZ")
      ).rejects.toThrow("You cannot vote on your own review");
    });

    it("throws an error for non-existent review", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Review not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        ReviewClient.voteReview("1", "nonexistent_review", "GVOTER12345")
      ).rejects.toThrow("Review not found");
    });

    it("throws 400 when missing required fields", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Missing required fields: promptId, reviewId, userAddress" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        ReviewClient.voteReview("", "", "")
      ).rejects.toThrow("Missing required fields");
    });
  });

  describe("ReviewClient.voteReview network error", () => {
    it("throws on network failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

      await expect(
        ReviewClient.voteReview("1", "review_1", "GVOTER12345")
      ).rejects.toThrow("Network error");
    });
  });
});
