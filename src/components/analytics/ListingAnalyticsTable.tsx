import { Eye, KeyRound, Target } from "lucide-react";
import type { ListingAnalyticsRow } from "@/lib/analytics/listingMetrics";
import { formatRate } from "@/lib/analytics/listingMetrics";
import { Skeleton } from "@/components/Skeleton";

export interface ListingAnalyticsTableProps {
  rows: Array<{
    promptId: string;
    title: string;
    active: boolean;
    metrics?: ListingAnalyticsRow | null;
  }>;
  isLoading?: boolean;
}

export function ListingAnalyticsTable({
  rows,
  isLoading,
}: ListingAnalyticsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-white">
          Per-listing performance
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Views, conversion (purchases ÷ views), and unlock rate (unlocks ÷
          purchases) for each of your prompts — use these to optimize listings.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-white/10 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3 font-medium">Listing</th>
              <th className="px-5 py-3 font-medium text-right">
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <Eye className="h-3.5 w-3.5" />
                  Views
                </span>
              </th>
              <th className="px-5 py-3 font-medium text-right">
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <Target className="h-3.5 w-3.5" />
                  Conversion
                </span>
              </th>
              <th className="px-5 py-3 font-medium text-right">
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <KeyRound className="h-3.5 w-3.5" />
                  Unlock rate
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const m = row.metrics;
              return (
                <tr
                  key={row.promptId}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-white font-medium">
                        {row.title}
                      </span>
                      <span
                        className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                          row.active
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      #{row.promptId}
                      {m
                        ? ` · ${m.purchases} purchase${m.purchases === 1 ? "" : "s"} · ${m.unlocks} unlock${m.unlocks === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-white">
                    {m ? m.views.toLocaleString() : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-white">
                    {m ? formatRate(m.conversionRate) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-white">
                    {m ? formatRate(m.unlockRate) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
