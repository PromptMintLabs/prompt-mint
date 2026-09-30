import { useMemo } from "react";

export const TESTNET_FAUCET_URL = "https://friendbot.org.com";

export interface NavigationProps {
  /** Current Stellar network name (e.g. "TESTNET", "MAINNET"). */
  network?: string;
  /** Override the faucet link (useful for tests or alternate networks). */
  faucetUrl?: string;
}

/**
 * Returns the testnet faucet URL when the current network is testnet,
 * otherwise null. This keeps the link hidden on mainnet/local builds.
 */
export function getTestnetFaucetUrl(
  network?: string,
  override?: string,
): string | null {
  if (override) {
    return override;
  }

  if (!network) {
    return null;
  }

  const normalized = network.toUpperCase();
  if (normalized !== "TESTNET" && normalized !== "TEST") {
    return null;
  }

  return TESTNET_FAUCET_URL;
}

export default function Navigation({ children, network, faucetUrl }: NavigationProps & { children?: React.ReactNode }) {
  const faucetHref = useMemo(() => getTestnetFaucetUrl(network, faucetUrl), [network, faucetUrl]);

  return (
    <nav className="navigation" aria-label="Primary">
      {children}
      {faucetHref ? (
        <a className="navigation-faucet-link" href={faucetHref} target="_blank" rel="noopener noreferrer">
          Testnet Faucet
        </a>
      ) : null}
    </nav>
  );
}
