/** Stellar base reserve (0.5 XLM) when Horizon base_reserve is unavailable. */
export const DEFAULT_BASE_RESERVE_STROOPS = 5_000_000n;

/** Conservative fee buffer for a Soroban bulk purchase (0.01 XLM). */
export const CHECKOUT_FEE_BUFFER_STROOPS = 100_000n;

const STROOPS_PER_XLM = 10_000_000n;

export interface CheckoutBalanceAssessment {
  sufficient: boolean;
  nativeBalanceStroops: bigint;
  minimumReserveStroops: bigint;
  purchaseTotalStroops: bigint;
  feeBufferStroops: bigint;
  /** Minimum native balance required (purchase + fee + reserve). */
  requiredStroops: bigint;
  /** Spendable above reserve, before purchase and fee. */
  availableStroops: bigint;
  message?: string;
}

/**
 * Parses a Horizon native XLM balance string into stroops without float rounding.
 */
export function parseHorizonNativeBalanceToStroops(balance: string): bigint {
  const trimmed = balance.trim();
  if (!trimmed || trimmed === "0") {
    return 0n;
  }

  const negative = trimmed.startsWith("-");
  const normalized = negative ? trimmed.slice(1) : trimmed;
  const [wholePart = "0", fractionalPart = ""] = normalized.split(".");
  const whole = BigInt(wholePart || "0");
  const fracDigits = (fractionalPart + "0000000").slice(0, 7);
  const fractional = BigInt(fracDigits);

  const stroops = whole * STROOPS_PER_XLM + fractional;
  return negative ? -stroops : stroops;
}

/**
 * Minimum balance an account must hold per Stellar protocol rules.
 * @see https://developers.stellar.org/docs/learn/fundamentals/lumens#minimum-balance
 */
export function computeMinimumReserveStroops(
  subentryCount: number,
  numSponsoring: number,
  numSponsored: number,
  baseReserveStroops: bigint = DEFAULT_BASE_RESERVE_STROOPS,
): bigint {
  for (const [name, count] of Object.entries({ subentryCount, numSponsoring, numSponsored })) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`${name} must be a non-negative safe integer`);
    }
  }

  if (baseReserveStroops < 0n) {
    throw new RangeError("baseReserveStroops must be non-negative");
  }

  const ledgerEntries =
    2n + BigInt(subentryCount) + BigInt(numSponsoring) - BigInt(numSponsored);
  const reservedEntries = ledgerEntries > 0n ? ledgerEntries : 0n;
  return reservedEntries * baseReserveStroops;
}

export function assessCheckoutXlmSufficiency(params: {
  nativeBalanceStroops: bigint;
  minimumReserveStroops: bigint;
  purchaseTotalStroops: bigint;
  feeBufferStroops?: bigint;
}): CheckoutBalanceAssessment {
  const feeBufferStroops = params.feeBufferStroops ?? CHECKOUT_FEE_BUFFER_STROOPS;
  const requiredStroops =
    params.purchaseTotalStroops + feeBufferStroops + params.minimumReserveStroops;

  const availableStroops =
    params.nativeBalanceStroops > params.minimumReserveStroops
      ? params.nativeBalanceStroops - params.minimumReserveStroops
      : 0n;

  if (params.purchaseTotalStroops <= 0n) {
    return {
      sufficient: params.nativeBalanceStroops >= params.minimumReserveStroops,
      nativeBalanceStroops: params.nativeBalanceStroops,
      minimumReserveStroops: params.minimumReserveStroops,
      purchaseTotalStroops: params.purchaseTotalStroops,
      feeBufferStroops,
      requiredStroops: params.minimumReserveStroops,
      availableStroops,
      message:
        params.nativeBalanceStroops >= params.minimumReserveStroops
          ? undefined
          : "Your account does not meet the Stellar minimum XLM reserve. Add funds before checkout.",
    };
  }

  const sufficient = params.nativeBalanceStroops >= requiredStroops;
  let message: string | undefined;
  if (!sufficient) {
    if (params.nativeBalanceStroops < params.minimumReserveStroops) {
      message =
        "Your XLM balance is below the Stellar account reserve. Add XLM to your wallet before purchasing.";
    } else {
      message =
        "Insufficient XLM for this checkout. You need enough XLM to cover the cart total, network fees, and the minimum account reserve.";
    }
  }

  return {
    sufficient,
    nativeBalanceStroops: params.nativeBalanceStroops,
    minimumReserveStroops: params.minimumReserveStroops,
    purchaseTotalStroops: params.purchaseTotalStroops,
    feeBufferStroops,
    requiredStroops,
    availableStroops,
    message,
  };
}

export function formatStroopsAsXlmLabel(stroops: bigint): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const frac = abs % STROOPS_PER_XLM;
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  const xlm = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return `${negative ? "-" : ""}${xlm} XLM`;
}
