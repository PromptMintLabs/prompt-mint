import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Wallet } from "lucide-react";
import {
  calculatePurchaseFeeBreakdown,
  DEFAULT_PLATFORM_FEE_BPS,
  type FeeEstimate,
} from "@/lib/checkout/feeEstimation";
import { useXlmFormatter } from "@/lib/i18n-number";

interface PurchaseFeeBreakdownModalProps {
  promptPriceStroops: bigint;
  feeEstimate: FeeEstimate | null;
  isEstimatingFee: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  confirmButtonRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onConfirm: () => void;
}

export function PurchaseFeeBreakdownModal({
  promptPriceStroops,
  feeEstimate,
  isEstimatingFee,
  dialogRef,
  confirmButtonRef,
  onBack,
  onConfirm,
}: PurchaseFeeBreakdownModalProps) {
  const { t } = useTranslation();
  const formatXlm = useXlmFormatter();
  const breakdown = calculatePurchaseFeeBreakdown(promptPriceStroops);
  const networkFeeStroops =
    feeEstimate && Number.isSafeInteger(feeEstimate.totalFeeStroops)
      ? BigInt(Math.max(0, feeEstimate.totalFeeStroops))
      : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fee-breakdown-title"
        aria-describedby="fee-breakdown-description"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5">
          <h3 id="fee-breakdown-title" className="text-lg font-bold text-white">
            {t("checkout.fee_breakdown_title")}
          </h3>
          <p
            id="fee-breakdown-description"
            className="mt-1 text-sm text-slate-400"
          >
            {t("checkout.fee_breakdown_description")}
          </p>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 text-slate-300">
            <dt>{t("checkout.prompt_price")}</dt>
            <dd className="text-right font-medium text-white">
              {formatXlm(promptPriceStroops, "stroops", 7)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-slate-400">
            <dt>
              {t("checkout.platform_fee_estimate", {
                rate: DEFAULT_PLATFORM_FEE_BPS / 100,
              })}
            </dt>
            <dd className="text-right">
              {formatXlm(breakdown.platformFeeStroops, "stroops", 7)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-slate-400">
            <dt>{t("checkout.creator_proceeds_estimate")}</dt>
            <dd className="text-right">
              {formatXlm(breakdown.creatorProceedsStroops, "stroops", 7)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-slate-400">
            <dt>{t("checkout.network_fee_estimate")}</dt>
            <dd className="text-right">
              {networkFeeStroops === null
                ? isEstimatingFee
                  ? t("checkout.estimating")
                  : t("checkout.unavailable")
                : formatXlm(networkFeeStroops, "stroops", 7)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-white/10 pt-3 font-bold text-white">
            <dt>{t("checkout.total_estimate")}</dt>
            <dd className="text-right">
              {networkFeeStroops === null
                ? t("checkout.unavailable")
                : formatXlm(
                    promptPriceStroops + networkFeeStroops,
                    "stroops",
                    7,
                  )}
            </dd>
          </div>
        </dl>

        <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-400">
          <p>{t("checkout.platform_fee_note")}</p>
          <p>{t("checkout.network_fee_note")}</p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="h-12 flex-1 rounded-xl border border-white/15 bg-white/[0.03] px-4 font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t("checkout.back")}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-bold text-slate-950 transition-colors hover:bg-emerald-300"
          >
            {t("checkout.confirm_purchase")}
            <Wallet className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
