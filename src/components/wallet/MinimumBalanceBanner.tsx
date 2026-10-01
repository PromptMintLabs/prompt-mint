import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useXlmFormatter } from "@/lib/i18n-number";
import {
  useMinimumBalance,
  type UseMinimumBalanceOptions,
} from "@/hooks/useMinimumBalance";

type MinimumBalanceBannerProps = UseMinimumBalanceOptions & {
  className?: string;
};

/**
 * Shown when a connected wallet's native XLM balance is below the Stellar
 * minimum account reserve, which means it can no longer pay transaction fees.
 * Renders nothing while checking, when the balance is sufficient, or when the
 * check itself failed (a failed lookup must not be shown as a low balance).
 */
export const MinimumBalanceBanner: React.FC<MinimumBalanceBannerProps> = ({
  className = "",
  ...options
}) => {
  const { t } = useTranslation();
  const formatXlm = useXlmFormatter();
  const { status, assessment, recheck } = useMinimumBalance(options);

  if (status !== "below-reserve" && status !== "unfunded") {
    return null;
  }

  const messages: string[] =
    status === "unfunded" || !assessment
      ? [t("minimumBalance.unfunded")]
      : [
          t("minimumBalance.belowReserve", {
            balance: formatXlm(assessment.nativeBalanceStroops),
            reserve: formatXlm(assessment.minimumReserveStroops),
          }),
          t("minimumBalance.shortfall", {
            shortfall: formatXlm(assessment.shortfallStroops),
          }),
        ];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="minimum-balance-banner"
      className={`rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 flex gap-3 items-start text-rose-200 ${className}`}
    >
      <AlertTriangle
        className="h-5 w-5 shrink-0 mt-0.5 text-rose-400"
        aria-hidden="true"
      />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold">{t("minimumBalance.title")}</p>
        {messages.map((message) => (
          <p key={message} className="text-xs opacity-90">
            {message}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={recheck}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-medium hover:bg-rose-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {t("minimumBalance.recheck")}
      </button>
    </div>
  );
};
