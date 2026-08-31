import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type DisplayCurrency = "XLM" | "USD";
export type PriceConnectionStatus = "connecting" | "live" | "offline" | "error";
type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (value: DisplayCurrency) => void;
  xlmUsdRate?: number;
  isRateLoading: boolean;
  priceConnectionStatus: PriceConnectionStatus;
};
const RATE_CACHE_KEY = "prompt-hash:xlm-usd-rate";
const CURRENCY_KEY = "prompt-hash:display-currency";
const RATE_TTL_MS = 15 * 60 * 1000;
const PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
const PRICE_WS_URL = "wss://ws.coincap.io/prices?assets=stellar";
const PRICE_RECONNECT_MS = 5_000;
type CachedRate = { rate: number; cachedAt: number };
const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readCachedRate(): CachedRate | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const value = JSON.parse(
      localStorage.getItem(RATE_CACHE_KEY) ?? "null",
    ) as CachedRate | null;
    if (value && Number.isFinite(value.rate) && value.rate > 0) return value;
  } catch {
    /* Ignore unavailable browser storage. */
  }
}

async function fetchLatestXlmUsdRate(signal?: AbortSignal): Promise<number> {
  const response = await fetch(PRICE_URL, { signal });
  if (!response.ok) throw new Error("Price feed request failed");

  const data = (await response.json()) as { stellar?: { usd?: number } };
  const rate = data.stellar?.usd;
  if (!rate || !Number.isFinite(rate))
    throw new Error("Price feed returned no rate");

  return rate;
}

function saveRateToCache(rate: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    RATE_CACHE_KEY,
    JSON.stringify({ rate, cachedAt: Date.now() }),
  );
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
    if (typeof window === "undefined") return "XLM";
    return localStorage.getItem(CURRENCY_KEY) === "USD" ? "USD" : "XLM";
  });
  const cached = useMemo(readCachedRate, []);
  const [xlmUsdRate, setXlmUsdRate] = useState<number | undefined>(
    cached?.rate,
  );
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [priceConnectionStatus, setPriceConnectionStatus] =
    useState<PriceConnectionStatus>("connecting");

  const applyRate = useCallback((rate: number | undefined) => {
    if (!rate || !Number.isFinite(rate)) return;
    setXlmUsdRate(rate);
    saveRateToCache(rate);
  }, []);

  const performInitialFetch = useCallback(async () => {
    if (currency !== "USD") return;
    if (cached && Date.now() - cached.cachedAt < RATE_TTL_MS) return;

    setIsRateLoading(true);
    const controller = new AbortController();

    try {
      const rate = await fetchLatestXlmUsdRate(controller.signal);
      applyRate(rate);
      setPriceConnectionStatus("live");
    } catch {
      setPriceConnectionStatus((status) =>
        status === "live" ? status : "error",
      );
    } finally {
      setIsRateLoading(false);
    }

    return () => controller.abort();
  }, [applyRate, cached, currency]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const connectWebSocket = () => {
      if (cancelled || typeof WebSocket === "undefined") {
        setPriceConnectionStatus("offline");
        return;
      }

      socket = new WebSocket(PRICE_WS_URL);
      setPriceConnectionStatus("connecting");

      socket.onopen = () => {
        if (!cancelled) setPriceConnectionStatus("live");
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as Record<
            string,
            unknown
          >;
          const rawRate = payload.stellar ?? payload["stellar"];
          const rate = typeof rawRate === "number" ? rawRate : Number(rawRate);
          if (Number.isFinite(rate) && rate > 0) {
            if (!cancelled) {
              applyRate(rate);
              setPriceConnectionStatus("live");
            }
          }
        } catch {
          // Ignore malformed websocket payloads and keep the existing rate.
        }
      };

      socket.onerror = () => {
        if (!cancelled) setPriceConnectionStatus("error");
      };

      socket.onclose = () => {
        if (cancelled) return;
        setPriceConnectionStatus("offline");
        reconnectTimer = window.setTimeout(() => {
          if (!cancelled) connectWebSocket();
        }, PRICE_RECONNECT_MS);
      };
    };

    void performInitialFetch();
    connectWebSocket();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [applyRate, performInitialFetch]);

  const setCurrency = useCallback((value: DisplayCurrency) => {
    setCurrencyState(value);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CURRENCY_KEY, value);
      } catch {
        // Ignore storage failures.
      }
    }
  }, []);

  return (
    <CurrencyContext
      value={{
        currency,
        setCurrency,
        xlmUsdRate,
        isRateLoading,
        priceConnectionStatus,
      }}
    >
      {children}
    </CurrencyContext>
  );
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value)
    throw new Error("useCurrency must be used within CurrencyProvider");
  return value;
}

export const currencyCache = { RATE_CACHE_KEY, CURRENCY_KEY, RATE_TTL_MS };
