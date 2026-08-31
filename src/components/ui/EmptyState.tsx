import React from "react";
import {
  PackageSearch,
  BookOpenCheck,
  Search,
  ShoppingBag,
  AlertTriangle,
  WifiOff,
  LockKeyhole,
  ReceiptText,
  BookmarkCheck,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Icon presets ──────────────────────────────────────────────────────────────
/** Semantic variants that pick a suitable icon and colour automatically. */
export type EmptyStateVariant =
  | "no-results"
  | "no-purchases"
  | "no-listings"
  | "search-empty"
  | "no-transactions"
  | "no-bookmarks"
  | "no-notifications"
  | "offline"
  | "error"
  | "locked"
  | "custom";

const VARIANT_MAP: Record<
  Exclude<EmptyStateVariant, "custom">,
  { icon: LucideIcon; iconBg: string; iconColor: string; defaultTitle: string; defaultDescription: string }
> = {
  "no-results": {
    icon: PackageSearch,
    iconBg: "bg-slate-800",
    iconColor: "text-slate-400",
    defaultTitle: "No results found",
    defaultDescription: "Try adjusting your filters or search terms.",
  },
  "no-purchases": {
    icon: BookOpenCheck,
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-300",
    defaultTitle: "No purchases yet",
    defaultDescription: "Browse the marketplace and acquire your first prompt license.",
  },
  "no-listings": {
    icon: ShoppingBag,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-300",
    defaultTitle: "No listings yet",
    defaultDescription: "Head to the Sell page to publish your first prompt.",
  },
  "search-empty": {
    icon: Search,
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-300",
    defaultTitle: "No matching prompts",
    defaultDescription: "Broaden your search or clear your active filters.",
  },
  "no-transactions": {
    icon: ReceiptText,
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-300",
    defaultTitle: "No transactions yet",
    defaultDescription:
      "Your marketplace purchases, sales and transfers will appear here once you trade.",
  },
  "no-bookmarks": {
    icon: BookmarkCheck,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-300",
    defaultTitle: "No bookmarks yet",
    defaultDescription:
      "Browse the marketplace and save the prompts you want to revisit later.",
  },
  "no-notifications": {
    icon: Bell,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-300",
    defaultTitle: "No notifications",
    defaultDescription:
      "You're all caught up. Alerts about your prompts and activity will show up here.",
  },
  offline: {
    icon: WifiOff,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-300",
    defaultTitle: "You're offline",
    defaultDescription: "Check your connection and refresh the page to see live listings.",
  },
  error: {
    icon: AlertTriangle,
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-300",
    defaultTitle: "Something went wrong",
    defaultDescription: "We couldn't load this content. Please try again.",
  },
  locked: {
    icon: LockKeyhole,
    iconBg: "bg-slate-800",
    iconColor: "text-slate-400",
    defaultTitle: "Content locked",
    defaultDescription: "Purchase a license to unlock this prompt.",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  /** Semantic variant – controls icon, colours, and default copy. */
  variant?: EmptyStateVariant;
  /** Override the title text. Falls back to the variant default. */
  title?: string;
  /** Override the description text. Falls back to the variant default. */
  description?: string;
  /**
   * Supply a custom icon when variant is "custom" or when you want to
   * replace the preset icon.
   */
  icon?: LucideIcon;
  /** Optional CTA rendered below the description (e.g. a Button or Link). */
  action?: React.ReactNode;
  /** Extra classes applied to the outer wrapper. */
  className?: string;
  /**
   * Visual size of the state — "sm" suits inline/panel contexts,
   * "md" is the standard, "lg" is for full-page empties.
   */
  size?: "sm" | "md" | "lg";
  /**
   * When true, a dashed border is drawn around the empty state rather
   * than a solid one. Default: true.
   */
  dashed?: boolean;
}

/**
 * EmptyState
 *
 * A consistent empty-state component used across all marketplace pages.
 *
 * Behaviour / edge cases documented:
 * - If `variant` is "custom" and no `icon` is provided, a generic
 *   PackageSearch icon is rendered.
 * - `action` is rendered only when truthy, preventing layout gaps.
 * - Sizes control padding and icon dimensions; all are accessible at
 *   every viewport width.
 * - On-chain access rights are entirely unaffected; this component
 *   only presents UI copy and never mutates state.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = "no-results",
  title,
  description,
  icon: CustomIcon,
  action,
  className,
  size = "md",
  dashed = true,
}) => {
  const preset = variant !== "custom" ? VARIANT_MAP[variant] : null;

  const Icon = CustomIcon ?? (preset?.icon ?? PackageSearch);
  const resolvedTitle = title ?? preset?.defaultTitle ?? "Nothing here";
  const resolvedDescription = description ?? preset?.defaultDescription ?? "";
  const iconBg = preset?.iconBg ?? "bg-slate-800";
  const iconColor = preset?.iconColor ?? "text-slate-400";

  const sizeClasses = {
    sm: { wrapper: "py-8 px-4", iconBox: "h-10 w-10", icon: "h-5 w-5", title: "text-sm", desc: "text-xs" },
    md: { wrapper: "py-14 px-6", iconBox: "h-14 w-14", icon: "h-7 w-7", title: "text-base", desc: "text-sm" },
    lg: { wrapper: "py-24 px-8", iconBox: "h-20 w-20", icon: "h-10 w-10", title: "text-xl", desc: "text-base" },
  }[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-2xl border",
        dashed ? "border-dashed border-white/10" : "border-white/5",
        "bg-white/[0.02]",
        sizeClasses.wrapper,
        className,
      )}
      role="status"
      aria-label={resolvedTitle}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl mb-4",
          sizeClasses.iconBox,
          iconBg,
        )}
      >
        <Icon className={cn(sizeClasses.icon, iconColor)} aria-hidden="true" />
      </div>

      {/* Title */}
      <h3
        className={cn(
          "font-semibold text-white mb-1.5",
          sizeClasses.title,
        )}
      >
        {resolvedTitle}
      </h3>

      {/* Description */}
      {resolvedDescription && (
        <p
          className={cn(
            "text-slate-400 max-w-xs leading-relaxed",
            sizeClasses.desc,
          )}
        >
          {resolvedDescription}
        </p>
      )}

      {/* CTA */}
      {action && (
        <div className="mt-5">{action}</div>
      )}
    </div>
  );
};
