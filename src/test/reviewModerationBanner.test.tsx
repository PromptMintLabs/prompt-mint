import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ReviewList } from "../components/prompts/ReviewList";

const baseReview = {
  id: "review-1",
  promptId: "prompt-1",
  userAddress: "GABC123456789",
  rating: 4,
  text: "Useful prompt with a clear result.",
  createdAt: Date.now(),
  verified: true,
  helpfulVotes: 0,
};

describe("Review moderation banner", () => {
  it("shows the moderation decision and explanation when present", () => {
    render(
      <MemoryRouter>
        <ReviewList
          reviews={[{
            ...baseReview,
            moderation: {
              status: "removed",
              moderatorAddress: "gmoderator1",
              reason: "Personal information was removed from the review.",
              updatedAt: Date.UTC(2026, 0, 15),
            },
          }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("note", {
      name: "Review removed: Personal information was removed from the review.",
    })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appeal this decision" }))
      .toHaveAttribute("href", "/appeals?reviewId=review-1");
    expect(screen.getByText("Decision recorded 1/15/2026")).toBeInTheDocument();
  });

  it("does not show a moderation banner for unmoderated reviews", () => {
    render(<ReviewList reviews={[baseReview]} />);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByText(baseReview.text)).toBeInTheDocument();
  });

  it("replaces removed review content with the moderation explanation", () => {
    render(
      <MemoryRouter>
        <ReviewList
          reviews={[{
            ...baseReview,
            moderation: {
              status: "removed",
              moderatorAddress: "gmoderator1",
              reason: "Personal information was included.",
            },
          }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("note", {
      name: "Review removed: Personal information was included.",
    })).toBeInTheDocument();
    expect(screen.queryByText(baseReview.text)).not.toBeInTheDocument();
    expect(screen.queryByText(baseReview.userAddress)).not.toBeInTheDocument();
  });

  it("includes public moderation decision details in the review list response", async () => {
    const { updateReview } = await import("../../api/reviews/data");
    const { default: handler } = await import("../../api/reviews/list");
    const decision = {
      status: "approved" as const,
      moderatorAddress: "gmoderator1",
      reason: "The review was checked and approved.",
          updatedAt: Date.UTC(2026, 0, 15),
    };
    updateReview("1", "review_1", { moderation: decision });

    const response: any = {
      statusCode: 0,
      body: undefined,
      setHeader() {
        return response;
      },
      status(code: number) {
        response.statusCode = code;
        return response;
      },
      json(body: unknown) {
        response.body = body;
        return response;
      },
    };
    await handler({ method: "GET", headers: {}, query: { promptId: "1" } }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.reviews.find((review: { id: string }) => review.id === "review_1"))
      .toMatchObject({ moderation: decision });
  });

  it("redacts removed review details and excludes them from rating statistics", async () => {
    const { updateReview } = await import("../../api/reviews/data");
    const { default: handler } = await import("../../api/reviews/list");
    updateReview("1", "review_1", {
      moderation: {
        status: "removed",
          moderatorAddress: "gmoderator1",
        reason: "Policy violation.",
      },
    });
    const response: any = {
      statusCode: 0,
      body: undefined,
      setHeader() {
        return response;
      },
      status(code: number) {
        response.statusCode = code;
        return response;
      },
      json(body: unknown) {
        response.body = body;
        return response;
      },
    };

    await handler({ method: "GET", headers: {}, query: { promptId: "1" } }, response);

    expect(response.body.reviews.find((review: { id: string }) => review.id === "review_1"))
      .toMatchObject({ userAddress: "", rating: 0, text: "", helpfulVotes: 0 });
    expect(response.body.stats).toMatchObject({ total: 0, averageRating: 0 });
  });
});