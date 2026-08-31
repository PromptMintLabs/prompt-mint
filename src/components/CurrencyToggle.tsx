import { useCurrency } from "@/providers/CurrencyProvider";

const statusStyles = {
  connecting: "bg-amber-400",
  live: "bg-emerald-400",
  offline: "bg-slate-400",
  error: "bg-red-400",
} as const;

const statusLabels = {
  connecting: "Connecting",
  live: "Live",
  offline: "Offline",
  error: "Error",
} as const;

export function CurrencyToggle() {
  const {
    currency,
    setCurrency,
    isRateLoading,
    xlmUsdRate,
    priceConnectionStatus,
  } = useCurrency();

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex rounded-full border border-white/10 bg-white/5 p-1"
        aria-label="Display currency"
      >
        {(["XLM", "USD"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCurrency(option)}
            disabled={option === "USD" && isRateLoading && !xlmUsdRate}
            aria-pressed={currency === option}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${currency === option ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:text-white"}`}
          >
            {option}
          </button>
        ))}
      </div>

      <span
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-300"
        aria-live="polite"
      >
        <span
          className={`h-2 w-2 rounded-full ${statusStyles[priceConnectionStatus]}`}
          aria-label={`Price feed status: ${priceConnectionStatus}`}
        />
        {statusLabels[priceConnectionStatus]}
      </span>
    </div>
  );
}
