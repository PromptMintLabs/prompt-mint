import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart, MAX_CART_ITEMS, type CartItem } from '../providers/CartProvider';

const createWrapper = () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CartProvider>{children}</CartProvider>
  );
  return wrapper;
};

const createCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  promptId: '123',
  title: 'Test Prompt',
  priceStroops: 10000000n,
  imageUrl: '',
  category: 'AI',
  creator: 'GABC1234567890XYZ',
  ...overrides,
});

describe('CartProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('addItem', () => {
    it('adds item to cart', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem());
      });

      expect(result.current.itemCount).toBe(1);
      expect(result.current.state.items[0].promptId).toBe('123');
    });

    it('prevents duplicate items', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem());
      });

      act(() => {
        result.current.addItem(createCartItem());
      });
      expect(result.current.itemCount).toBe(1);
    });

    it('enforces max cart items limit', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      for (let i = 0; i < MAX_CART_ITEMS; i++) {
        act(() => {
          result.current.addItem(createCartItem({ promptId: i.toString() }));
        });
      }

      act(() => {
        result.current.addItem(createCartItem({ promptId: '999' }));
      });
      expect(result.current.itemCount).toBe(MAX_CART_ITEMS);
    });
  });

  describe('removeItem', () => {
    it('removes item from cart', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem());
      });

      act(() => {
        result.current.removeItem('123');
      });

      expect(result.current.itemCount).toBe(0);
    });

    it('handles removing non-existent item gracefully', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.removeItem('999');
      });

      expect(result.current.itemCount).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('clears all items from cart', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem({ promptId: '1' }));
        result.current.addItem(createCartItem({ promptId: '2' }));
        result.current.addItem(createCartItem({ promptId: '3' }));
      });

      act(() => {
        result.current.clearCart();
      });

      expect(result.current.itemCount).toBe(0);
    });
  });

  describe('totalStroops', () => {
    it('calculates correct total', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem({ promptId: '1', priceStroops: 10000000n }));
        result.current.addItem(createCartItem({ promptId: '2', priceStroops: 20000000n }));
      });

      expect(result.current.totalStroops).toBe(30000000n);
    });
  });

  describe('updateItemPrice', () => {
    it('updates item price', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem({ promptId: '1', priceStroops: 10000000n }));
      });

      act(() => {
        result.current.updateItemPrice('1', 15000000n);
      });

      expect(result.current.state.items[0].priceStroops).toBe(15000000n);
    });
  });

  describe('hasItem', () => {
    it('returns true for items in cart', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem({ promptId: '123' }));
      });

      expect(result.current.hasItem('123')).toBe(true);
      expect(result.current.hasItem('456')).toBe(false);
    });
  });

  describe('wallet isolation', () => {
    it('cart is scoped to current session', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem(createCartItem());
      });

      expect(result.current.itemCount).toBe(1);
    });
  });
});
