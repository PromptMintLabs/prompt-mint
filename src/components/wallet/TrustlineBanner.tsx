import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useTrustlineDetection,
  type UseTrustlineDetectionOptions,
} from "@/hooks/useTrustlineDetection";

type TrustlineBannerProps = UseTrustlineDetectionOptions & {
  className?: string;
};

const formatAssetCodes = (codes: string[]) =>
  Array.from(new Set(codes)).join(", ");

/**
 * Shown when a connected wallet lacks a trustline for an asset the marketplace
 * accepts. Renders nothing while checking, when everything is in place, or when
 * the check itself failed (a lookup failure must not block the user).
 */
export const TrustlineBanner: React.FC<TrustlineBannerProps> = ({
  className = "",
  ...options
}) => {
  const { t } = useTranslation();
  const { status, issues, recheck } = useTrustlineDetection(options);

  if (status !== "action-required" && status !== "unfunded") {
    return null;
  }

  const missing = issues
    .filter((i) => i.state === "missing")
    .map((i) => i.asset.code);
  const unauthorized = issues
    .filter((i) => i.state === "unauthorized")
    .map((i) => i.asset.code);

  const messages: string[] = [];
  if (status === "unfunded") {
    messages.push(
      t("trustline.unfunded", { assets: formatAssetCodes(missing) }),
    );
  } else {
    if (missing.length > 0) {
      messages.push(
        t("trustline.missing", { assets: formatAssetCodes(missing) }),
      );
    }
    if (unauthorized.length > 0) {
      messages.push(
        t("trustline.unauthorized", { assets: formatAssetCodes(unauthorized) }),
      );
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="trustline-banner"
      className={`rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 flex gap-3 items-start text-amber-200 ${className}`}
    >
      <AlertTriangle
        className="h-5 w-5 shrink-0 mt-0.5 text-amber-400"
        aria-hidden="true"
      />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold">{t("trustline.title")}</p>
        {messages.map((message) => (
          <p key={message} className="text-xs opacity-90">
            {message}
          </p>
        ))}
      </div>
      <button
        type="button"
        onClick={recheck}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {t("trustline.recheck")}
      </button>
    </div>
  );
};
