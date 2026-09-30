import { StrKey } from "@stellar/stellar-sdk";
import { trustlineAssetsRaw } from "@/lib/env";
import { fetchBalance } from "@/util/wallet";

/**
 * Trustline auto-detection.
 *
 * Native XLM never needs a trustline. Any other classic Stellar asset the
 * marketplace accepts (for example USDC) does: the buyer's account must hold a
 * trustline to the issuer before a payment in that asset can succeed. Without
 * one the transaction fails late with `op_no_trust`, so we check as soon as a
 * wallet connects and surface the gap before the buyer tries to pay.
 *
 * Assets to check are configured with `PUBLIC_STELLAR_TRUSTLINE_ASSETS`, a
 * comma-separated list of `CODE:ISSUER` pairs. Leaving it empty (the default)
 * disables the check.
 */

export interface TrustlineAsset {
  code: string;
  issuer: string;
}

export type TrustlineState =
  /** Trustline exists and the issuer has authorized it. */
  | "present"
  /** Account exists but has no trustline to this asset. */
  | "missing"
  /** Trustline exists but the issuer has not authorized it (auth-required assets). */
  | "unauthorized";

export interface TrustlineAssetResult {
  asset: TrustlineAsset;
  state: TrustlineState;
}

export type TrustlineCheckStatus =
  /** Nothing to check (no assets configured). */
  | "not-required"
  /** Every required trustline is present and authorized. */
  | "ok"
  /** At least one trustline is missing or unauthorized. */
  | "action-required"
  /** The account does not exist on the network yet, so it cannot hold trustlines. */
  | "unfunded";

export interface TrustlineCheckResult {
  status: TrustlineCheckStatus;
  results: TrustlineAssetResult[];
}

/** Minimal shape of a Horizon balance line that we rely on. */
export interface HorizonBalanceLine {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  is_authorized?: boolean;
}

export type BalanceFetcher = (
  // eslint-disable-next-line no-unused-vars
  address: string,
) => Promise<{ balances: HorizonBalanceLine[] } | HorizonBalanceLine[]>;

const ASSET_CODE_PATTERN = /^[A-Za-z0-9]{1,12}$/;

export const assetKey = (asset: TrustlineAsset): string =>
  `${asset.code}:${asset.issuer}`;

/**
 * Parses a `CODE:ISSUER,CODE:ISSUER` list. Malformed entries and the native
 * asset are skipped (with a console warning) so a config typo can never break
 * wallet connection; duplicates are collapsed.
 */
export function parseTrustlineAssets(
  raw: string | undefined,
): TrustlineAsset[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const assets: TrustlineAsset[] = [];

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const [code, issuer, ...rest] = trimmed
      .split(":")
      .map((part) => part.trim());
    const valid =
      rest.length === 0 &&
      !!code &&
      !!issuer &&
      ASSET_CODE_PATTERN.test(code) &&
      code.toUpperCase() !== "XLM" &&
      StrKey.isValidEd25519PublicKey(issuer);

    if (!valid) {
      console.warn(
        `Ignoring invalid trustline asset "${trimmed}" (expected CODE:ISSUER).`,
      );
      continue;
    }

    const asset = { code, issuer };
    const key = assetKey(asset);
    if (seen.has(key)) continue;
    seen.add(key);
    assets.push(asset);
  }

  return assets;
}

/** Assets configured for this deployment via `PUBLIC_STELLAR_TRUSTLINE_ASSETS`. */
export const configuredTrustlineAssets: TrustlineAsset[] =
  parseTrustlineAssets(trustlineAssetsRaw);

/**
 * Pure check of a Horizon balance list against the required assets.
 */
export function evaluateTrustlines(
  balances: HorizonBalanceLine[],
  required: TrustlineAsset[],
): TrustlineAssetResult[] {
  return required.map((asset) => {
    const line = balances.find(
      (b) =>
        b.asset_type !== "native" &&
        b.asset_type !== "liquidity_pool_shares" &&
        b.asset_code === asset.code &&
        b.asset_issuer === asset.issuer,
    );

    if (!line) return { asset, state: "missing" as const };
    // Horizon only reports `is_authorized` explicitly; treat absent as authorized.
    if (line.is_authorized === false)
      return { asset, state: "unauthorized" as const };
    return { asset, state: "present" as const };
  });
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
 * Looks up the account on Horizon and reports which required trustlines are
 * missing. Throws on transport errors other than "account not found" so callers
 * can distinguish "we could not check" from "the trustline is missing".
 */
export async function detectTrustlines(
  address: string,
  required: TrustlineAsset[] = configuredTrustlineAssets,
  fetcher: BalanceFetcher = fetchBalance as unknown as BalanceFetcher,
): Promise<TrustlineCheckResult> {
  if (required.length === 0) {
    return { status: "not-required", results: [] };
  }

  let balances: HorizonBalanceLine[];
  try {
    const response = await fetcher(address);
    balances = Array.isArray(response) ? response : (response.balances ?? []);
  } catch (error) {
    if (isAccountNotFound(error)) {
      return {
        status: "unfunded",
        results: required.map((asset) => ({
          asset,
          state: "missing" as const,
        })),
      };
    }
    throw error;
  }

  const results = evaluateTrustlines(balances, required);
  const allPresent = results.every((r) => r.state === "present");
  return { status: allPresent ? "ok" : "action-required", results };
}
