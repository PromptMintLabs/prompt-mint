import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppealStatusTimeline } from "./AppealStatusTimeline";

describe("AppealStatusTimeline", () => {
  it("shows completed and upcoming appeal stages", () => {
    render(
      <AppealStatusTimeline
        currentStatus="under_review"
        events={[{ status: "submitted", occurredAt: "2026-09-20", note: "Appeal received." }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Appeal status" })).toBeInTheDocument();
    expect(screen.getByText("Appeal received.")).toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(screen.getByText("Decision recorded")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Appeal status history" })).toBeInTheDocument();
  });

  it("renders a final rejected status and tolerates invalid dates", () => {
    render(
      <AppealStatusTimeline
        currentStatus="rejected"
        events={[{ status: "rejected", occurredAt: "not-a-date" }]}
      />,
    );

    expect(screen.getByText("Appeal rejected")).toBeInTheDocument();
    expect(screen.getByText("Date unavailable")).toBeInTheDocument();
    expect(screen.getByText("The original moderation action remains in effect.")).toBeInTheDocument();
  });
});