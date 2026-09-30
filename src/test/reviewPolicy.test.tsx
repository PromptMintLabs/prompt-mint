import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ReviewPolicy from "../pages/ReviewPolicy";

describe("ReviewPolicy", () => {
  it("explains the review requirements and prohibited content", () => {
    render(
      <MemoryRouter>
        <ReviewPolicy />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Review Content Policy" })).toBeInTheDocument();
    expect(screen.getByText(/Reviews are public and tied to a verified purchase/)).toBeInTheDocument();
    expect(screen.getByText(/Threats, harassment, hate speech/)).toBeInTheDocument();
    expect(screen.getByText(/between 10 and 500 characters/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse prompts" })).toHaveAttribute("href", "/browse");
  });
});