const BASE_FEE_STROOPS = 100;

/**
 * Resource fee model for a Soroban purchase transaction.
 *
 * A bulk checkout submits every cart line in a single transaction, so the
 * fixed per-transaction overhead (envelope, auth, footprint setup) is paid
 * once and each additional item only adds its own storage/instruction cost.
 * A single-item purchase costs `OVERHEAD + PER_ITEM` = 1_500 stroops, which
 * matches `estimateSingleFee`.
 */
const RESOURCE_FEE_OVERHEAD_STROOPS = 1_000;
const RESOURCE_FEE_PER_ITEM_STROOPS = 500;

export interface FeeEstimate {
  baseFeeStroops: number;
  resourceFeeStroops: number;
  totalFeeStroops: number;
  totalFeeXlm: string;
}

export interface MultiItemPurchaseLine {
  promptId: string;
  priceStroops: bigint;
}

export interface MultiItemFeeOptions {
  /** Inclusion fee paid once per transaction. Defaults to the network minimum (100 stroops). */
  baseFeeStroops?: number;
  /** Fixed resource fee per transaction. */
  resourceFeeOverheadStroops?: number;
  /** Incremental resource fee per purchased item. */
  resourceFeePerItemStroops?: number;
}

export interface MultiItemPurchaseEstimate {
  itemCount: number;
  /** Sum of all item prices. */
  subtotalStroops: bigint;
  /** Network fee for the single bulk transaction. */
  networkFee: FeeEstimate;
  /** Subtotal plus the estimated network fee. */
  totalStroops: bigint;
  /** Network fee attributed to each item (rounded up). */
  perItemFeeStroops: number;
  /** Network fee if every item were bought in its own transaction. */
  individualFeeStroops: number;
  /** Fee saved by buying the items together instead of one by one. */
  savingsStroops: number;
}

function stroopsToXlm(stroops: number): string {
  return (stroops / 10_000_000).toFixed(7);
}

function buildFeeEstimate(
  itemCount: number,
  options: MultiItemFeeOptions = {},
): FeeEstimate {
  if (itemCount <= 0) {
    return {
      baseFeeStroops: 0,
      resourceFeeStroops: 0,
      totalFeeStroops: 0,
      totalFeeXlm: stroopsToXlm(0),
    };
  }

  const {
    baseFeeStroops = BASE_FEE_STROOPS,
    resourceFeeOverheadStroops = RESOURCE_FEE_OVERHEAD_STROOPS,
    resourceFeePerItemStroops = RESOURCE_FEE_PER_ITEM_STROOPS,
  } = options;

  const resourceFeeStroops =
    resourceFeeOverheadStroops + resourceFeePerItemStroops * itemCount;
  const totalFeeStroops = baseFeeStroops + resourceFeeStroops;
  return {
    baseFeeStroops,
    resourceFeeStroops,
    totalFeeStroops,
    totalFeeXlm: stroopsToXlm(totalFeeStroops),
  };
}

/**
 * Estimate fees for a single item purchase.
 *
 * In production this would call simulateContractCall from tx.ts and extract
 * minResourceFee from the simulation result. While the contract client is
 * mocked, we return an estimate based on typical Soroban resource fees.
 */
export async function estimateSingleFee(): Promise<FeeEstimate> {
  return buildFeeEstimate(1);
}

/**
 * Estimate fees for a bulk purchase of multiple items submitted as one
 * transaction.
 */
export async function estimateBulkFee(itemCount: number): Promise<FeeEstimate> {
  return buildFeeEstimate(itemCount);
}

/**
 * Estimate the full cost of a multi-item purchase: item subtotal, the network
 * fee for the single bulk transaction, and the grand total the buyer pays.
 *
 * Amounts stay in bigint stroops so large carts never lose precision.
 */
export function estimateMultiItemPurchase(
  items: readonly MultiItemPurchaseLine[],
  options: MultiItemFeeOptions = {},
): MultiItemPurchaseEstimate {
  const subtotalStroops = items.reduce((sum, item) => {
    if (item.priceStroops < 0n) {
      throw new RangeError(
        `Invalid price for prompt ${item.promptId}: price cannot be negative`,
      );
    }
    return sum + item.priceStroops;
  }, 0n);

  const itemCount = items.length;
  const networkFee = buildFeeEstimate(itemCount, options);
  const individualFeeStroops =
    buildFeeEstimate(1, options).totalFeeStroops * itemCount;

  return {
    itemCount,
    subtotalStroops,
    networkFee,
    totalStroops: subtotalStroops + BigInt(networkFee.totalFeeStroops),
    perItemFeeStroops:
      itemCount > 0 ? Math.ceil(networkFee.totalFeeStroops / itemCount) : 0,
    individualFeeStroops,
    savingsStroops: Math.max(
      0,
      individualFeeStroops - networkFee.totalFeeStroops,
    ),
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
