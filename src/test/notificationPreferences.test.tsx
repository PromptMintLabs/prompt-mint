import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationPreferences } from "../components/NotificationPreferences";

describe("NotificationPreferences Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          preferences: {
            promptPurchased: true,
            promptUpdated: true,
            newReviews: true,
            priceAlerts: true,
            emailNotifications: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
  });

  it("renders default notification toggles for buyers and creators", async () => {
    render(<NotificationPreferences walletAddress="GABC1234567890XYZ" />);

    await waitFor(() => {
      expect(screen.queryByText("Loading preferences...")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
    expect(screen.getByText("Prompt Purchased")).toBeInTheDocument();
    expect(screen.getByText("New Prompt Reviews")).toBeInTheDocument();
    expect(screen.getByText("Purchased Prompt Updates")).toBeInTheDocument();
    expect(screen.getByText("Price & Status Changes")).toBeInTheDocument();
  });

  it("allows toggling preferences and saves to localStorage", async () => {
    const wallet = "GABC1234567890XYZ";
    render(<NotificationPreferences walletAddress={wallet} />);

    await waitFor(() => {
      expect(screen.queryByText("Loading preferences...")).not.toBeInTheDocument();
    });

    const switchBtn = screen.getByRole("switch", { name: "Prompt Purchased" });
    expect(switchBtn).toHaveAttribute("aria-checked", "true");

    fireEvent.click(switchBtn);
    expect(switchBtn).toHaveAttribute("aria-checked", "false");

    const cached = localStorage.getItem(`prompt_mint_notification_prefs_${wallet.toLowerCase()}`);
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!).promptPurchased).toBe(false);
  });

  it("saves preferences to backend API when Save button is clicked", async () => {
    const wallet = "GABC1234567890XYZ";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (typeof url === "string" && url.includes("/api/user/preferences")) {
        return new Response(JSON.stringify({ message: "Preferences updated successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    });

    render(<NotificationPreferences walletAddress={wallet} />);

    await waitFor(() => {
      expect(screen.queryByText("Loading preferences...")).not.toBeInTheDocument();
    });

    const saveBtn = screen.getByRole("button", { name: /Save Preferences/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/user/preferences",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });
  });
});
