import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./useWallet";
import {
  detectMinimumBalance,
  horizonSnapshotFetcher,
  type MinimumBalanceAssessment,
  type SnapshotFetcher,
} from "@/lib/wallet/minimumBalance";

export type MinimumBalanceDetectionStatus =
  /** No wallet connected, or nothing to check. */
  | "idle"
  | "checking"
  /** Balance covers the minimum reserve. */
  | "ok"
  /** Balance is below the minimum reserve. */
  | "below-reserve"
  /** The account is not funded on this network yet. */
  | "unfunded"
  /** The lookup failed; the user is never warned based on a failed check. */
  | "error";

export interface UseMinimumBalanceOptions {
  /** Override the account lookup (mainly for tests). */
  fetcher?: SnapshotFetcher;
}

export interface UseMinimumBalanceResult {
  status: MinimumBalanceDetectionStatus;
  /** Balance and reserve figures; null until a check succeeds. */
  assessment: MinimumBalanceAssessment | null;
  /** Re-run the check, e.g. after the user funds their wallet. */
  recheck: () => void;
}

/**
 * Watches the connected account's native balance against the Stellar minimum
 * reserve, and re-checks when the tab regains focus while the account is below
 * it — the usual moment a user returns from their wallet after topping up.
 */
export function useMinimumBalance(
  options: UseMinimumBalanceOptions = {},
): UseMinimumBalanceResult {
  const { fetcher = horizonSnapshotFetcher } = options;
  const { address, status: walletStatus } = useWallet();
  const [status, setStatus] = useState<MinimumBalanceDetectionStatus>("idle");
  const [assessment, setAssessment] = useState<MinimumBalanceAssessment | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);

  // Keep the latest fetcher in a ref so an inline prop from the caller cannot
  // retrigger the effect on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const connected = walletStatus === "connected" && !!address;

  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!connected || !address) {
      setStatus("idle");
      setAssessment(null);
      return;
    }

    let cancelled = false;
    setStatus("checking");

    detectMinimumBalance(address, fetcherRef.current)
      .then((result) => {
        if (cancelled) return;
        setAssessment(result);
        setStatus(result.status);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Minimum balance check failed:", error);
        setAssessment(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [address, connected, nonce]);

  const needsAttention = status === "below-reserve" || status === "unfunded";
  useEffect(() => {
    if (!needsAttention) return;
    const onFocus = () => recheck();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [needsAttention, recheck]);

  return { status, assessment, recheck };
}
