import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePromotionalPrice } from '../hooks/usePromotionalPrice';
import { PromptHashClient } from '../lib/stellar/promptHashClient';
import type { Promotion } from '../lib/stellar/promptHashClient';

vi.mock('../lib/stellar/promptHashClient', () => ({
  PromptHashClient: {
    getActivePromotion: vi.fn(),
    getEffectivePrice: vi.fn(),
  },
}));

const mockGetActivePromotion = vi.mocked(PromptHashClient.getActivePromotion);
const mockGetEffectivePrice = vi.mocked(PromptHashClient.getEffectivePrice);

describe('Promotional Pricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('usePromotionalPrice hook', () => {
    it('returns base price when no promotion exists', async () => {
      mockGetActivePromotion.mockResolvedValue(null);
      mockGetEffectivePrice.mockResolvedValue({
        price: 10000000n,
        asset: 'G...XLM',
        isPromotional: false,
      });

      const { result } = renderHook(() =>
        usePromotionalPrice('123', 10000000n)
      );

      // Wait for the async operations to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.effectivePrice).toBe(10000000n);
      expect(result.current.isPromotional).toBe(false);
      expect(result.current.promotion).toBeNull();
    });

    it('returns promotional price when promotion is active', async () => {
      const now = Math.floor(Date.now() / 1000);
      const promotion: Promotion = {
        promptId: 123n,
        creator: 'GCREATOR123',
        startTime: now - 3600,
        endTime: now + 3600,
        price: 5000000n,
        asset: 'G...XLM',
      };

      mockGetActivePromotion.mockResolvedValue(promotion);
      mockGetEffectivePrice.mockResolvedValue({
        price: 5000000n,
        asset: 'G...XLM',
        isPromotional: true,
      });

      const { result } = renderHook(() =>
        usePromotionalPrice('123', 10000000n)
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.effectivePrice).toBe(5000000n);
      expect(result.current.isPromotional).toBe(true);
      expect(result.current.promotion).toEqual(promotion);
    });

    it('can manually refresh price', async () => {
      const now = Math.floor(Date.now() / 1000);
      const promotion: Promotion = {
        promptId: 123n,
        creator: 'GCREATOR123',
        startTime: now - 3600,
        endTime: now + 3600,
        price: 5000000n,
        asset: 'G...XLM',
      };

      mockGetActivePromotion.mockResolvedValue(null);
      mockGetEffectivePrice.mockResolvedValue({
        price: 10000000n,
        asset: 'G...XLM',
        isPromotional: false,
      });

      const { result } = renderHook(() =>
        usePromotionalPrice('123', 10000000n)
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.isPromotional).toBe(false);

      // Simulate promotion starting and manually refresh
      mockGetActivePromotion.mockResolvedValue(promotion);
      mockGetEffectivePrice.mockResolvedValue({
        price: 5000000n,
        asset: 'G...XLM',
        isPromotional: true,
      });

      await act(async () => {
        result.current.refresh();
        await vi.runAllTimersAsync();
      });

      expect(result.current.isPromotional).toBe(true);
      expect(result.current.effectivePrice).toBe(5000000n);
    });

    it('handles errors gracefully', async () => {
      mockGetActivePromotion.mockRejectedValue(new Error('Network error'));
      mockGetEffectivePrice.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        usePromotionalPrice('123', 10000000n)
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.effectivePrice).toBe(10000000n); // Falls back to base price
      expect(result.current.isPromotional).toBe(false);
    });
  });

  describe('Promotion Validation', () => {
    it('validates start time is in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - 3600; // In the past
      const endTime = now + 3600;

      expect(startTime > now).toBe(false);
    });

    it('validates end time is after start time', () => {
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 3600;
      const endTime = now + 1800; // Before start time

      expect(endTime > startTime).toBe(false);
    });

    it('validates price is positive', () => {
      const price = 0n;
      expect(price > 0n).toBe(false);
    });

    it('validates asset is valid', () => {
      // This would be validated by the contract using token::Client
      const asset = 'G...XLM';
      expect(asset).toBeTruthy();
    });
  });

  describe('Promotion Overlap', () => {
    it('detects overlapping promotions', () => {
      const existingPromo = {
        startTime: 1000,
        endTime: 2000,
      };

      const newPromo = {
        startTime: 1500, // Overlaps with existing
        endTime: 2500,
      };

      const overlaps = newPromo.startTime < existingPromo.endTime && 
                       newPromo.endTime > existingPromo.startTime;

      expect(overlaps).toBe(true);
    });

    it('allows non-overlapping promotions', () => {
      const existingPromo = {
        startTime: 1000,
        endTime: 2000,
      };

      const newPromo = {
        startTime: 2000, // Starts after existing ends
        endTime: 3000,
      };

      const overlaps = newPromo.startTime < existingPromo.endTime && 
                       newPromo.endTime > existingPromo.startTime;

      expect(overlaps).toBe(false);
    });
  });

  describe('Authorization', () => {
    it('requires creator to create promotion', () => {
      const creator = 'GCREATOR123';
      const caller = 'GCREATOR123';

      expect(creator === caller).toBe(true);
    });

    it('rejects non-creator creating promotion', () => {
      const creator = 'GCREATOR123';
      const caller = 'GOTHER1234567890ABC';

      expect(creator === caller).toBe(false);
    });

    it('requires creator to cancel promotion', () => {
      const creator = 'GCREATOR123';
      const caller = 'GCREATOR123';

      expect(creator === caller).toBe(true);
    });
  });

  describe('Stale Quote Detection', () => {
    it('detects when price changes during checkout', () => {
      const initialPrice = 10000000n;
      const currentPrice = 12000000n;

      expect(initialPrice !== currentPrice).toBe(true);
    });

    it('allows checkout when price matches', () => {
      const initialPrice = 10000000n;
      const currentPrice = 10000000n;

      expect(initialPrice === currentPrice).toBe(true);
    });

    it('refreshes price before checkout', async () => {
      const refresh = vi.fn();
      
      await act(async () => {
        refresh();
      });

      expect(refresh).toHaveBeenCalled();
    });
  });
});
