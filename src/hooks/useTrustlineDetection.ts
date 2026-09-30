import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./useWallet";
import {
  configuredTrustlineAssets,
  detectTrustlines,
  type BalanceFetcher,
  type TrustlineAsset,
  type TrustlineAssetResult,
} from "@/lib/wallet/trustline";

export type TrustlineDetectionStatus =
  | "idle" // no wallet connected, or nothing to check
  | "checking"
  | "ok"
  | "action-required"
  | "unfunded"
  | "error";

export interface UseTrustlineDetectionOptions {
  /** Override the configured asset list (mainly for tests). */
  assets?: TrustlineAsset[];
  /** Override the balance lookup (mainly for tests). */
  fetcher?: BalanceFetcher;
}

export interface UseTrustlineDetectionResult {
  status: TrustlineDetectionStatus;
  /** Trustlines that are missing or unauthorized. */
  issues: TrustlineAssetResult[];
  /** Re-run the check, e.g. after the buyer adds a trustline in their wallet. */
  recheck: () => void;
}

/**
 * Detects missing trustlines automatically whenever a wallet connects (or the
 * connected account changes), and again when the tab regains focus while an
 * issue is outstanding — the usual moment a buyer returns from their wallet
 * after adding the trustline.
 */
export function useTrustlineDetection(
  options: UseTrustlineDetectionOptions = {},
): UseTrustlineDetectionResult {
  const { assets = configuredTrustlineAssets, fetcher } = options;
  const { address, status: walletStatus } = useWallet();
  const [status, setStatus] = useState<TrustlineDetectionStatus>("idle");
  const [issues, setIssues] = useState<TrustlineAssetResult[]>([]);
  const [nonce, setNonce] = useState(0);

  // Keep the latest inputs in refs so an inline `assets` array or `fetcher`
  // from the caller cannot retrigger the effect on every render.
  const assetsRef = useRef(assets);
  const fetcherRef = useRef(fetcher);
  assetsRef.current = assets;
  fetcherRef.current = fetcher;

  const hasAssets = assets.length > 0;
  const connected = walletStatus === "connected" && !!address;

  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!hasAssets || !connected || !address) {
      setStatus("idle");
      setIssues([]);
      return;
    }

    let cancelled = false;
    setStatus("checking");

    detectTrustlines(address, assetsRef.current, fetcherRef.current)
      .then((result) => {
        if (cancelled) return;
        const problems = result.results.filter((r) => r.state !== "present");
        setIssues(problems);
        setStatus(result.status === "not-required" ? "idle" : result.status);
      })
      .catch((error) => {
        if (cancelled) return;
        // A failed lookup must never block the user; it is not a missing trustline.
        console.warn("Trustline check failed:", error);
        setIssues([]);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [address, connected, hasAssets, nonce]);

  const needsAttention = status === "action-required" || status === "unfunded";
  useEffect(() => {
    if (!needsAttention) return;
    const onFocus = () => recheck();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [needsAttention, recheck]);

  return { status, issues, recheck };
}
