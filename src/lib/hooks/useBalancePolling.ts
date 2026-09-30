import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { fetchCheckoutAccountSnapshot, CheckoutAccountSnapshot } from '@/lib/checkout/accountBalance';

/**
 * Hook to poll the native XLM balance for a given Stellar address.
 * Uses React Query with a configurable staleTime to avoid unnecessary refetches.
 *
 * @param address Stellar account address (public key).
 * @param staleTimeMs How long the fetched data is considered fresh (in milliseconds).
 *                    Defaults to 30 seconds.
 * @returns React Query result containing the balance snapshot.
 */
export function useBalancePolling(
  address: string,
  staleTimeMs: number = 30_000,
): UseQueryResult<CheckoutAccountSnapshot, Error> {
  return useQuery<CheckoutAccountSnapshot, Error>({
    queryKey: ['balance', address],
    queryFn: () => fetchCheckoutAccountSnapshot(address),
    staleTime: staleTimeMs,
    // Keep the data in cache while the component is unmounted to preserve balance.
    cacheTime: 5 * 60_000,
    // Refetch on window focus can be useful for a wallet UI, but can be disabled by callers.
    refetchOnWindowFocus: false,
    enabled: !!address,
  });
}
