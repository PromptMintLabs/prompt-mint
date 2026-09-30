import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/test/render";
import SellPage from "@/pages/sell/page";

vi.mock("@/lib/env", () => ({
  unlockPublicKey: "unlock-public-key",
  stellarWalletNetwork: "TESTNET",
  stellarNetwork: "TESTNET",
}));

vi.mock("@/lib/stellar/browserConfig", () => ({
  browserStellarConfig: {
    rpcUrl: "https://stellar.test/rpc",
    networkPassphrase: "Test SDF Network ; September 2015",
    allowHttp: false,
    promptHashContractId: "prompt-hash-contract",
    nativeAssetContractId: "native-asset-contract",
    simulationAccount: "GTESTSIMULATIONACCOUNT1234567890ABCDEFGH1234567890ABCD",
  },
}));

vi.mock("@/lib/crypto/promptCrypto", () => ({
  encryptPromptPlaintext: vi.fn().mockResolvedValue({
    encryptedPrompt: "enc",
    encryptionIv: "iv",
    contentHash: "a".repeat(64),
    keyBytes: new Uint8Array([1]),
  }),
  wrapPromptKey: vi.fn().mockResolvedValue("wrapped"),
}));

vi.mock("@/lib/stellar/promptHashClient", () => ({
  createPrompt: vi.fn().mockResolvedValue({ promptId: 1n, txHash: "hash" }),
}));

vi.mock("@/lib/validation/listing", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    validateListingForm: vi.fn().mockImplementation(actual.validateListingForm),
    validateImageMetadata: vi.fn().mockResolvedValue(null),
  };
});

describe("SellPage unsaved changes guard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("prevents switching from create to manage when form is dirty", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithProviders(<SellPage />, {
      wallet: {
        address: "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
        signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "xdr" }),
      },
    });

    fireEvent.change(
      screen.getByLabelText(/title/i),
      { target: { value: "Dirty title" } },
    );

    await userEvent.click(
      screen.getByRole("button", { name: /my prompts/i }),
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("unsaved changes"),
    );
    expect(screen.getByRole("button", { name: /create prompt listing/i })).toBeInTheDocument();
  });

  it("allows switching from create to manage when confirmed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithProviders(<SellPage />, {
      wallet: {
        address: "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
        signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "xdr" }),
      },
    });

    fireEvent.change(
      screen.getByLabelText(/title/i),
      { target: { value: "Dirty title" } },
    );

    await userEvent.click(
      screen.getByRole("button", { name: /my prompts/i }),
    );

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText(/no draft listings/i)).toBeInTheDocument();
  });

  it("allows switching back to create without confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");

    renderWithProviders(<SellPage />, {
      wallet: {
        address: "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
        signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "xdr" }),
      },
    });

    await userEvent.click(
      screen.getByRole("button", { name: /my prompts/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create listing/i }),
    );

    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
