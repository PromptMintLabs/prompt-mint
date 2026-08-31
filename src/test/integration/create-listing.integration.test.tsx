import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreatePromptForm } from "@/pages/sell/CreatePromptForm";
import { validateListingForm } from "@/lib/validation/listing";
import { renderWithProviders } from "@/test/render";

const encryptPromptPlaintextMock = vi.fn();
const wrapPromptKeyMock = vi.fn();
const createPromptMock = vi.fn();

vi.mock("@/lib/env", () => ({
  unlockPublicKey: "unlock-public-key",
  stellarWalletNetwork: "TESTNET",
  stellarNetwork: "TESTNET",
}));

vi.mock("@/util/wallet", () => ({
  wallet: {
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
  },
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

vi.mock("@/lib/crypto/promptCrypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crypto/promptCrypto")>();
  return {
    ...actual,
    encryptPromptPlaintext: (...args: unknown[]) =>
      encryptPromptPlaintextMock(...args),
    wrapPromptKey: (...args: unknown[]) => wrapPromptKeyMock(...args),
  };
});

vi.mock("@/lib/stellar/promptHashClient", () => ({
  createPrompt: (...args: unknown[]) => createPromptMock(...args),
}));

vi.mock("@/lib/validation/listing", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    validateListingForm: vi.fn().mockImplementation(actual.validateListingForm),
    validateImageMetadata: vi.fn().mockResolvedValue(null),
  };
});

async function selectCategory(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: /category/i }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

describe("create listing integration coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the listing form before any contract mutation is attempted", async () => {
    renderWithProviders(<CreatePromptForm />);

    const priceInput = screen.getByLabelText(/price in xlm/i);
    fireEvent.change(priceInput, { target: { value: "0" } });

    const submitBtn = screen.getByRole("button", { name: /create prompt listing/i });
    expect(submitBtn).toBeDisabled();
    expect(createPromptMock).not.toHaveBeenCalled();
  });

  it("persists an unsent draft when the form unmounts before submission", () => {
    window.localStorage.clear();

    const { unmount } = renderWithProviders(<CreatePromptForm />, {
      wallet: {
        address: "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
      },
    });

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Draft title from session recovery" },
    });
    fireEvent.change(screen.getByLabelText(/preview text/i), {
      target: { value: "Preview text that should survive a refresh" },
    });

    unmount();

    const storageKey = "prompt-hash:create-draft:GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890";
    const persisted = window.localStorage.getItem(storageKey);

    expect(persisted).toContain("Draft title from session recovery");
    expect(persisted).toContain("Preview text that should survive a refresh");
  });

  it("encrypts and submits a valid listing with mocked Soroban boundaries", async () => {
    encryptPromptPlaintextMock.mockResolvedValue({
      encryptedPrompt: "encrypted-prompt",
      encryptionIv: "encryption-iv",
      contentHash: "b".repeat(64),
      keyBytes: new Uint8Array([1, 2, 3, 4]),
    });
    wrapPromptKeyMock.mockResolvedValue("wrapped-key");
    createPromptMock.mockResolvedValue({
      promptId: 17n,
      txHash: "tx-hash-123",
    });

    const signTransaction = vi.fn().mockResolvedValue({
      signedTxXdr: "signed-transaction-xdr",
    });

    renderWithProviders(<CreatePromptForm />, {
      wallet: {
        address: "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
        signTransaction,
      },
    });
    
    (validateListingForm as any).mockReturnValue({});

    fireEvent.change(
      screen.getByLabelText(/image url/i),
      { target: { value: "https://example.com/new-cover.png" } }
    );
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Campaign launch pack" } });
    await selectCategory("Marketing");
    fireEvent.change(
      screen.getByLabelText(/preview text/i),
      { target: { value: "Public preview for the integration test listing." } }
    );
    fireEvent.change(
      screen.getByLabelText(/full prompt/i),
      { target: { value: "Private prompt body that will be encrypted before submission." } }
    );

    const priceInput = screen.getByLabelText(/price in xlm/i);
    fireEvent.change(priceInput, { target: { value: "3.75" } });

    await userEvent.click(
      screen.getByRole("button", { name: /create prompt listing/i }),
    );

    await waitFor(() => {
      expect(encryptPromptPlaintextMock).toHaveBeenCalledWith(
        "Private prompt body that will be encrypted before submission.",
      );
    });

    expect(wrapPromptKeyMock).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3, 4]),
      "unlock-public-key",
    );
    expect(createPromptMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Prompt #17 created successfully.")).toBeInTheDocument();
  });

  it("does not warn on beforeunload when the form is empty", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderWithProviders(<CreatePromptForm />);

    const beforeunloadCalls = addSpy.mock.calls.filter(
      ([event]) => event === "beforeunload",
    );

    expect(beforeunloadCalls.length).toBe(0);
  });

  it("warns on beforeunload when the form has unsaved changes", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderWithProviders(<CreatePromptForm />);

    fireEvent.change(
      screen.getByLabelText(/title/i),
      { target: { value: "Unsaved title" } },
    );

    const beforeunloadCalls = addSpy.mock.calls.filter(
      ([event]) => event === "beforeunload",
    );

    expect(beforeunloadCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("clears the beforeunload warning after a successful submission", async () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");

    encryptPromptPlaintextMock.mockResolvedValue({
      encryptedPrompt: "encrypted-prompt",
      encryptionIv: "encryption-iv",
      contentHash: "b".repeat(64),
      keyBytes: new Uint8Array([1, 2, 3, 4]),
    });
    wrapPromptKeyMock.mockResolvedValue("wrapped-key");
    createPromptMock.mockResolvedValue({
      promptId: 1n,
      txHash: "tx-hash-123",
    });

    const signTransaction = vi.fn().mockResolvedValue({
      signedTxXdr: "signed-transaction-xdr",
    });

    renderWithProviders(<CreatePromptForm />, {
      wallet: {
        address: "GCREATORACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH1234567890",
        signTransaction,
      },
    });

    (validateListingForm as any).mockReturnValue({});

    fireEvent.change(
      screen.getByLabelText(/image url/i),
      { target: { value: "https://example.com/new-cover.png" } }
    );
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Campaign launch pack" } });
    await selectCategory("Marketing");
    fireEvent.change(
      screen.getByLabelText(/preview text/i),
      { target: { value: "Public preview for the integration test listing." } }
    );
    fireEvent.change(
      screen.getByLabelText(/full prompt/i),
      { target: { value: "Private prompt body that will be encrypted before submission." } }
    );
    fireEvent.change(
      screen.getByLabelText(/price in xlm/i),
      { target: { value: "1" } }
    );

    await userEvent.click(
      screen.getByRole("button", { name: /create prompt listing/i }),
    );

    await waitFor(() => {
      expect(createPromptMock).toHaveBeenCalledTimes(1);
    });

    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });
});

