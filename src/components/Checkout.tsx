import { useState, useEffect, useCallback } from 'react';
import { useCart } from '@/providers/CartProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import {
  validateCheckout,
  type CheckoutSummary,
  type CheckoutItemValidation,
} from '@/lib/checkout/validation';
import { PromptHashClient } from '@/lib/stellar/promptHashClient';
import { browserStellarConfig } from '@/lib/stellar/browserConfig';
import { useNetworkState } from '@/hooks/useNetworkState';
import { detectNetworkMismatch } from '@/lib/wallet/networkDetection';
import { useWallet } from '@/hooks/useWallet';
import { useQueryClient } from '@tanstack/react-query';

const promptImageFallback = '/images/codeguru.png';

function formatPrice(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString('en-US', { maximumFractionDigits: 7 })} XLM`;
}

type CheckoutStep = 'review' | 'validating' | 'confirming' | 'processing' | 'complete' | 'error';

interface CheckoutItemResult {
  promptId: string;
  success: boolean;
  txHash?: string;
  error?: string;
}

interface CheckoutProps {
  onClose: () => void;
}

export function Checkout({ onClose }: CheckoutProps) {
  const { state, removeItem, clearCart, setCheckingOut, totalStroops, itemCount } = useCart();
  const { address, signTransaction } = useWallet();
  const queryClient = useQueryClient();
  const networkState = useNetworkState();

  const [step, setStep] = useState<CheckoutStep>('review');
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [results, setResults] = useState<CheckoutItemResult[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const validateItems = useCallback(async () => {
    if (!address) return;
    setStep('validating');
    setGlobalError(null);
    try {
      const validationSummary = await validateCheckout(state.items, address);
      setSummary(validationSummary);
      setStep('review');
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Validation failed');
      setStep('error');
    }
  }, [address, state.items]);

  useEffect(() => {
    if (address && state.items.length > 0 && step === 'review' && !summary) {
      validateItems();
    }
  }, [address, state.items.length, step, summary, validateItems]);

  const handleConfirm = async () => {
    if (!address || !signTransaction) {
      setGlobalError('Wallet not connected');
      setStep('error');
      return;
    }

    if (!summary?.allValid) {
      setGlobalError('Some items failed validation. Please remove invalid items.');
      setStep('error');
      return;
    }

    const walletNetworkState = detectNetworkMismatch(
      !!address,
      undefined,
      'connected'
    );
    if (walletNetworkState.type === 'wrong-network') {
      setGlobalError(walletNetworkState.message || 'Wrong network connected');
      setStep('error');
      return;
    }

    if (!networkState.canTrustConfirmation) {
      setGlobalError('Network connection lost or degraded. Please reconnect.');
      setStep('error');
      return;
    }

    setStep('confirming');
    setCheckingOut(true);

    try {
      setStep('processing');
      
      const items = state.items.map((item) => ({
        promptId: item.promptId,
        priceStroops: item.priceStroops,
      }));

      const bulkResult = await PromptHashClient.purchasePromptsBulk(
        items,
        address,
      );

      setResults(bulkResult.results);

      const allSuccess = bulkResult.results.every((r) => r.success);
      if (allSuccess) {
        clearCart();
        queryClient.invalidateQueries({ queryKey: ['purchased-prompts'] });
      }

      setStep('complete');
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Purchase failed');
      setStep('error');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleRetryValidation = () => {
    setSummary(null);
    validateItems();
  };

  const handleRemoveInvalidItems = () => {
    if (!summary) return;
    summary.validatedItems
      .filter((v) => !v.valid)
      .forEach((v) => removeItem(v.promptId));
    setSummary(null);
  };

  if (itemCount === 0 && step !== 'complete') {
    return (
      <div className="p-6 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-slate-500" />
        <h3 className="mt-4 text-lg font-semibold text-white">Cart is empty</h3>
        <p className="mt-2 text-sm text-slate-400">Add some listings to checkout.</p>
        <Button
          variant="outline"
          className="mt-4 border-white/15 bg-white/[0.03] text-white hover:bg-white/10"
          onClick={onClose}
        >
          Continue browsing
        </Button>
      </div>
    );
  }

  if (step === 'complete') {
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return (
      <div className="p-6 space-y-4">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h3 className="mt-4 text-lg font-semibold text-white">Checkout Complete</h3>
          <p className="mt-2 text-sm text-slate-400">
            {successCount} {successCount === 1 ? 'item' : 'items'} purchased successfully
            {failCount > 0 && `, ${failCount} failed`}
          </p>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((result) => {
            const item = state.items.find((i) => i.promptId === result.promptId) ||
              summary?.items.find((i) => i.promptId === result.promptId);
            return (
              <div
                key={result.promptId}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  result.success
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {item?.title || `Prompt #${result.promptId}`}
                  </p>
                  {result.txHash && (
                    <p className="text-xs text-slate-400 font-mono truncate">
                      {result.txHash}
                    </p>
                  )}
                  {result.error && (
                    <p className="text-xs text-red-400">{result.error}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          className="w-full h-11 bg-cyan-200 text-slate-950 hover:bg-cyan-100"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Checkout</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Validation status */}
      {step === 'validating' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
          <p className="text-sm text-cyan-300">Validating listings...</p>
        </div>
      )}

      {/* Global error */}
      {globalError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-300">{globalError}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs text-red-400 hover:text-red-300"
            onClick={() => {
              setGlobalError(null);
              setSummary(null);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Try again
          </Button>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {state.items.map((item) => {
          const validation = summary?.validatedItems.find(
            (v) => v.promptId === item.promptId
          );
          const isValid = validation?.valid ?? true;

          return (
            <div
              key={item.promptId}
              className={`flex gap-3 p-3 rounded-xl border transition-colors ${
                isValid
                  ? 'border-white/10 bg-[#0f1419]'
                  : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                <img
                  src={item.imageUrl || promptImageFallback}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-white truncate">{item.title}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                    onClick={() => removeItem(item.promptId)}
                    disabled={step !== 'review'}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className="border-white/10 bg-white/[0.04] text-slate-300 text-[10px]">
                    {item.category}
                  </Badge>
                  <span className="text-xs font-semibold text-white">
                    {formatPrice(item.priceStroops)}
                  </span>
                </div>
                {validation && !isValid && (
                  <div className="mt-2">
                    {validation.errors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-400">
                        {error.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invalid items notice */}
      {summary && !summary.allValid && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-amber-300">
                Some items failed validation and will be removed from checkout.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-amber-400 hover:text-amber-300"
                onClick={handleRemoveInvalidItems}
              >
                Remove invalid items
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Total ({itemCount} items)</span>
          <span className="text-xl font-bold text-white">{formatPrice(totalStroops)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          className="w-full h-11 bg-cyan-200 text-slate-950 hover:bg-cyan-100 disabled:opacity-50"
          onClick={handleConfirm}
          disabled={
            step === 'validating' ||
            step === 'confirming' ||
            step === 'processing' ||
            !summary?.allValid ||
            !address ||
            !networkState.canTrustConfirmation
          }
        >
          {step === 'confirming' || step === 'processing' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Confirm & Purchase
            </>
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full h-10 border-white/15 bg-white/[0.03] text-white hover:bg-white/10"
          onClick={onClose}
          disabled={step === 'confirming' || step === 'processing'}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
