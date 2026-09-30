import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypair } from "@stellar/stellar-sdk";
import { renderWithProviders } from "../render";
import { TrustlineBanner } from "@/components/wallet/TrustlineBanner";
import type { WalletContextType } from "@/providers/WalletProvider";
import type { TrustlineAsset } from "@/lib/wallet/trustline";

const ISSUER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const ADDRESS = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();
const ASSETS: TrustlineAsset[] = [{ code: "USDC", issuer: ISSUER }];

const connectedWallet = (
  overrides: Partial<WalletContextType> = {},
): Partial<WalletContextType> => ({
  address: ADDRESS,
  status: "connected",
  network: "TESTNET",
  ...overrides,
});

const nativeOnly = { balances: [{ asset_type: "native" }] };
const withUsdc = {
  balances: [
    { asset_type: "native" },
    {
      asset_type: "credit_alphanum4",
      asset_code: "USDC",
      asset_issuer: ISSUER,
    },
  ],
};

describe("TrustlineBanner", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("auto-detects a missing trustline when the wallet is connected", async () => {
    const fetcher = vi.fn().mockResolvedValue(nativeOnly);

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    expect(await screen.findByTestId("trustline-banner")).toBeInTheDocument();
    expect(screen.getByText(/trustline needed/i)).toBeInTheDocument();
    expect(screen.getByText(/no trustline for USDC/i)).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(ADDRESS);
  });

  it("renders nothing when the trustline already exists", async () => {
    const fetcher = vi.fn().mockResolvedValue(withUsdc);

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(screen.queryByTestId("trustline-banner")).not.toBeInTheDocument();
  });

  it("does not check before a wallet is connected", () => {
    const fetcher = vi.fn().mockResolvedValue(nativeOnly);

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: { address: undefined, status: "idle" },
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByTestId("trustline-banner")).not.toBeInTheDocument();
  });

  it("does nothing when no trustline assets are configured", () => {
    const fetcher = vi.fn();

    renderWithProviders(<TrustlineBanner assets={[]} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByTestId("trustline-banner")).not.toBeInTheDocument();
  });

  it("explains that an unfunded account must be funded first", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not Found"), { response: { status: 404 } }),
      );

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    expect(
      await screen.findByText(/isn't funded on this network/i),
    ).toBeInTheDocument();
  });

  it("warns when the issuer has not authorized the trustline", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      balances: [
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: ISSUER,
          is_authorized: false,
        },
      ],
    });

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    expect(
      await screen.findByText(/has not authorized your trustline/i),
    ).toBeInTheDocument();
  });

  it("stays silent when the lookup itself fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(screen.queryByTestId("trustline-banner")).not.toBeInTheDocument();
  });

  it("re-checks on demand and clears once the trustline is added", async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(nativeOnly)
      .mockResolvedValueOnce(withUsdc);

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await screen.findByTestId("trustline-banner");
    await user.click(screen.getByRole("button", { name: /check again/i }));

    await waitFor(() =>
      expect(screen.queryByTestId("trustline-banner")).not.toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("re-checks automatically when the tab regains focus", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(nativeOnly)
      .mockResolvedValueOnce(withUsdc);

    renderWithProviders(<TrustlineBanner assets={ASSETS} fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await screen.findByTestId("trustline-banner");
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() =>
      expect(screen.queryByTestId("trustline-banner")).not.toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
