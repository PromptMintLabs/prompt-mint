import { useState, useEffect, useCallback } from 'react';
import { PromptHashClient } from '@/lib/stellar/promptHashClient';
import type { Promotion } from '@/lib/stellar/promptHashClient';

interface UsePromotionalPriceReturn {
  effectivePrice: bigint;
  isPromotional: boolean;
  promotion: Promotion | null;
  originalPrice: bigint;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Hook to get the effective price for a prompt, considering any active promotion.
 * Automatically refreshes when a promotion starts or expires.
 */
export function usePromotionalPrice(
  promptId: string | null,
  basePrice: bigint,
): UsePromotionalPriceReturn {
  const [effectivePrice, setEffectivePrice] = useState<bigint>(basePrice);
  const [isPromotional, setIsPromotional] = useState(false);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEffectivePrice = useCallback(async () => {
    if (!promptId) {
      setEffectivePrice(basePrice);
      setIsPromotional(false);
      setPromotion(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [promo, priceData] = await Promise.all([
        PromptHashClient.getActivePromotion(promptId),
        PromptHashClient.getEffectivePrice(promptId),
      ]);

      setPromotion(promo);
      setEffectivePrice(priceData.price > 0n ? priceData.price : basePrice);
      setIsPromotional(priceData.isPromotional);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price');
      setEffectivePrice(basePrice);
      setIsPromotional(false);
    } finally {
      setIsLoading(false);
    }
  }, [promptId, basePrice]);

  // Initial fetch
  useEffect(() => {
    fetchEffectivePrice();
  }, [fetchEffectivePrice]);

  // Set up auto-refresh based on promotion timing
  useEffect(() => {
    if (!promotion) return;

    const now = Date.now();
    const startTime = promotion.startTime * 1000;
    const endTime = promotion.endTime * 1000;

    let timeoutId: NodeJS.Timeout | null = null;

    if (now < startTime) {
      // Promotion hasn't started yet, refresh when it starts
      const delay = Math.min(startTime - now, 2147483647); // Max 24 days
      timeoutId = setTimeout(() => {
        fetchEffectivePrice();
      }, delay);
    } else if (now < endTime) {
      // Promotion is active, refresh when it ends
      const delay = Math.min(endTime - now, 2147483647);
      timeoutId = setTimeout(() => {
        fetchEffectivePrice();
      }, delay);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [promotion, fetchEffectivePrice]);

  return {
    effectivePrice,
    isPromotional,
    promotion,
    originalPrice: basePrice,
    isLoading,
    error,
    refresh: fetchEffectivePrice,
  };
}
