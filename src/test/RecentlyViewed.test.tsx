import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecentlyViewed } from "../components/RecentlyViewed";
import {
  enableRecentlyViewed,
  addRecentlyViewed,
} from "../lib/browsing/history";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe("RecentlyViewed Component", () => {
  const testWalletAddress = "GABC1234567890XYZ";

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows connection prompt when wallet is not connected", () => {
    renderWithProviders(<RecentlyViewed walletAddress={null} />);

    expect(
      screen.getByText("Connect your wallet to see recently viewed listings.")
    ).toBeInTheDocument();
  });

  it("shows empty state when no entries exist and tracking is enabled", () => {
    enableRecentlyViewed(testWalletAddress);

    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    expect(screen.getByText("Recently Viewed")).toBeInTheDocument();
    expect(
      screen.getByText("No recently viewed listings")
    ).toBeInTheDocument();
  });

  it("shows privacy controls", () => {
    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    expect(screen.getByText("Recently Viewed History")).toBeInTheDocument();
    expect(
      screen.getByText(
        "History is disabled. Enable to remember listings you view."
      )
    ).toBeInTheDocument();
  });

  it("enables tracking when enable button is clicked", async () => {
    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    const enableButton = screen.getByRole("button", { name: "Enable" });
    fireEvent.click(enableButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Tracking 0 listings viewed in the last 30 days/
        )
      ).toBeInTheDocument();
    });
  });

  it("disables tracking when disable button is clicked", async () => {
    enableRecentlyViewed(testWalletAddress);

    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    const disableButton = screen.getByRole("button", { name: "Disable" });
    fireEvent.click(disableButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "History is disabled. Enable to remember listings you view."
        )
      ).toBeInTheDocument();
    });
  });

  it("shows privacy information", () => {
    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    expect(
      screen.getByText(/History is stored locally on your device only/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Data is scoped to your connected wallet/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No browsing data is sent to our servers/)
    ).toBeInTheDocument();
  });

  it("shows settings button", () => {
    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    const settingsButton = screen.getByRole("button", { name: "" });
    expect(settingsButton).toBeInTheDocument();
  });

  it("shows settings panel when enabled", async () => {
    enableRecentlyViewed(testWalletAddress);

    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    const settingsButton = screen.getByRole("button", { name: "" });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText("Privacy Settings")).toBeInTheDocument();
      expect(screen.getByText("Retention Period")).toBeInTheDocument();
      expect(screen.getByText("Maximum Entries")).toBeInTheDocument();
    });
  });

  it("shows clear all button in settings", async () => {
    enableRecentlyViewed(testWalletAddress);

    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    const settingsButton = screen.getByRole("button", { name: "" });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      const clearButton = screen.getByRole("button", {
        name: /Clear All History/,
      });
      expect(clearButton).toBeInTheDocument();
    });
  });

  it("displays entries when tracking is enabled", async () => {
    enableRecentlyViewed(testWalletAddress);
    addRecentlyViewed(testWalletAddress, {
      promptId: "123",
      title: "Test Prompt",
      category: "AI",
    });

    // Mock the query to return prompt data
    vi.mock("@/lib/stellar/promptHashClient", () => ({
      PromptHashClient: {
        getPrompt: vi.fn().mockResolvedValue({
          title: "Test Prompt",
          imageUrl: "https://example.com/image.jpg",
          priceStroops: "1000000",
          category: "AI",
        }),
      },
    }));

    renderWithProviders(<RecentlyViewed walletAddress={testWalletAddress} />);

    await waitFor(() => {
      expect(screen.getByText("Test Prompt")).toBeInTheDocument();
      expect(screen.getByText("AI")).toBeInTheDocument();
      expect(screen.getByText("Viewed")).toBeInTheDocument();
    });
  });
});
