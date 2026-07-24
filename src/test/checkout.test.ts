import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateCheckoutItem,
  validateCheckout,
  prepareBulkPurchaseItems,
} from '../lib/checkout/validation';
import { PromptHashClient } from '../lib/stellar/promptHashClient';
import type { CartItem } from '../providers/CartProvider';

vi.mock('../lib/stellar/promptHashClient', () => ({
  PromptHashClient: {
    getPrompt: vi.fn(),
    checkAccess: vi.fn(),
  },
}));

const mockGetPrompt = vi.mocked(PromptHashClient.getPrompt);
const mockCheckAccess = vi.mocked(PromptHashClient.checkAccess);

const createCartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  promptId: '123',
  title: 'Test Prompt',
  priceStroops: 10000000n,
  imageUrl: '',
  category: 'AI',
  creator: 'GABC1234567890XYZ',
  ...overrides,
});

describe('Checkout Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateCheckoutItem', () => {
    it('validates a valid item', async () => {
      mockGetPrompt.mockResolvedValue({
        id: 123n,
        creator: 'GCREATOR123',
        priceStroops: 10000000n,
        title: 'Test Prompt',
        active: true,
      } as any);
      mockCheckAccess.mockResolvedValue(false);

      const result = await validateCheckoutItem(
        createCartItem(),
        'GBUYER123'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects inactive listing', async () => {
      mockGetPrompt.mockResolvedValue({
        id: 123n,
        creator: 'GCREATOR123',
        priceStroops: 10000000n,
        title: 'Test Prompt',
        active: false,
      } as any);
      mockCheckAccess.mockResolvedValue(false);

      const result = await validateCheckoutItem(
        createCartItem(),
        'GBUYER123'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'active' })
      );
    });

    it('detects creator attempting to buy own listing', async () => {
      const creator = 'GCREATOR123';
      mockGetPrompt.mockResolvedValue({
        id: 123n,
        creator,
        priceStroops: 10000000n,
        title: 'Test Prompt',
        active: true,
      } as any);
      mockCheckAccess.mockResolvedValue(false);

      const result = await validateCheckoutItem(
        createCartItem({ creator }),
        creator
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'creator' })
      );
    });

    it('detects already purchased listing', async () => {
      mockGetPrompt.mockResolvedValue({
        id: 123n,
        creator: 'GCREATOR123',
        priceStroops: 10000000n,
        title: 'Test Prompt',
        active: true,
      } as any);
      mockCheckAccess.mockResolvedValue(true);

      const result = await validateCheckoutItem(
        createCartItem(),
        'GBUYER123'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'ownership' })
      );
    });

    it('detects price change', async () => {
      mockGetPrompt.mockResolvedValue({
        id: 123n,
        creator: 'GCREATOR123',
        priceStroops: 15000000n,
        title: 'Test Prompt',
        active: true,
      } as any);
      mockCheckAccess.mockResolvedValue(false);

      const result = await validateCheckoutItem(
        createCartItem({ priceStroops: 10000000n }),
        'GBUYER123'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'price' })
      );
    });

    it('handles fetch failure gracefully', async () => {
      mockGetPrompt.mockRejectedValue(new Error('Network error'));

      const result = await validateCheckoutItem(
        createCartItem(),
        'GBUYER123'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'fetch' })
      );
    });
  });

  describe('validateCheckout', () => {
    it('validates multiple items', async () => {
      mockGetPrompt.mockResolvedValue({
        id: 123n,
        creator: 'GCREATOR123',
        priceStroops: 10000000n,
        title: 'Test Prompt',
        active: true,
      } as any);
      mockCheckAccess.mockResolvedValue(false);

      const items = [
        createCartItem({ promptId: '1' }),
        createCartItem({ promptId: '2' }),
      ];

      const summary = await validateCheckout(items, 'GBUYER123');

      expect(summary.allValid).toBe(true);
      expect(summary.validatedItems).toHaveLength(2);
    });

    it('detects invalid items in batch', async () => {
      mockGetPrompt
        .mockResolvedValueOnce({
          id: 1n,
          creator: 'GCREATOR123',
          priceStroops: 10000000n,
          title: 'Prompt 1',
          active: true,
        } as any)
        .mockResolvedValueOnce({
          id: 2n,
          creator: 'GCREATOR123',
          priceStroops: 10000000n,
          title: 'Prompt 2',
          active: false,
        } as any);
      mockCheckAccess.mockResolvedValue(false);

      const items = [
        createCartItem({ promptId: '1' }),
        createCartItem({ promptId: '2' }),
      ];

      const summary = await validateCheckout(items, 'GBUYER123');

      expect(summary.allValid).toBe(false);
      expect(summary.validatedItems[0].valid).toBe(true);
      expect(summary.validatedItems[1].valid).toBe(false);
    });

    it('identifies price changes', async () => {
      mockGetPrompt
        .mockResolvedValueOnce({
          id: 1n,
          creator: 'GCREATOR123',
          priceStroops: 10000000n,
          title: 'Prompt 1',
          active: true,
        } as any)
        .mockResolvedValueOnce({
          id: 2n,
          creator: 'GCREATOR123',
          priceStroops: 20000000n,
          title: 'Prompt 2',
          active: true,
        } as any);
      mockCheckAccess.mockResolvedValue(false);

      const items = [
        createCartItem({ promptId: '1', priceStroops: 10000000n }),
        createCartItem({ promptId: '2', priceStroops: 15000000n }),
      ];

      const summary = await validateCheckout(items, 'GBUYER123');

      expect(summary.priceChanges).toHaveLength(1);
      expect(summary.priceChanges[0].promptId).toBe('2');
    });
  });

  describe('prepareBulkPurchaseItems', () => {
    it('prepares items for bulk purchase', () => {
      const items = [
        createCartItem({ promptId: '1', priceStroops: 10000000n }),
        createCartItem({ promptId: '2', priceStroops: 20000000n }),
      ];

      const result = prepareBulkPurchaseItems(items);

      expect(result).toEqual([
        { promptId: '1', priceStroops: 10000000n },
        { promptId: '2', priceStroops: 20000000n },
      ]);
    });
  });
});
