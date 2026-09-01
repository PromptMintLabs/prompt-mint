import type { CartItem } from '@/providers/CartProvider';
import type { BulkPurchaseItem, PromptHashConfig } from '@/lib/stellar/promptHashClient';
import { PromptHashClient } from '@/lib/stellar/promptHashClient';
import {
  fetchCheckoutAccountSnapshot,
  type CheckoutAccountSnapshot,
} from '@/lib/checkout/accountBalance';
import {
  assessCheckoutXlmSufficiency,
  type CheckoutBalanceAssessment,
} from '@/lib/checkout/xlmBalance';
import {
  classifyContractError,
  formatContractErrorMessage,
} from '@/lib/stellar/promptHashClient';

export interface CheckoutValidationError {
  promptId: string;
  field: string;
  message: string;
}

export interface CheckoutItemValidation {
  promptId: string;
  valid: boolean;
  errors: CheckoutValidationError[];
}

export interface CheckoutSummary {
  items: CartItem[];
  validatedItems: CheckoutItemValidation[];
  totalStroops: bigint;
  allValid: boolean;
  priceChanges: { promptId: string; oldPrice: bigint; newPrice: bigint }[];
  balanceCheck: CheckoutBalanceAssessment | null;
  balanceErrors: CheckoutValidationError[];
}

export interface ValidateCheckoutOptions {
  fetchAccount?: (address: string) => Promise<CheckoutAccountSnapshot>;
}

/**
 * Validates a single cart item against current on-chain state.
 */
export async function validateCheckoutItem(
  cartItem: CartItem,
  buyerAddress: string,
): Promise<CheckoutItemValidation> {
  const errors: CheckoutValidationError[] = [];

  try {
    const prompt = await PromptHashClient.getPrompt(
      { rpcUrl: '', networkPassphrase: '', promptHashContractId: '', nativeAssetContractId: '' } as PromptHashConfig,
      BigInt(cartItem.promptId),
    );

    // Check if prompt is active
    if (!prompt.active) {
      errors.push({
        promptId: cartItem.promptId,
        field: 'active',
        message: 'This listing is no longer active',
      });
    }

    // Check if buyer is the creator
    if (prompt.creator === buyerAddress) {
      errors.push({
        promptId: cartItem.promptId,
        field: 'creator',
        message: 'You cannot purchase your own listing',
      });
    }

    // Check if already purchased
    const hasAccess = await PromptHashClient.checkAccess(
      { rpcUrl: '', networkPassphrase: '', promptHashContractId: '', nativeAssetContractId: '' } as PromptHashConfig,
      buyerAddress,
      cartItem.promptId,
    );
    if (hasAccess) {
      errors.push({
        promptId: cartItem.promptId,
        field: 'ownership',
        message: 'You already own this listing',
      });
    }

    // Check price match
    if (prompt.priceStroops !== cartItem.priceStroops) {
      errors.push({
        promptId: cartItem.promptId,
        field: 'price',
        message: `Price has changed from ${formatPrice(cartItem.priceStroops)} to ${formatPrice(prompt.priceStroops)}`,
      });
    }
  } catch (error) {
    const contractError = classifyContractError(error);
    errors.push({
      promptId: cartItem.promptId,
      field: 'fetch',
      message: formatContractErrorMessage(contractError),
    });
  }

  return {
    promptId: cartItem.promptId,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates all items in the cart before checkout.
 */
export async function validateCheckout(
  cartItems: CartItem[],
  buyerAddress: string,
  options?: ValidateCheckoutOptions,
): Promise<CheckoutSummary> {
  const validatedItems = await Promise.all(
    cartItems.map((item) => validateCheckoutItem(item, buyerAddress)),
  );

  const priceChanges = cartItems
    .map((item) => {
      const validation = validatedItems.find((v) => v.promptId === item.promptId);
      const priceError = validation?.errors.find((e) => e.field === 'price');
      if (priceError) {
        const newPriceMatch = priceError.message.match(/to (.+)$/);
        return {
          promptId: item.promptId,
          oldPrice: item.priceStroops,
          newPrice: newPriceMatch ? parsePrice(newPriceMatch[1]) : item.priceStroops,
        };
      }
      return null;
    })
    .filter((p): p is { promptId: string; oldPrice: bigint; newPrice: bigint } => p !== null);

  const itemsValid = validatedItems.every((v) => v.valid);
  const totalStroops = cartItems
    .filter((item) => {
      const validation = validatedItems.find((v) => v.promptId === item.promptId);
      return validation?.valid ?? false;
    })
    .reduce((sum, item) => sum + item.priceStroops, 0n);

  const balanceErrors: CheckoutValidationError[] = [];
  let balanceCheck: CheckoutBalanceAssessment | null = null;

  const loadAccount = options?.fetchAccount ?? fetchCheckoutAccountSnapshot;

  try {
    const account = await loadAccount(buyerAddress);
    balanceCheck = assessCheckoutXlmSufficiency({
      nativeBalanceStroops: account.nativeBalanceStroops,
      minimumReserveStroops: account.minimumReserveStroops,
      purchaseTotalStroops: totalStroops,
    });

    if (!balanceCheck.sufficient && balanceCheck.message) {
      balanceErrors.push({
        promptId: '*',
        field: 'balance',
        message: balanceCheck.message,
      });
    }
  } catch {
    balanceErrors.push({
      promptId: '*',
      field: 'balance',
      message:
        'Unable to verify your XLM balance. Ensure your wallet is funded and try again.',
    });
  }

  const allValid = itemsValid && balanceErrors.length === 0;

  return {
    items: cartItems,
    validatedItems,
    totalStroops,
    allValid,
    priceChanges,
    balanceCheck,
    balanceErrors,
  };
}

/**
 * Prepares items for bulk purchase call.
 */
export function prepareBulkPurchaseItems(cartItems: CartItem[]): { promptId: string; priceStroops: bigint }[] {
  return cartItems.map((item) => ({
    promptId: item.promptId,
    priceStroops: item.priceStroops,
  }));
}

function formatPrice(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString('en-US', { maximumFractionDigits: 7 })} XLM`;
}

function parsePrice(priceStr: string): bigint {
  const match = priceStr.match(/([\d,.]+)\s*XLM/);
  if (!match) return 0n;
  const xlm = parseFloat(match[1].replace(/,/g, ''));
  return BigInt(Math.round(xlm * 10_000_000));
}
