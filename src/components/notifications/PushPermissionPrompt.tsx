import React, { useState, useEffect } from "react";
import { Bell, BellOff, Check, X, ShieldAlert } from "lucide-react";
import {
  isPushSupported,
  getPushPermissionStatus,
  requestPushPermission,
} from "@/lib/notifications/push";

export interface PushPermissionPromptProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  onDismiss?: () => void;
  /** Storage key for persisting user dismissal */
  storageKey?: string;
  className?: string;
  forceShow?: boolean;
}

const DEFAULT_DISMISS_KEY = "prompt_mint_push_prompt_dismissed_v1";

export const PushPermissionPrompt: React.FC<PushPermissionPromptProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  onDismiss,
  storageKey = DEFAULT_DISMISS_KEY,
  className = "",
  forceShow = false,
}) => {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isDismissed, setIsDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setPermission("unsupported");
      return;
    }
    const current = getPushPermissionStatus();
    setPermission(current);

    try {
      const dismissed = localStorage.getItem(storageKey);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  if (!forceShow && (isDismissed || permission === "granted" || permission === "unsupported")) {
    return null;
  }

  const handleRequest = async () => {
    setLoading(true);
    try {
      const result = await requestPushPermission();
      setPermission(result);
      if (result === "granted") {
        onPermissionGranted?.();
      } else if (result === "denied") {
        onPermissionDenied?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // Ignore localStorage errors
    }
    onDismiss?.();
  };

  if (permission === "denied") {
    return (
      <div
        data-testid="push-permission-prompt"
        className={`relative flex items-center justify-between gap-3 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-slate-200 text-xs ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>Push notifications are blocked in your browser settings.</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="push-permission-prompt"
      className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-slate-900 border-l-4 border-l-amber-400 shadow-lg text-xs backdrop-blur-md ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div>
          <h4 className="font-semibold text-white text-sm">Stay Updated with Real-Time Alerts</h4>
          <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
            Get instant push notifications when your prompts are purchased, licenses unlock, or disputes update.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
        <button
          type="button"
          onClick={handleRequest}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? (
            "Requesting..."
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Enable Notifications</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          Maybe Later
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close prompt"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
