import {
  StellarWalletsKit,
  Networks,
  type ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { HotWalletModule } from "@creit.tech/stellar-wallets-kit/modules/hotwallet";
import { Horizon } from "@stellar/stellar-sdk";
import { horizonUrl, stellarNetwork, stellarWalletNetwork } from "../lib/env";

// Initialise the kit with the supported wallet modules.
StellarWalletsKit.init({
  network: stellarWalletNetwork as Networks,
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new xBullModule(),
    new LobstrModule(),
    new HotWalletModule(),
  ],
});

function getHorizonHost(mode: string) {
  switch (mode) {
    case "LOCAL":
    case "FUTURENET":
    case "TESTNET":
    case "PUBLIC":
      return horizonUrl;
    default:
      throw new Error(`Unknown Stellar network: ${mode}`);
  }
}

export const fetchBalance = async (address: string) => {
  const horizon = new Horizon.Server(getHorizonHost(stellarNetwork), {
    allowHttp: stellarNetwork === "LOCAL",
  });

  try {
    const { balances } = await horizon.accounts().accountId(address).call();
    return { ok: true, balances };
  } catch (e) {
    console.error("Error fetching balance:", e);
    throw e;
  }
};

export type Balance = Awaited<ReturnType<typeof fetchBalance>>["balances"][number];

export const wallet = StellarWalletsKit;

// Restore removed connectWallet export for backward compatibility
export const connectWallet = async (...args: any[]) => {
  return (StellarWalletsKit as any).openModal(...args);
};

/**
 * Reports which wallets the kit can actually detect in the current browser
 * (extension installed, in-app browser wrapper, etc.). Used to avoid opening
 * the connection modal for wallets that aren't usable.
 */
export const getSupportedWallets = (): Promise<ISupportedWallet[]> => {
  return StellarWalletsKit.refreshSupportedWallets();
};
