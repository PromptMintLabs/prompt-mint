import { useCurrency } from "@/providers/CurrencyProvider";

export function CurrencyToggle() {
  const { currency, setCurrency, isRateLoading, xlmUsdRate } = useCurrency();
  return (
    <div className="flex rounded-full border border-white/10 bg-white/5 p-1" aria-label="Display currency">
      {(["XLM", "USD"] as const).map((option) => (
        <button key={option} type="button" onClick={() => setCurrency(option)} disabled={option === "USD" && isRateLoading && !xlmUsdRate} aria-pressed={currency === option} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${currency === option ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:text-white"}`}>
          {option}
        </button>
      ))}
    </div>
  );
}
