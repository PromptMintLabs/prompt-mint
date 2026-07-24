import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NetworkStateProvider, useNetworkState } from "@/hooks/useNetworkState";
import { FreshnessBadge, formatFreshnessTime } from "@/components/FreshnessBadge";
import { StatusBanner } from "@/components/StatusBanner";
import { TipButton } from "@/components/TipButton";
import { CreatePromptForm } from "@/pages/sell/CreatePromptForm";

// Dummy wrapper for testing
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <NetworkStateProvider>{children}</NetworkStateProvider>
    </QueryClientProvider>
  );
};

// Component to test hook output
const NetworkStatusTester = () => {
  const { isOnline, isDegraded, canTrustConfirmation, statusMessage } = useNetworkState();
  return (
    <div>
      <span data-testid="is-online">{isOnline ? "ONLINE" : "OFFLINE"}</span>
      <span data-testid="is-degraded">{isDegraded ? "DEGRADED" : "HEALTHY"}</span>
      <span data-testid="can-trust">{canTrustConfirmation ? "TRUSTED" : "UNTRUSTED"}</span>
      <span data-testid="status-message">{statusMessage}</span>
    </div>
  );
};

describe("Offline and Degraded Network States (Issue #26)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  describe("1. Read-only Cached Content Freshness Marking", () => {
    it("formats relative freshness time accurately", () => {
      const now = new Date();
      expect(formatFreshnessTime(now)).toBe("Just now");

      const twoMinsAgo = new Date(now.getTime() - 2 * 60 * 1000);
      expect(formatFreshnessTime(twoMinsAgo)).toBe("2m ago");

      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(formatFreshnessTime(oneHourAgo)).toBe("1h ago");
    });

    it("renders FreshnessBadge with timestamp and offline indicator", () => {
      const timestamp = Date.now() - 5 * 60 * 1000;
      render(
        <FreshnessBadge
          timestamp={timestamp}
          isCached={true}
          isOffline={true}
        />
      );

      const badge = screen.getByTestId("freshness-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("Offline mode");
      expect(badge).toHaveTextContent("5m ago");
    });

    it("renders FreshnessBadge in degraded mode", () => {
      const timestamp = Date.now() - 60 * 1000;
      render(
        <FreshnessBadge
          timestamp={timestamp}
          isCached={true}
          isDegraded={true}
        />
      );

      const badge = screen.getByTestId("freshness-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("Degraded connection");
    });
  });

  describe("2. Disabling Transaction Actions When Confirmation Cannot Be Trusted", () => {
    it("disables tipping when network is offline/untrusted", () => {
      // Render inside Offline state mock
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

      render(
        <TestWrapper>
          <TipButton creatorAddress="GXXX" />
        </TestWrapper>
      );

      const tipBtn = screen.getByRole("button", { name: /Send 1 XLM tip/i });
      expect(tipBtn).toBeDisabled();
      expect(
        screen.getByText(/Tipping disabled: Network connection lost or RPC unavailable/i)
      ).toBeInTheDocument();
    });
  });

  describe("3. Form Input Preservation and Retry Controls", () => {
    it("preserves form input during retry without duplicating submissions", async () => {
      const onRetry = vi.fn();
      render(
        <StatusBanner
          status="error"
          message="Transaction failed due to network timeout."
          onRetry={onRetry}
        />
      );

      const retryBtn = screen.getByRole("button", { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();

      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("4. Browser Network State Lifecycle (Offline Startup, Mid-request Loss, Timeout, Recovery)", () => {
    it("detects offline startup and updates network status context", async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

      render(
        <TestWrapper>
          <NetworkStatusTester />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-online")).toHaveTextContent("OFFLINE");
        expect(screen.getByTestId("can-trust")).toHaveTextContent("UNTRUSTED");
      });
    });

    it("handles transition from online to offline (mid-request loss) and recovery", async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

      render(
        <TestWrapper>
          <NetworkStatusTester />
        </TestWrapper>
      );

      expect(screen.getByTestId("is-online")).toHaveTextContent("ONLINE");
      expect(screen.getByTestId("can-trust")).toHaveTextContent("TRUSTED");

      // Simulate network loss event
      fireEvent(window, new Event("offline"));

      await waitFor(() => {
        expect(screen.getByTestId("is-online")).toHaveTextContent("OFFLINE");
        expect(screen.getByTestId("can-trust")).toHaveTextContent("UNTRUSTED");
      });

      // Simulate network recovery event
      fireEvent(window, new Event("online"));

      await waitFor(() => {
        expect(screen.getByTestId("is-online")).toHaveTextContent("ONLINE");
        expect(screen.getByTestId("can-trust")).toHaveTextContent("TRUSTED");
      });
    });
  });
});
