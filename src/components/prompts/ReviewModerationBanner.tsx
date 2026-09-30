import { AlertTriangle, CheckCircle2, PencilLine } from "lucide-react";
import type { ReviewModerationDecision, ReviewModerationStatus } from "../../lib/reviews/reviewClient";
import { Link } from "react-router-dom";

interface ReviewModerationBannerProps {
  decision: ReviewModerationDecision;
  reviewId?: string;
}

const DECISION_DETAILS = {
  approved: {
    label: "Review approved",
    Icon: CheckCircle2,
    className: "border-emerald-300/20 bg-emerald-300/5 text-emerald-100",
    iconClassName: "text-emerald-300",
  },
  edited: {
    label: "Review edited by moderators",
    Icon: PencilLine,
    className: "border-cyan-300/20 bg-cyan-300/5 text-cyan-100",
    iconClassName: "text-cyan-300",
  },
  removed: {
    label: "Review removed",
    Icon: AlertTriangle,
    className: "border-amber-300/20 bg-amber-300/5 text-amber-100",
    iconClassName: "text-amber-300",
  },
} satisfies Record<ReviewModerationStatus, {
  label: string;
  Icon: typeof CheckCircle2;
  className: string;
  iconClassName: string;
}>;

export function ReviewModerationBanner({ decision, reviewId }: ReviewModerationBannerProps) {
  const { label, Icon, className, iconClassName } = DECISION_DETAILS[decision.status];
  const decisionTimestamp = decision.decidedAt ?? decision.updatedAt;
  const decidedAt = decisionTimestamp === undefined ? undefined : new Date(decisionTimestamp);
  const validDecisionDate = decidedAt && !Number.isNaN(decidedAt.getTime());

  return (
    <aside
      role="note"
      aria-label={`${label}: ${decision.reason}`}
      className={`mb-3 flex gap-3 rounded-lg border p-3 ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-sm leading-5 text-slate-300">{decision.reason}</p>
        {reviewId && (
          <p className="mt-1 text-xs text-slate-500">Review reference: <span className="font-mono">{reviewId}</span></p>
        )}
        {reviewId && decision.status !== "approved" && (
          <Link
            to={`/appeals?reviewId=${encodeURIComponent(reviewId)}`}
            className="mt-2 inline-flex text-xs font-semibold text-cyan-200 underline underline-offset-2 hover:text-cyan-100"
          >
            Appeal this decision
          </Link>
        )}
        {validDecisionDate && (
          <time className="mt-1 block text-xs text-slate-500" dateTime={decidedAt.toISOString()}>
            Decision recorded {decidedAt.toLocaleDateString()}
          </time>
        )}
      </div>
    </aside>
  );
}