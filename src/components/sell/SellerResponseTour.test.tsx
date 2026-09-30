import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SellerResponseTour } from "./SellerResponseTour";

function renderTour() {
  return render(
    <MemoryRouter>
      <SellerResponseTour />
    </MemoryRouter>,
  );
}

describe("SellerResponseTour", () => {
  it("walks through the seller response steps and links to Browse", () => {
    renderTour();

    fireEvent.click(screen.getByRole("button", { name: "Start tour" }));
    expect(screen.getByText("Open one of your listings")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Find the review")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Choose Respond as seller")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Write and submit your reply")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse listings" })).toHaveAttribute("href", "/browse");
  });

  it("supports moving back and closing the tour", () => {
    renderTour();

    fireEvent.click(screen.getByRole("button", { name: "Start tour" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Open one of your listings")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close seller response tour" }));
    expect(screen.queryByText("Open one of your listings")).not.toBeInTheDocument();
  });
});