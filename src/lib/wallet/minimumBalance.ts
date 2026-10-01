import { fetchCheckoutAccountSnapshot } from "@/lib/checkout/accountBalance";

/**
 * Minimum account balance warning (#699).
 *
 * Stellar requires every account to keep a minimum balance ("reserve") on the
 * network. Once the native XLM balance drops below that reserve the account can
 * no longer pay transaction fees, so *any* action — buying a prompt, adding a
 * trustline, removing a data entry — fails late with an opaque
 * `insufficient_balance` error and no useful context for the user.
 *
 * The reserve depends on how many ledger entries the account uses:
 *
 *   (2 + subentry_count + num_sponsoring - num_sponsored) × base_reserve
 *
 * so a wallet that was comfortably funded can silently fall below the reserve
 * (for example after adding trustlines or removing XLM). We check on wallet
 * connection and warn before the user attempts a transaction.
 *
 * The reserve math lives in `@/lib/checkout/xlmBalance` and the account lookup
 * in `@/lib/checkout/accountBalance`, so this warning and the checkout balance
 * guard can never disagree about the requirement.
 */

/** Account facts needed to compare a balance against its reserve. */
export interface MinimumBalanceSnapshot {
  nativeBalanceStroops: bigint;
  minimumReserveStroops: bigint;
  subentryCount?: number;
}

/** Loads the account snapshot for an address (injectable for tests). */
export type SnapshotFetcher = (
  address: string,
) => Promise<MinimumBalanceSnapshot>;

export type MinimumBalanceStatus =
  /** Native balance covers the minimum reserve. */
  | "ok"
  /** Native balance is below the minimum reserve. */
  | "below-reserve"
  /** The account does not exist on the network yet, so it must be funded. */
  | "unfunded";

export interface MinimumBalanceAssessment {
  status: MinimumBalanceStatus;
  nativeBalanceStroops: bigint;
  minimumReserveStroops: bigint;
  /** How much XLM must be added to reach the reserve (0 unless below). */
  shortfallStroops: bigint;
}

/**
 * Pure comparison of a native balance against its minimum reserve.
 * Strictly less-than: a balance exactly equal to the reserve is sufficient.
 */
export function evaluateMinimumBalance(params: {
  nativeBalanceStroops: bigint;
  minimumReserveStroops: bigint;
}): MinimumBalanceAssessment {
  const { nativeBalanceStroops, minimumReserveStroops } = params;
  const belowReserve = nativeBalanceStroops < minimumReserveStroops;
  return {
    status: belowReserve ? "below-reserve" : "ok",
    nativeBalanceStroops,
    minimumReserveStroops,
    shortfallStroops: belowReserve
      ? minimumReserveStroops - nativeBalanceStroops
      : 0n,
  };
}

/** Horizon returns 404 for accounts that have never been funded. */
function isAccountNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as {
    response?: { status?: number };
    status?: number;
    message?: string;
  };
  return (
    err.response?.status === 404 ||
    err.status === 404 ||
    /not found/i.test(err.message ?? "")
  );
}

/**
 * Loads the account and reports whether the native balance still covers the
 * Stellar minimum reserve. Throws on transport errors other than "account not
 * found" so callers can tell "we could not check" from "below reserve" — a
 * failed lookup must never be presented as a low balance.
 */
export async function detectMinimumBalance(
  address: string,
  fetcher: SnapshotFetcher,
): Promise<MinimumBalanceAssessment> {
  try {
    const snapshot = await fetcher(address);
    return evaluateMinimumBalance({
      nativeBalanceStroops: snapshot.nativeBalanceStroops,
      minimumReserveStroops: snapshot.minimumReserveStroops,
    });
  } catch (error) {
    if (!isAccountNotFound(error)) throw error;
    return {
      status: "unfunded",
      nativeBalanceStroops: 0n,
      // A fresh account still owes the 2-entry base reserve once it exists.
      minimumReserveStroops: 0n,
      shortfallStroops: 0n,
    };
  }
}

/**
 * Default fetcher: reads the native balance, subentry count and network base
 * reserve from Horizon (caching the base reserve) via the shared account loader.
 */
export const horizonSnapshotFetcher: SnapshotFetcher = async (address) => {
  const snapshot = await fetchCheckoutAccountSnapshot(address);
  return {
    nativeBalanceStroops: snapshot.nativeBalanceStroops,
    minimumReserveStroops: snapshot.minimumReserveStroops,
    subentryCount: snapshot.subentryCount,
  };
};
