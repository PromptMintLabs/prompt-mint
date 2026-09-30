import React, { useState, useRef, useEffect, useContext } from "react";
import { Bell, CheckCheck, Trash2, X, Info, CheckCircle2, AlertTriangle, AlertCircle, ExternalLink } from "lucide-react";
import { NotificationContext, type NotificationItem, type NotificationType } from "../providers/NotificationProvider";
import { trackNotificationClick } from "@/lib/notifications/store";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  groupNotificationsByPrompt,
  isNotificationGroup,
  type NotificationGroup,
  type NotificationDisplayItem,
} from "@/lib/notifications/grouping";
import {
  calculateImportanceScore,
  sortNotificationsByImportance,
} from "@/lib/notifications/importance";
import { useNotificationExperiment } from "@/lib/notifications/experiments";

export const NotificationCenter: React.FC = () => {
  const context = useContext(NotificationContext);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "important">("all");
  const [enableGrouping, setEnableGrouping] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = context?.notifications ?? [];
  const unreadCount = context?.unreadCount ?? 0;
  const markAsRead = context?.markAsRead ?? (() => {});
  const markAllAsRead = context?.markAllAsRead ?? (() => {});
  const clearNotifications = context?.clearNotifications ?? (() => {});
  const trackClick = context?.trackClick ?? (() => {});

  // A/B Experiment assignment (#745)
  const experiment = useNotificationExperiment<{ groupByType?: boolean }>(
    "notification_grouping"
  );

  useEffect(() => {
    if (experiment.config.groupByType !== undefined) {
      setEnableGrouping(experiment.config.groupByType);
    }
  }, [experiment.config]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const markGroupAsRead = (group: NotificationGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    for (const item of group.items) {
      if (!item.isRead) {
        markAsRead(item.id);
      }
    }
  };

  // Filter & Group notifications
  const processedItems: NotificationDisplayItem[] = useMemo(() => {
    let filtered = notifications;
    if (activeTab === "unread") {
      filtered = filtered.filter((n) => !n.isRead);
    } else if (activeTab === "important") {
      filtered = filtered.filter((n) => {
        const evalScore = calculateImportanceScore(n);
        return evalScore.tier === "critical" || evalScore.tier === "high";
      });
    }

    if (enableGrouping) {
      return groupNotificationsByPrompt(filtered);
    }
    return filtered;
  }, [notifications, activeTab, enableGrouping]);

  const importantCount = useMemo(() => {
    return notifications.filter((n) => {
      const evalScore = calculateImportanceScore(n);
      return (
        !n.isRead &&
        (evalScore.tier === "critical" || evalScore.tier === "high")
      );
    }).length;
  }, [notifications]);

  const handleTrackClick = (item: NotificationItem, link?: string) => {
    trackClick(item.id, link);
    trackNotificationClick(item, link);
    if (!item.isRead) {
      markAsRead(item.id);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white focus:outline-none"
        aria-label="Notification Center"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950 shadow-md">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEnableGrouping((prev) => !prev)}
                className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${
                  enableGrouping
                    ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                title={enableGrouping ? "Disable prompt grouping" : "Group by prompt"}
              >
                <Layers className="h-3.5 w-3.5" />
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-amber-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Read all
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                  activeTab === "all"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                  activeTab === "unread"
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("important")}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  activeTab === "important"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Flame className="h-3 w-3 text-rose-400" />
                Important {importantCount > 0 ? `(${importantCount})` : ""}
              </button>
            </div>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => clearNotifications()}
                className="text-[11px] text-slate-500 hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 rounded"
                title="Clear all notifications"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {processedItems.length === 0 ? (
              <EmptyState
                variant="no-notifications"
                title={
                  activeTab === "unread"
                    ? "No unread notifications"
                    : activeTab === "important"
                    ? "No important alerts"
                    : "No notifications"
                }
                description={
                  activeTab === "unread"
                    ? "You're all caught up. New activity will appear here."
                    : activeTab === "important"
                    ? "No high-priority alerts at this time."
                    : "You're all caught up. Alerts about your prompts and activity will show up here."
                }
                size="sm"
              />
            ) : (
              filteredNotifications.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onMarkRead={() => markAsRead(item.id)}
                  onTrackClick={(link) => handleTrackClick(item, link)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface NotificationCardProps {
  item: NotificationItem;
  onMarkRead: () => void;
  onTrackClick?: (link?: string) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ item, onMarkRead, onTrackClick }) => {
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />;
    }
  };

  const formattedTime = new Date(item.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleClick = () => {
    onMarkRead();
    if (onTrackClick) {
      onTrackClick(item.link);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
        item.isRead
          ? "bg-white/[0.02] border-white/5 opacity-75 hover:opacity-100 hover:bg-white/[0.04]"
          : "bg-amber-500/[0.06] border-amber-500/20 hover:bg-amber-500/10"
      }`}
    >
      {getIcon(item.type)}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <p
              className={`text-xs font-semibold truncate ${
                item.isRead ? "text-slate-300" : "text-white"
              }`}
            >
              {item.title || "Notification"}
            </p>
            {importanceEval.tier === "critical" && (
              <span className="rounded bg-rose-500/20 text-rose-300 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                Critical
              </span>
            )}
            {importanceEval.tier === "high" && (
              <span className="rounded bg-amber-500/20 text-amber-300 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                High
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            {formattedTime}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{item.message}</p>

        {item.link && (
          <div className="mt-2 flex items-center">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                if (onTrackClick) {
                  onTrackClick(item.link);
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:underline"
            >
              <span>{item.linkText || "View details"}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {!item.isRead && (
        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-amber-400 ring-4 ring-amber-400/20" />
      )}
    </div>
  );
};

