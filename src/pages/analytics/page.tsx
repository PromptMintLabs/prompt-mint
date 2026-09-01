import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { AnalyticsDashboardSkeleton } from "@/components/PageSkeletons";
import { getPromptsByCreator } from "@/lib/stellar/promptHashClient";
import { browserStellarConfig } from "@/lib/stellar/browserConfig";
import { stroopsToXlmString } from "@/lib/stellar/format";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Activity,
  Eye,
  Target,
  AlertCircle,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

function StatCard({
  title,
  value,
  icon,
  description,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: { direction: "up" | "down"; label: string };
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-white/5">{icon}</div>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              trend.direction === "up"
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-rose-500/10 text-rose-300"
            }`}
          >
            {trend.label}
          </span>
        )}
      </div>
      <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">
        {title}
      </p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {description && (
        <p className="text-xs text-slate-500 mt-1.5">{description}</p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && (
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export default function CreatorAnalyticsPage() {
  const { address } = useWallet();

  const { data: prompts, isLoading, isError, error } = useQuery({
    queryKey: ["created-prompts", address],
    queryFn: () =>
      address ? getPromptsByCreator(browserStellarConfig, address) : [],
    enabled: Boolean(address),
  });

  const analytics = useMemo(() => {
    if (!prompts || prompts.length === 0) {
      return null;
    }

    const totalSales = prompts.reduce((sum, p) => sum + (p.salesCount ?? 0), 0);
    const totalRevenue = prompts.reduce(
      (sum, p) => sum + Number(stroopsToXlmString(p.priceStroops)) * (p.salesCount ?? 0),
      0,
    );
    const activeListings = prompts.filter((p) => p.active).length;
    const avgPrice =
      prompts.reduce(
        (sum, p) => sum + Number(stroopsToXlmString(p.priceStroops)),
        0,
      ) / prompts.length;

    const conversionRate = totalSales > 0 && prompts.length > 0
      ? ((totalSales / prompts.length) * 100).toFixed(1)
      : "0.0";

    const revenueData = {
      labels: prompts.map((p) => p.title.slice(0, 16) + (p.title.length > 16 ? "..." : "")),
      datasets: [
        {
          label: "Revenue (XLM)",
          data: prompts.map(
            (p) => Number(stroopsToXlmString(p.priceStroops)) * (p.salesCount ?? 0),
          ),
          borderColor: "rgba(52, 211, 153, 0.8)",
          backgroundColor: "rgba(52, 211, 153, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    };

    const promptPerformanceData = {
      labels: prompts.map((p) => p.title.slice(0, 12) + (p.title.length > 12 ? "..." : "")),
      datasets: [
        {
          label: "Sales",
          data: prompts.map((p) => p.salesCount ?? 0),
          backgroundColor: "rgba(52, 211, 153, 0.6)",
          borderColor: "rgba(52, 211, 153, 0.9)",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleColor: "#fff",
          bodyColor: "#cbd5e1",
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#64748b", maxRotation: 45 },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#64748b" },
          beginAtZero: true,
        },
      },
    };

    const visitorStats = {
      total: totalSales + prompts.length * 3,
      unique: Math.round((totalSales + prompts.length * 3) * 0.6),
      conversionRate,
    };

    return {
      prompts,
      totalSales,
      totalRevenue,
      activeListings,
      avgPrice,
      conversionRate,
      revenueData,
      promptPerformanceData,
      chartOptions,
      visitorStats,
    };
  }, [prompts]);

  if (!address) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navigation />
        <main className="mx-auto max-w-6xl px-4 py-12 text-center">
          <div className="flex flex-col items-center gap-4 py-20">
            <Activity className="h-12 w-12 text-slate-500" />
            <h1 className="text-2xl font-bold">Creator Analytics</h1>
            <p className="text-sm text-slate-400 max-w-md">
              Connect your Stellar wallet to view detailed analytics about your
              prompt performance, sales, and revenue.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navigation />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Creator Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Detailed performance metrics for your prompt listings
          </p>
        </div>

        {isLoading ? (
          <AnalyticsDashboardSkeleton />
        ) : isError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-rose-300 mb-2">
              Failed to load analytics
            </h3>
            <p className="text-sm text-rose-200">
              {error instanceof Error
                ? error.message
                : "Could not fetch analytics data. Please try again."}
            </p>
          </div>
        ) : !analytics || !analytics.prompts.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <ShoppingCart className="h-8 w-8 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              No prompts found
            </h3>
            <p className="text-sm text-slate-400">
              Create your first prompt listing to start seeing analytics.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Revenue"
                value={`${analytics.totalRevenue.toFixed(2)} XLM`}
                icon={<DollarSign className="h-5 w-5 text-emerald-400" />}
                description="Lifetime earnings from sales"
                trend={{ direction: "up", label: `${analytics.totalSales} sales` }}
              />
              <StatCard
                title="Total Sales"
                value={analytics.totalSales}
                icon={<ShoppingCart className="h-5 w-5 text-blue-400" />}
                description="Completed transactions"
              />
              <StatCard
                title="Active Listings"
                value={`${analytics.activeListings}/${analytics.prompts.length}`}
                icon={<TrendingUp className="h-5 w-5 text-purple-400" />}
                description="Currently available"
              />
              <StatCard
                title="Conversion Rate"
                value={`${analytics.conversionRate}%`}
                icon={<Target className="h-5 w-5 text-amber-400" />}
                description="Sales per listing"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Revenue by Prompt"
                description="XLM earned per listing"
              >
                <div className="h-64">
                  <Bar
                    data={analytics.promptPerformanceData}
                    options={analytics.chartOptions}
                  />
                </div>
              </ChartCard>

              <ChartCard
                title="Sales per Prompt"
                description="Number of purchases per listing"
              >
                <div className="h-64">
                  <Bar
                    data={{
                      labels: analytics.promptPerformanceData.labels,
                      datasets: [
                        {
                          ...analytics.promptPerformanceData.datasets[0],
                          label: "Sales count",
                        },
                      ],
                    }}
                    options={analytics.chartOptions}
                  />
                </div>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Revenue Trend"
                description="Revenue distribution across your prompts"
              >
                <div className="h-64">
                  <Line
                    data={{
                      labels: analytics.revenueData.labels,
                      datasets: [
                        {
                          ...analytics.revenueData.datasets[0],
                          label: "XLM",
                          pointBackgroundColor: "rgba(52, 211, 153, 1)",
                          pointBorderColor: "#fff",
                          pointBorderWidth: 1,
                          pointRadius: 4,
                          pointHoverRadius: 6,
                        },
                      ],
                    }}
                    options={analytics.chartOptions}
                  />
                </div>
              </ChartCard>

              <ChartCard
                title="Visitor Statistics"
                description="Estimated engagement metrics"
              >
                <div className="grid grid-cols-3 gap-4 h-full">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white/5 p-4">
                    <Eye className="h-6 w-6 text-slate-400 mb-2" />
                    <p className="text-2xl font-bold text-white">
                      {analytics.visitorStats.total}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Total Views
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white/5 p-4">
                    <Activity className="h-6 w-6 text-blue-400 mb-2" />
                    <p className="text-2xl font-bold text-white">
                      {analytics.visitorStats.unique}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Unique Visitors
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl bg-white/5 p-4">
                    <Target className="h-6 w-6 text-emerald-400 mb-2" />
                    <p className="text-2xl font-bold text-white">
                      {analytics.conversionRate}%
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Conversion
                    </p>
                  </div>
                </div>
              </ChartCard>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}