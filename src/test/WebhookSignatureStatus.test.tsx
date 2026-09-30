import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WebhookSignatureStatus } from "../components/webhooks/WebhookSignatureStatus";

describe("WebhookSignatureStatus Component (#755)", () => {
  it("renders verified status correctly", () => {
    render(<WebhookSignatureStatus status="verified" />);
    expect(screen.getByText("Signature Verified")).toBeInTheDocument();
  });

  it("renders invalid status correctly", () => {
    render(<WebhookSignatureStatus status="invalid" />);
    expect(screen.getByText("Invalid Signature")).toBeInTheDocument();
  });

  it("renders expired status correctly", () => {
    render(<WebhookSignatureStatus status="expired" />);
    expect(screen.getByText("Signature Expired")).toBeInTheDocument();
  });

  it("renders missing_secret status correctly", () => {
    render(<WebhookSignatureStatus status="missing_secret" />);
    expect(screen.getByText("Missing Secret")).toBeInTheDocument();
  });

  it("toggles detail drawer when showDetails is true and button is clicked", () => {
    render(
      <WebhookSignatureStatus
        status="verified"
        signature="sha256=abcdef0123456789abcdef0123456789"
        message="All checks passed"
        showDetails={true}
      />,
    );

    expect(screen.queryByText("All checks passed")).not.toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: "Toggle signature details" });
    fireEvent.click(toggleBtn);

    expect(screen.getByText("All checks passed")).toBeInTheDocument();
    expect(screen.getByText(/sha256=abcde/)).toBeInTheDocument();
  });
});

