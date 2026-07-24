import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type DisplayCurrency = "XLM" | "USD";
type CurrencyContextValue = { currency: DisplayCurrency; setCurrency: (value: DisplayCurrency) => void; xlmUsdRate?: number; isRateLoading: boolean };
const RATE_CACHE_KEY = "prompt-hash:xlm-usd-rate";
const CURRENCY_KEY = "prompt-hash:display-currency";
const RATE_TTL_MS = 15 * 60 * 1000;
const PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
type CachedRate = { rate: number; cachedAt: number };
const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function readCachedRate(): CachedRate | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) ?? "null") as CachedRate | null;
    if (value && Number.isFinite(value.rate) && value.rate > 0) return value;
  } catch { /* Ignore unavailable browser storage. */ }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => localStorage.getItem(CURRENCY_KEY) === "USD" ? "USD" : "XLM");
  const cached = useMemo(readCachedRate, []);
  const [xlmUsdRate, setXlmUsdRate] = useState<number | undefined>(cached?.rate);
  const [isRateLoading, setIsRateLoading] = useState(false);

  useEffect(() => {
    if (currency !== "USD") return;
    if (cached && Date.now() - cached.cachedAt < RATE_TTL_MS) return;
    const controller = new AbortController();
    setIsRateLoading(true);
    void fetch(PRICE_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Price feed request failed");
        return response.json() as Promise<{ stellar?: { usd?: number } }>;
      })
      .then((data) => {
        const rate = data.stellar?.usd;
        if (!rate || !Number.isFinite(rate)) throw new Error("Price feed returned no rate");
        setXlmUsdRate(rate);
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, cachedAt: Date.now() }));
      })
      .catch(() => undefined)
      .finally(() => setIsRateLoading(false));
    return () => controller.abort();
  }, [cached, currency]);

  const setCurrency = useCallback((value: DisplayCurrency) => {
    setCurrencyState(value);
    localStorage.setItem(CURRENCY_KEY, value);
  }, []);
  return <CurrencyContext value={{ currency, setCurrency, xlmUsdRate, isRateLoading }}>{children}</CurrencyContext>;
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error("useCurrency must be used within CurrencyProvider");
  return value;
}

export const currencyCache = { RATE_CACHE_KEY, CURRENCY_KEY, RATE_TTL_MS };
