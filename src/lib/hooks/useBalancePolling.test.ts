import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useBalancePolling } from '@/lib/hooks/useBalancePolling';
import { fetchCheckoutAccountSnapshot } from '@/lib/checkout/accountBalance';

type MockSnapshot = {
  nativeBalanceStroops: string;
  minimumReserveStroops: string;
  subentryCount: number;
};

vi.mock('@/lib/checkout/accountBalance', () => ({
  fetchCheckoutAccountSnapshot: vi.fn(),
}));

const createWrapper = (client: QueryClient) => ({
  children: <QueryClientProvider client={client}>{children}</QueryClientProvider>,
});

describe('useBalancePolling', () => {
  it('fetches balance and respects staleTime', async () => {
    const mockData: MockSnapshot = {
      nativeBalanceStroops: '1000000',
      minimumReserveStroops: '10000',
      subentryCount: 0,
    };
    // @ts-ignore
    (fetchCheckoutAccountSnapshot as any).mockResolvedValueOnce(mockData);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useBalancePolling('GAAAAAAAABCDEF', 5000),
      { wrapper: createWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    // Verify that a second call within staleTime does not trigger fetch again
    // Reset mock call count
    // @ts-ignore
    (fetchCheckoutAccountSnapshot as any).mockClear();
    queryClient.invalidateQueries({ queryKey: ['balance', 'GAAAAAAAABCDEF'] });
    // Because staleTime is 5s, invalidate should not refetch immediately; we wait a short time.
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchCheckoutAccountSnapshot).not.toHaveBeenCalled();
  });
});
