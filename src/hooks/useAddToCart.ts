import { useCallback } from 'react';
import { useCart, type CartItem } from '@/providers/CartProvider';
import { useQuery } from '@tanstack/react-query';
import { PromptHashClient } from '@/lib/stellar/promptHashClient';
import { browserStellarConfig } from '@/lib/stellar/browserConfig';

interface UseAddToCartReturn {
  addToCart: (promptId: string) => boolean;
  removeFromCart: (promptId: string) => void;
  isInCart: (promptId: string) => boolean;
  isLoading: boolean;
}

/**
 * Hook to add prompts to the cart with automatic data fetching
 */
export function useAddToCart(): UseAddToCartReturn {
  const { addItem, removeItem, hasItem } = useCart();

  const { data: prompts, isLoading } = useQuery({
    queryKey: ['marketplace-prompts-cache'],
    queryFn: () => PromptHashClient.getAllPrompts(browserStellarConfig),
    staleTime: 5 * 60 * 1000,
  });

  const addToCart = useCallback(
    (promptId: string): boolean => {
      if (hasItem(promptId)) {
        return false;
      }

      const prompt = prompts?.find((p) => p.id.toString() === promptId);
      if (!prompt) {
        return false;
      }

      const cartItem: CartItem = {
        promptId: prompt.id.toString(),
        title: prompt.title,
        priceStroops: prompt.priceStroops,
        imageUrl: prompt.imageUrl,
        category: prompt.category,
        creator: prompt.creator,
      };

      return addItem(cartItem);
    },
    [prompts, addItem, hasItem]
  );

  const removeFromCart = useCallback(
    (promptId: string) => {
      removeItem(promptId);
    },
    [removeItem]
  );

  const isInCart = useCallback(
    (promptId: string) => hasItem(promptId),
    [hasItem]
  );

  return {
    addToCart,
    removeFromCart,
    isInCart,
    isLoading,
  };
}
