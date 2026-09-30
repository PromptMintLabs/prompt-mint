import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppealSubmissionForm } from "../components/moderation/AppealSubmissionForm";

describe("AppealSubmissionForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("signs and submits an appeal with its selected evidence file", async () => {
    const user = userEvent.setup();
    const signMessage = vi.fn().mockResolvedValue({ signedMessage: "wallet-signature" });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token: "appeal-token",
        challenge: "sign this appeal",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        appealId: "appeal-123",
        reviewId: "review_2",
        status: "submitted",
        submittedAt: "2026-09-28T12:00:00.000Z",
      }), { status: 201, headers: { "Content-Type": "application/json" } }));

    render(
      <AppealSubmissionForm
        address="GAPPELLANT123"
        signMessage={signMessage}
        initialReviewId="review_2"
      />
    );

    const evidence = new File(["%PDF-1.7 evidence"], "evidence.pdf", { type: "application/pdf" });
    const evidenceBytes = new TextEncoder().encode("%PDF-1.7 evidence");
    Object.defineProperty(evidence, "arrayBuffer", {
      value: async () => evidenceBytes.buffer,
    });
    await user.upload(screen.getByLabelText("Choose supporting files"), evidence);
    await user.type(
      screen.getByLabelText("Why should this decision be reconsidered?"),
      "The review was removed in error and this evidence adds important context."
    );
    await user.click(screen.getByRole("button", { name: "Submit appeal" }));

    await screen.findByText("Your appeal is in the review queue");
    expect(signMessage).toHaveBeenCalledWith("sign this appeal");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const submittedRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(submittedRequest).toMatchObject({
      address: "GAPPELLANT123",
      reviewId: "review_2",
      token: "appeal-token",
      signedMessage: "wallet-signature",
      attachments: [{ name: "evidence.pdf", content: btoa("%PDF-1.7 evidence") }],
    });
    expect(screen.getByRole("list", { name: "Appeal status history" })).toBeInTheDocument();
  });

  it("enforces supporting file size limits before submission", async () => {
    const file = new File(["oversized"], "oversized.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 1024 * 1024 + 1 });
    render(
      <AppealSubmissionForm
        address="GAPPELLANT123"
        signMessage={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Choose supporting files"), {
      target: { files: [file] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Each supporting file must be 1 MB or smaller.");
    await waitFor(() => expect(screen.queryByText("oversized.pdf")).not.toBeInTheDocument());
  });
});
