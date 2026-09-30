import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Clock,
  KeyRound,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { WebhookSignatureStatus as StatusType } from "@/lib/api/webhookSignature";

export interface WebhookSignatureStatusProps {
  status: StatusType;
  signature?: string;
  timestamp?: string | number;
  message?: string;
  showDetails?: boolean;
  className?: string;
}

export const WebhookSignatureStatus: React.FC<WebhookSignatureStatusProps> = ({
  status,
  signature,
  timestamp,
  message,
  showDetails = false,
  className = "",
}) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusConfig = (s: StatusType) => {
    switch (s) {
      case "verified":
        return {
          label: "Signature Verified",
          icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />,
          badgeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
          dotClass: "bg-emerald-400",
        };
      case "invalid":
        return {
          label: "Invalid Signature",
          icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />,
          badgeClass: "bg-rose-500/10 border-rose-500/30 text-rose-300",
          dotClass: "bg-rose-400",
        };
      case "expired":
        return {
          label: "Signature Expired",
          icon: <Clock className="h-3.5 w-3.5 text-amber-400" />,
          badgeClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
          dotClass: "bg-amber-400",
        };
      case "missing_secret":
        return {
          label: "Missing Secret",
          icon: <KeyRound className="h-3.5 w-3.5 text-slate-400" />,
          badgeClass: "bg-slate-500/10 border-slate-500/30 text-slate-300",
          dotClass: "bg-slate-400",
        };
      case "missing_signature":
        return {
          label: "No Signature",
          icon: <ShieldQuestion className="h-3.5 w-3.5 text-slate-400" />,
          badgeClass: "bg-slate-500/10 border-slate-500/30 text-slate-300",
          dotClass: "bg-slate-400",
        };
      default:
        return {
          label: "Unverified",
          icon: <HelpCircle className="h-3.5 w-3.5 text-slate-400" />,
          badgeClass: "bg-slate-500/10 border-slate-500/30 text-slate-400",
          dotClass: "bg-slate-400",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div
      data-testid="webhook-signature-status"
      className={`inline-flex flex-col text-xs font-mono ${className}`}
    >
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.badgeClass} transition-colors`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
        {config.icon}
        <span className="font-semibold">{config.label}</span>

        {showDetails && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="ml-1 p-0.5 hover:text-white rounded transition-colors"
            aria-label="Toggle signature details"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {showDetails && expanded && (
        <div className="mt-2 p-2.5 rounded-lg border border-white/10 bg-slate-900/90 text-[11px] text-slate-300 space-y-1 backdrop-blur-sm">
          {message && <div className="text-slate-400">{message}</div>}
          {signature && (
            <div className="truncate">
              <span className="text-slate-500">Sig: </span>
              <span className="font-mono text-slate-300" title={signature}>
                {signature.length > 24
                  ? `${signature.slice(0, 12)}...${signature.slice(-8)}`
                  : signature}
              </span>
            </div>
          )}
          {timestamp && (
            <div>
              <span className="text-slate-500">Time: </span>
              <span>{new Date(timestamp).toISOString()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
