import React from "react";
import { Clock, WifiOff, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FreshnessBadgeProps {
  timestamp?: number | string | Date | null;
  isCached?: boolean;
  isOffline?: boolean;
  isDegraded?: boolean;
  className?: string;
}

export function formatFreshnessTime(timestamp?: number | string | Date | null): string {
  if (!timestamp) return "Unknown";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 30) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  timestamp,
  isCached = false,
  isOffline = false,
  isDegraded = false,
  className = "",
}) => {
  if (!isCached && !isOffline && !isDegraded) {
    return null;
  }

  const freshnessLabel = formatFreshnessTime(timestamp);

  let variantClasses = "border-amber-400/30 bg-amber-400/10 text-amber-200";
  let IconComponent = Clock;
  let prefixText = "Cached content";

  if (isOffline) {
    variantClasses = "border-rose-400/30 bg-rose-400/10 text-rose-200";
    IconComponent = WifiOff;
    prefixText = "Offline mode";
  } else if (isDegraded) {
    variantClasses = "border-amber-400/30 bg-amber-400/10 text-amber-200";
    IconComponent = AlertTriangle;
    prefixText = "Degraded connection";
  }

  return (
    <Badge
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${variantClasses} ${className}`}
      title={`Data freshness: ${timestamp ? new Date(timestamp).toLocaleString() : "Cached"}`}
      data-testid="freshness-badge"
    >
      <IconComponent className="h-3.5 w-3.5 shrink-0" />
      <span>
        {prefixText} • Freshness: <span className="font-bold">{freshnessLabel}</span>
      </span>
    </Badge>
  );
};
