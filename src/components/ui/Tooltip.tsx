import React, { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatXLM } from "@/lib/formatters";

// ── Generic Tooltip ────────────────────────────────────────────────────────────

export interface TooltipProps {
  /** Content shown inside the tooltip bubble. */
  content: React.ReactNode;
  /** The element the tooltip is anchored to. */
  children: React.ReactNode;
  /** Preferred placement relative to the trigger. Default: "top". */
  side?: "top" | "bottom";
  /** Additional classes for the trigger wrapper. */
  className?: string;
  /** Additional classes for the tooltip bubble. */
  contentClassName?: string;
}

/**
 * Lightweight, dependency-free tooltip.
 *
 * Positioned with `position: fixed` (computed from the trigger's bounding
 * rect) so it never gets clipped by `overflow-hidden` ancestors — a common
 * problem with pure-CSS `group-hover` tooltips in this app's card grids.
 *
 * Opens on hover and keyboard focus; closes on leave/blur. Exposes
 * `aria-describedby` for assistive tech.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
  contentClassName,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  const position = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = side === "top" ? rect.top - 8 : rect.bottom + 8;
    const left = rect.left + rect.width / 2;
    setCoords({ top, left });
  };

  const show = () => {
    position();
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none fixed z-[100] max-w-xs -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs leading-relaxed text-slate-200 shadow-xl backdrop-blur",
            side === "bottom" && "translate-y-0",
            contentClassName,
          )}
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

// ── AddressTooltip ─────────────────────────────────────────────────────────────

export interface AddressTooltipProps {
  address: string;
  /** Characters kept at each end when truncating. Default: 4. */
  chars?: number;
  className?: string;
}

/** Truncates a Stellar address inline and reveals the full value on hover/focus. */
export function AddressTooltip({
  address,
  chars = 4,
  className,
}: AddressTooltipProps) {
  if (!address) return null;
  const safeChars = Math.max(1, chars);
  const display = `${address.slice(0, safeChars)}…${address.slice(-safeChars)}`;
  return (
    <Tooltip
      content={
        <span className="font-mono break-all text-slate-100">{address}</span>
      }
      className={className}
    >
      <span className="cursor-help font-mono underline decoration-dotted decoration-slate-500 underline-offset-2">
        {display}
      </span>
    </Tooltip>
  );
}

// ── XlmAmountTooltip ───────────────────────────────────────────────────────────

export interface XlmAmountTooltipProps {
  /** Amount in stroops (the smallest on-chain unit). */
  stroops: bigint | number | string;
  /** Override the displayed amount text (e.g. already formatted). */
  label?: React.ReactNode;
  className?: string;
}

/** Shows a human XLM figure but reveals the exact stroop count on hover. */
export function XlmAmountTooltip({
  stroops,
  label,
  className,
}: XlmAmountTooltipProps) {
  const value =
    typeof stroops === "bigint" ? stroops : BigInt(stroops || 0);
  return (
    <Tooltip
      content={
        <div className="space-y-0.5">
          <div className="font-mono text-slate-100">{value.toString()} stroops</div>
          <div className="text-slate-400">≈ {formatXLM(value)}</div>
        </div>
      }
      className={className}
    >
      <span className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-2">
        {label ?? formatXLM(value)}
      </span>
    </Tooltip>
  );
}

// ── TimestampTooltip ──────────────────────────────────────────────────────────

export interface TimestampTooltipProps {
  /** ISO string, epoch milliseconds, or Date. */
  value: string | number | Date;
  className?: string;
}

function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (sec < 60) return rtf.format(-Math.sign(diffMs) * sec, "second");
  if (min < 60) return rtf.format(-Math.sign(diffMs) * min, "minute");
  if (hr < 24) return rtf.format(-Math.sign(diffMs) * hr, "hour");
  if (day < 30) return rtf.format(-Math.sign(diffMs) * day, "day");
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** Shows relative time; hovering reveals the absolute date/time plus offset. */
export function TimestampTooltip({
  value,
  className,
}: TimestampTooltipProps) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const absolute = date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Tooltip
      content={
        <div className="space-y-0.5">
          <div className="text-slate-100">{absolute}</div>
          <div className="text-slate-400">
            {date.toLocaleDateString(undefined, {
              timeZoneName: "short",
            })}
          </div>
        </div>
      }
      className={className}
    >
      <span className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-2">
        {formatRelative(date)}
      </span>
    </Tooltip>
  );
}

// ── ContractStateTooltip ──────────────────────────────────────────────────────

export interface ContractStateTooltipProps {
  /** One of the known contract lifecycle states. */
  state: string;
  /** Optional extra detail appended to the built-in description. */
  detail?: string;
  className?: string;
}

const CONTRACT_STATE_INFO: Record<string, { label: string; description: string }> =
  {
    active: {
      label: "Active",
      description: "The contract is live and accepting operations on-chain.",
    },
    paused: {
      label: "Paused",
      description: "Operations are temporarily halted by the contract admin.",
    },
    draft: {
      label: "Draft",
      description: "The listing is saved but not yet published on-chain.",
    },
    expired: {
      label: "Expired",
      description: "The listing's availability window has ended.",
    },
    frozen: {
      label: "Frozen",
      description: "The contract is locked, typically during a dispute or migration.",
    },
    unknown: {
      label: "Unknown",
      description: "The contract state could not be determined.",
    },
  };

/** Explains a contract lifecycle state on hover. */
export function ContractStateTooltip({
  state,
  detail,
  className,
}: ContractStateTooltipProps) {
  const key = state.toLowerCase();
  const info = CONTRACT_STATE_INFO[key] ?? CONTRACT_STATE_INFO.unknown;
  return (
    <Tooltip
      content={
        <div className="space-y-0.5">
          <div className="font-medium text-slate-100">{info.label}</div>
          <div className="text-slate-400">
            {info.description}
            {detail ? ` ${detail}` : ""}
          </div>
        </div>
      }
      className={className}
    >
      <span className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-2">
        {info.label}
      </span>
    </Tooltip>
  );
}
