/**
 * Tests for the webhook management console tabs (issue #753).
 *
 * The sibling tabs are stubbed so this suite exercises the tab wiring without
 * pulling in their chart / wizard dependencies. The Subscriptions tab itself is
 * covered in depth by `webhookSubscriptions.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "./render";

vi.mock("@/components/webhooks/WebhookPerformanceDashboard", () => ({
  default: () => <div>Performance panel</div>,
}));
vi.mock("@/components/webhooks/WebhookBacklogViewer", () => ({
  default: () => <div>Backlog panel</div>,
}));
vi.mock("@/components/webhooks/WebhookTopicSelector", () => ({
  default: () => <div>Topics panel</div>,
}));
vi.mock("@/components/webhooks/WebhookSecretRotation", () => ({
  default: () => <div>Security panel</div>,
}));

import WebhookManagement from "../pages/settings/WebhookManagement";

const WALLET = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV";

describe("WebhookManagement console", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "No webhook registered for this wallet." }),
    }) as unknown as typeof fetch;
  });

  it("adds a Subscriptions tab alongside the existing four", () => {
    renderWithProviders(<WebhookManagement />, {
      wallet: { address: WALLET, status: "connected" },
    });

    for (const name of ["Performance", "Backlog", "Topics", "Security", "Subscriptions"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("opens the subscriptions console from its tab", async () => {
    renderWithProviders(<WebhookManagement />, {
      wallet: { address: WALLET, status: "connected" },
    });

    const trigger = screen.getByRole("tab", { name: "Subscriptions" });
    fireEvent.focus(trigger);
    fireEvent.mouseDown(trigger, { button: 0 });
    fireEvent.click(trigger);

    expect(await screen.findByText("Subscription Endpoints")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Register subscription/ }),
    ).toBeInTheDocument();
  });
});
