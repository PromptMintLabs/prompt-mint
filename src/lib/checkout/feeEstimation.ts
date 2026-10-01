const BASE_FEE_STROOPS = 100;
export const DEFAULT_PLATFORM_FEE_BPS = 500;

export interface PurchaseFeeBreakdown {
  platformFeeStroops: bigint;
  creatorProceedsStroops: bigint;
}

export function calculatePurchaseFeeBreakdown(
  priceStroops: bigint,
  platformFeeBps = DEFAULT_PLATFORM_FEE_BPS,
): PurchaseFeeBreakdown {
  const platformFeeStroops = (priceStroops * BigInt(platformFeeBps)) / 10_000n;

  return {
    platformFeeStroops,
    creatorProceedsStroops: priceStroops - platformFeeStroops,
  };
}

export interface FeeEstimate {
  baseFeeStroops: number;
  resourceFeeStroops: number;
  totalFeeStroops: number;
  totalFeeXlm: string;
}

function stroopsToXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
}

/**
 * Estimate fees for a single item purchase.
 *
 * In production this would call simulateContractCall from tx.ts and extract
 * minResourceFee from the simulation result. While the contract client is
 * mocked, we return an estimate based on typical Soroban resource fees.
 */
export async function estimateSingleFee(): Promise<FeeEstimate> {
  const resourceFeeStroops = 1_500; // typical Soroban resource fee for a single purchase
  const totalFeeStroops = BASE_FEE_STROOPS + resourceFeeStroops;
  return {
    baseFeeStroops: BASE_FEE_STROOPS,
    resourceFeeStroops,
    totalFeeStroops,
    totalFeeXlm: stroopsToXlm(totalFeeStroops),
  };
}

/**
 * Estimate fees for a bulk purchase of multiple items.
 */
export async function estimateBulkFee(itemCount: number): Promise<FeeEstimate> {
  const resourceFeeStroops = 1_500 * itemCount;
  const totalFeeStroops = BASE_FEE_STROOPS * itemCount + resourceFeeStroops;
  return {
    baseFeeStroops: BASE_FEE_STROOPS * itemCount,
    resourceFeeStroops,
    totalFeeStroops,
    totalFeeXlm: stroopsToXlm(totalFeeStroops),
  };
}

/**
 * Format a fee estimate for display.
 */
export function formatFeeEstimate(fee: FeeEstimate): string {
  return `~${Number(fee.totalFeeXlm).toLocaleString(undefined, {
    maximumFractionDigits: 7,
  })} XLM`;
}
