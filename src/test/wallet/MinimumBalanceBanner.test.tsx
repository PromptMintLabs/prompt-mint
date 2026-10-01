import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypair } from "@stellar/stellar-sdk";
import { renderWithProviders } from "../render";
import { MinimumBalanceBanner } from "@/components/wallet/MinimumBalanceBanner";
import type { WalletContextType } from "@/providers/WalletProvider";
import type { MinimumBalanceSnapshot } from "@/lib/wallet/minimumBalance";

const ADDRESS = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7)).publicKey();
const XLM = 10_000_000n;

const connectedWallet = (
  overrides: Partial<WalletContextType> = {},
): Partial<WalletContextType> => ({
  address: ADDRESS,
  status: "connected",
  network: "TESTNET",
  ...overrides,
});

const account = (
  nativeBalanceStroops: bigint,
  minimumReserveStroops = XLM,
): Promise<MinimumBalanceSnapshot> =>
  Promise.resolve({
    nativeBalanceStroops,
    minimumReserveStroops,
    subentryCount: 0,
  });

describe("MinimumBalanceBanner", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("warns when the wallet is below the minimum reserve", async () => {
    const fetcher = vi.fn().mockResolvedValue(account(2_500_000n));

    renderWithProviders(<MinimumBalanceBanner fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    expect(
      await screen.findByTestId("minimum-balance-banner"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/wallet below the minimum reserve/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/0.25 XLM/)).toBeInTheDocument();
    expect(screen.getByText(/1.00 XLM/)).toBeInTheDocument();
    expect(screen.getByText(/0.75 XLM/)).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(ADDRESS);
  });

  it("renders nothing when the balance covers the reserve", async () => {
    const fetcher = vi.fn().mockResolvedValue(account(5n * XLM));

    renderWithProviders(<MinimumBalanceBanner fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(
      screen.queryByTestId("minimum-balance-banner"),
    ).not.toBeInTheDocument();
  });

  it("does not check before a wallet is connected", () => {
    const fetcher = vi.fn().mockResolvedValue(account(0n));

    renderWithProviders(<MinimumBalanceBanner fetcher={fetcher} />, {
      wallet: { address: undefined, status: "idle" },
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("minimum-balance-banner"),
    ).not.toBeInTheDocument();
  });

  it("explains that an unfunded account must be funded first", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not Found"), { response: { status: 404 } }),
      );

    renderWithProviders(<MinimumBalanceBanner fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    expect(
      await screen.findByTestId("minimum-balance-banner"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/isn't funded on this network/i),
    ).toBeInTheDocument();
  });

  it("stays silent when the lookup itself fails", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));

    renderWithProviders(<MinimumBalanceBanner fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(
      screen.queryByTestId("minimum-balance-banner"),
    ).not.toBeInTheDocument();
  });

  it("re-checks on demand and clears once the wallet is funded", async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(account(1_000_000n))
      .mockResolvedValueOnce(account(4n * XLM));

    renderWithProviders(<MinimumBalanceBanner fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await screen.findByTestId("minimum-balance-banner");
    await user.click(screen.getByRole("button", { name: /check again/i }));

    await waitFor(() =>
      expect(
        screen.queryByTestId("minimum-balance-banner"),
      ).not.toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("re-checks automatically when the tab regains focus", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(account(1_000_000n))
      .mockResolvedValueOnce(account(4n * XLM));

    renderWithProviders(<MinimumBalanceBanner fetcher={fetcher} />, {
      wallet: connectedWallet(),
    });

    await screen.findByTestId("minimum-balance-banner");
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId("minimum-balance-banner"),
      ).not.toBeInTheDocument(),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
