import { Check, Circle, Clock3, Gavel, MessageSquare, Send, X } from "lucide-react";

export type AppealStatus =
  | "submitted"
  | "under_review"
  | "decision"
  | "resolved"
  | "rejected";

export interface AppealTimelineEvent {
  status: AppealStatus;
  occurredAt?: string | number | Date;
  note?: string;
}

interface AppealStatusTimelineProps {
  events: AppealTimelineEvent[];
  currentStatus?: AppealStatus;
  className?: string;
}

const STATUS_DETAILS: Record<
  AppealStatus,
  { label: string; description: string; icon: typeof Send }
> = {
  submitted: {
    label: "Appeal submitted",
    description: "Your appeal is in the queue for review.",
    icon: Send,
  },
  under_review: {
    label: "Under review",
    description: "A moderator is reviewing the appeal and supporting details.",
    icon: MessageSquare,
  },
  decision: {
    label: "Decision recorded",
    description: "The moderation team has reached a decision.",
    icon: Gavel,
  },
  resolved: {
    label: "Appeal approved",
    description: "The moderation action was reversed.",
    icon: Check,
  },
  rejected: {
    label: "Appeal rejected",
    description: "The original moderation action remains in effect.",
    icon: X,
  },
};

const STATUS_ORDER: AppealStatus[] = ["submitted", "under_review", "decision"];
const FULL_STATUS_ORDER: AppealStatus[] = [...STATUS_ORDER, "resolved", "rejected"];

function formatDate(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusState(
  status: AppealStatus,
  events: AppealTimelineEvent[],
  currentStatus?: AppealStatus,
) {
  const eventIndex = events.findIndex((event) => event.status === status);
  const currentIndex = currentStatus ? FULL_STATUS_ORDER.indexOf(currentStatus) : -1;
  const statusIndex = FULL_STATUS_ORDER.indexOf(status);

  if (eventIndex >= 0) return "complete";
  if (status === currentStatus) return "current";
  if (currentIndex >= 0 && statusIndex >= 0 && statusIndex < currentIndex) return "complete";
  if (currentIndex >= 0 && statusIndex > currentIndex) return "upcoming";
  return "upcoming";
}

function toDateTime(value: string | number | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function AppealStatusTimeline({
  events,
  currentStatus,
  className = "",
}: AppealStatusTimelineProps) {
  const finalStatus = currentStatus === "resolved" || currentStatus === "rejected";
  const statuses = finalStatus ? [...STATUS_ORDER, currentStatus] : STATUS_ORDER;

  return (
    <section
      aria-labelledby="appeal-status-heading"
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 ${className}`}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 id="appeal-status-heading" className="text-lg font-semibold text-white">
            Appeal status
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Follow each step of the moderation appeal.
          </p>
        </div>
        <Clock3 className="mt-1 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
      </div>

      <ol className="relative space-y-6" aria-label="Appeal status history">
        {statuses.map((status, index) => {
          const detail = STATUS_DETAILS[status];
          const event = events.find((item) => item.status === status);
          const state = getStatusState(status, events, currentStatus);
          const Icon = detail.icon;
          const isLast = index === statuses.length - 1;

          return (
            <li key={status} className="relative flex gap-4">
              {!isLast && (
                <span
                  className={`absolute left-[0.6875rem] top-7 h-[calc(100%+0.5rem)] w-px ${
                    state === "complete" ? "bg-emerald-400/60" : "bg-white/10"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  state === "complete"
                    ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-300"
                    : state === "current"
                      ? "border-amber-300/60 bg-amber-300/15 text-amber-200"
                      : "border-white/15 bg-slate-950 text-slate-600"
                }`}
              >
                {state === "complete" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : state === "current" ? (
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Circle className="h-2.5 w-2.5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className={`text-sm font-semibold ${state === "upcoming" ? "text-slate-500" : "text-white"}`}>
                    {detail.label}
                  </h3>
                  {event?.occurredAt && (
                    <time className="text-xs text-slate-500" dateTime={toDateTime(event.occurredAt)}>
                      {formatDate(event.occurredAt)}
                    </time>
                  )}
                </div>
                <p className={`mt-1 text-sm ${state === "upcoming" ? "text-slate-600" : "text-slate-400"}`}>
                  {event?.note ?? detail.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}