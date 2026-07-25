import { beforeEach, describe, expect, it, vi } from "vitest";
import listReviews from "../../api/reviews/list";
import bulkModeration from "../../api/moderation/actions";
import editReview from "../../api/reviews/edit";
import { ReviewClient } from "../lib/reviews/reviewClient";

function responseRecorder() {
  let statusCode = 0;
  let body: any;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(data: any) { body = data; return response; },
  };
  return { response, get status() { return statusCode; }, get body() { return body; } };
}

describe("review list contract", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("paginates and filters while preserving overall statistics", async () => {
    const recorded = responseRecorder();
    await listReviews({ method: "GET", query: { promptId: "1", page: "1", limit: "1", rating: "5", sort: "helpful" } }, recorded.response);
    expect(recorded.status).toBe(200);
    expect(recorded.body.reviews).toHaveLength(1);
    expect(recorded.body.reviews[0].rating).toBe(5);
    expect(recorded.body.pagination).toMatchObject({ page: 1, limit: 1, total: 1 });
    expect(recorded.body.stats.total).toBe(2);
  });

  it("rejects unsafe list query values", async () => {
    const recorded = responseRecorder();
    await listReviews({ method: "GET", query: { promptId: "1", page: "0", sort: "random" } }, recorded.response);
    expect(recorded.status).toBe(400);
  });

  it("keeps the frontend client aligned with pagination and filter metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      reviews: [], stats: { total: 0, averageRating: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      pagination: { page: 2, limit: 10, total: 11, totalPages: 2, hasMore: false },
      filters: { sort: "helpful", rating: 4 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await ReviewClient.getReviews("1", { page: 2, sort: "helpful", rating: 4 });
    expect(result.pagination.totalPages).toBe(2);
    expect(result.filters).toEqual({ sort: "helpful", rating: 4 });
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("sort=helpful"));
  });
});

describe("review editing and bulk moderation safeguards", () => {
  it("rejects review edits from an address other than the author before access checks", async () => {
    const recorded = responseRecorder();
    await editReview({ method: "PUT", body: { promptId: "1", reviewId: "review_1", userAddress: "GNOTAUTHOR", rating: 5, text: "This is a valid edited review." } }, recorded.response);
    expect(recorded.status).toBe(403);
    expect(recorded.body.error).toContain("author");
  });

  it("requires explicit confirmation before performing bulk actions", async () => {
    const saved = process.env.MODERATOR_ADDRESSES;
    process.env.MODERATOR_ADDRESSES = "GMODERATOR";
    const recorded = responseRecorder();
    await bulkModeration({ method: "POST", body: { moderatorAddress: "GMODERATOR", actions: [{ action: "review_removed", targetType: "review", targetId: "review_1", reason: "Policy violation" }] } }, recorded.response);
    if (saved === undefined) delete process.env.MODERATOR_ADDRESSES;
    else process.env.MODERATOR_ADDRESSES = saved;
    expect(recorded.status).toBe(400);
    expect(recorded.body.error).toContain("confirmed");
  });
});
