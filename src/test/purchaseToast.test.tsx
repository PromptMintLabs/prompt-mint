// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import {
  showPurchaseSuccessToast,
  showPurchaseErrorToast,
} from "@/lib/notifications/purchaseToast";
import { PromptModal } from "@/pages/browse/PromptModal";
import { renderWithProviders } from "@/test/render";
import { PromptHashClient } from "@/lib/stellar/promptHashClient";
import type { WalletContextType } from "@/providers/WalletProvider";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/useNetworkState", () => ({
  useNetworkState: () => ({
    canTrustConfirmation: true,
    isCorrectNetwork: true,
    isLocalOrStandalone: false,
    currentNetwork: "TESTNET",
  }),
}));

vi.mock("@/lib/stellar/promptHashClient", () => ({
  PromptHashClient: {
    checkAccess: vi.fn().mockResolvedValue(false),
    getPrompt: vi.fn().mockResolvedValue({
      id: "1",
      title: "Test Prompt Toast",
      priceStroops: 10000000n,
      active: true,
      creator: "GCREATOR123456789012345678901234567890123456789012345678901234",
      category: "Art",
      imageUrl: "https://example.com/image.png",
      previewText: "Preview text",
      contentHash: "abcdef1234567890",
      salesCount: 0,
    }),
    purchasePrompt: vi.fn(),
  },
}));

vi.mock("@/lib/prompts/unlock", () => ({
  unlockPrompt: vi.fn().mockResolvedValue({ decryptedContent: "secret" }),
}));

vi.mock("@/lib/reviews/reviewClient", () => ({
  ReviewClient: {
    checkEligibility: vi.fn().mockResolvedValue({
      eligible: false,
      alreadyReviewed: false,
      reason: "Only verified buyers can review.",
    }),
    getReviews: vi.fn().mockResolvedValue({
      reviews: [],
      stats: { total: 0, averageRating: 0 },
      pagination: { page: 1, totalPages: 1, hasMore: false },
    }),
  },
}));

describe("Purchase Toast Notifications (#427)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("showPurchaseSuccessToast", () => {
    it("calls toast.success with transaction hash and explorer link", () => {
      const txHash = "tx_1234567890abcdef1234567890abcdef";
      showPurchaseSuccessToast(txHash, { title: "Custom Purchase Success" });

      expect(toast.success).toHaveBeenCalledTimes(1);
      const [title, options] = vi.mocked(toast.success).mock.calls[0];
      expect(title).toBe("Custom Purchase Success");
      expect(options).toBeDefined();

      const descriptionJSX = options?.description as React.ReactElement;
      const { container } = render(descriptionJSX);

      expect(container.textContent).toContain("Tx: tx_123456...567890abcdef");
      const link = screen.getByTestId("toast-explorer-link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        "href",
        "https://stellar.expert/explorer/testnet/tx/tx_1234567890abcdef1234567890abcdef"
      );
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  describe("showPurchaseErrorToast", () => {
    it("calls toast.error with title and error message", () => {
      showPurchaseErrorToast("Insufficient XLM balance", { title: "Purchase Failed" });

      expect(toast.error).toHaveBeenCalledWith("Purchase Failed", {
        description: "Insufficient XLM balance",
        duration: 6000,
      });
    });
  });

  describe("PromptModal Purchase Integration", () => {
    it("shows success toast on successful purchase", async () => {
      const user = userEvent.setup();
      const mockWallet: Partial<WalletContextType> = {
        address: "GBUYER123456789012345678901234567890123456789012345678901234",
        status: "connected",
        network: "TESTNET",
        signMessage: vi.fn(),
      };

      vi.mocked(PromptHashClient.purchasePrompt).mockResolvedValue({
        txHash: "tx_successtest123456",
        success: true,
      });

      renderWithProviders(
        <PromptModal itemId="1" isOpen={true} onClose={vi.fn()} />,
        { wallet: mockWallet }
      );

      const purchaseBtn = await screen.findByRole("button", {
        name: /review fees/i,
      });
      await user.click(purchaseBtn);
      const feeDialog = await screen.findByRole("dialog", { name: /review purchase/i });
      expect(within(feeDialog).getByText(/5% default/i)).toBeInTheDocument();
      expect(within(feeDialog).getByText("0.0500000 XLM")).toBeInTheDocument();
      expect(PromptHashClient.purchasePrompt).not.toHaveBeenCalled();
      await user.click(within(feeDialog).getByRole("button", { name: /confirm purchase/i }));

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/purchased/i),
        expect.objectContaining({
          description: expect.anything(),
        })
      );
    });

    it("shows error toast on purchase failure", async () => {
      const user = userEvent.setup();
      const mockWallet: Partial<WalletContextType> = {
        address: "GBUYER123456789012345678901234567890123456789012345678901234",
        status: "connected",
        network: "TESTNET",
        signMessage: vi.fn(),
      };

      vi.mocked(PromptHashClient.purchasePrompt).mockRejectedValue(
        new Error("Insufficient balance")
      );

      renderWithProviders(
        <PromptModal itemId="1" isOpen={true} onClose={vi.fn()} />,
        { wallet: mockWallet }
      );

      const purchaseBtn = await screen.findByRole("button", {
        name: /review fees/i,
      });
      await user.click(purchaseBtn);
      const feeDialog = await screen.findByRole("dialog", { name: /review purchase/i });
      await user.click(within(feeDialog).getByRole("button", { name: /confirm purchase/i }));

      expect(toast.error).toHaveBeenCalledWith(
        "Purchase Failed",
        expect.objectContaining({
          description: expect.stringMatching(/insufficient/i),
        })
      );
    });
  });
});
