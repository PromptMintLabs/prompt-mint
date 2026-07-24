import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewClient } from "../lib/reviews/reviewClient";

describe("Seller Response on Reviews", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("ReviewClient.submitSellerResponse", () => {
    it("returns success when verified seller responds", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            sellerResponse: {
              text: "Thank you for your feedback! We have improved the prompt based on your suggestions.",
              createdAt: Date.now(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await ReviewClient.submitSellerResponse(
        "1",
        "review_1",
        "GSELLER12345",
        "Thank you for your feedback!"
      );
      expect(res.success).toBe(true);
      expect(res.sellerResponse.text).toBe(
        "Thank you for your feedback! We have improved the prompt based on your suggestions."
      );
    });

    it("throws 403 when non-seller tries to respond", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Only the verified seller of this prompt can respond to reviews",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        ReviewClient.submitSellerResponse("1", "review_1", "GNONSELLER999", "Some response")
      ).rejects.toThrow("Only the verified seller of this prompt can respond to reviews");
    });

    it("throws 404 when review not found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Review not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        ReviewClient.submitSellerResponse("1", "nonexistent_review", "GSELLER12345", "Response")
      ).rejects.toThrow("Review not found");
    });

    it("throws 400 when required fields are missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        ReviewClient.submitSellerResponse("", "", "", "")
      ).rejects.toThrow("Missing required fields");
    });

    it("throws 400 when response text exceeds 1000 characters", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Response text must not exceed 1000 characters" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(
        ReviewClient.submitSellerResponse("1", "review_1", "GSELLER12345", "x".repeat(1001))
      ).rejects.toThrow("Response text must not exceed 1000 characters");
    });
  });
});
