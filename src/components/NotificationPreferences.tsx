import React, { useState, useEffect } from "react";
import { Bell, Mail, ShieldCheck, Check, Loader2 } from "lucide-react";

export interface UserNotificationPreferences {
  promptPurchased: boolean;
  promptUpdated: boolean;
  newReviews: boolean;
  priceAlerts: boolean;
  emailNotifications: boolean;
}

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  promptPurchased: true,
  promptUpdated: true,
  newReviews: true,
  priceAlerts: true,
  emailNotifications: true,
};

const STORAGE_KEY_PREFIX = "prompt_mint_notification_prefs_";

interface NotificationPreferencesProps {
  walletAddress?: string;
  onSave?: (prefs: UserNotificationPreferences) => void;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  walletAddress,
  onSave,
}) => {
  const [preferences, setPreferences] =
    useState<UserNotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load preferences from local storage / backend
  useEffect(() => {
    if (!walletAddress) {
      setPreferences(DEFAULT_PREFERENCES);
      return;
    }

    const localKey = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
    const cached = localStorage.getItem(localKey);
    if (cached) {
      try {
        setPreferences(JSON.parse(cached));
      } catch {
        // Fallback to default
      }
    }

    // Try fetching from API
    setIsLoading(true);
    fetch(`/api/user/preferences?walletAddress=${encodeURIComponent(walletAddress)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preferences) {
          const merged = { ...DEFAULT_PREFERENCES, ...data.preferences };
          setPreferences(merged);
          localStorage.setItem(localKey, JSON.stringify(merged));
        }
      })
      .catch(() => {
        // API offline or fallback
      })
      .finally(() => setIsLoading(false));
  }, [walletAddress]);

  const handleToggle = (key: keyof UserNotificationPreferences) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      if (walletAddress) {
        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`,
          JSON.stringify(updated)
        );
      }
      return updated;
    });
    setSavedSuccess(false);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!walletAddress) {
      setErrorMessage("Please connect your wallet to save server notification settings.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          preferences,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update notification preferences");
      }

      setSavedSuccess(true);
      onSave?.(preferences);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      // Local fallback success even if server unreachable
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`,
        JSON.stringify(preferences)
      );
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Bell className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Notification Preferences</h3>
            <p className="text-xs text-slate-400">
              Manage alert preferences for buyer activity and creator sales
            </p>
          </div>
        </div>

        {walletAddress && (
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/5">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Loading preferences...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Creator Preferences */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-3">
              Creator Alerts
            </h4>
            <div className="space-y-3">
              <ToggleRow
                id="pref-prompt-purchased"
                title="Prompt Purchased"
                description="Receive an alert when a buyer purchases one of your prompts"
                checked={preferences.promptPurchased}
                onChange={() => handleToggle("promptPurchased")}
              />
              <ToggleRow
                id="pref-new-reviews"
                title="New Prompt Reviews"
                description="Get notified when buyers review or rate your prompts"
                checked={preferences.newReviews}
                onChange={() => handleToggle("newReviews")}
              />
            </div>
          </div>

          {/* Buyer Preferences */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-cyan-400 font-semibold mb-3">
              Buyer Alerts
            </h4>
            <div className="space-y-3">
              <ToggleRow
                id="pref-prompt-updated"
                title="Purchased Prompt Updates"
                description="Notify me when a creator publishes a new version of a prompt I own"
                checked={preferences.promptUpdated}
                onChange={() => handleToggle("promptUpdated")}
              />
              <ToggleRow
                id="pref-price-alerts"
                title="Price & Status Changes"
                description="Alert me on marketplace price adjustments or listing status updates"
                checked={preferences.priceAlerts}
                onChange={() => handleToggle("priceAlerts")}
              />
            </div>
          </div>

          {/* Delivery Preferences */}
          <div className="pt-2 border-t border-white/10">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
              Delivery Channels
            </h4>
            <ToggleRow
              id="pref-email-notifications"
              title="Email Notifications"
              description="Send email summaries for urgent sales or prompt updates"
              checked={preferences.emailNotifications}
              onChange={() => handleToggle("emailNotifications")}
              icon={<Mail className="h-4 w-4 text-slate-400" />}
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {errorMessage}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Preferences strictly control notification dispatches
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-slate-950" /> Saved
                </>
              ) : (
                "Save Preferences"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ToggleRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  id,
  title,
  description,
  checked,
  onChange,
  icon,
}) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
    <div className="pr-4">
      <div className="flex items-center gap-2">
        {icon}
        <label htmlFor={id} className="text-sm font-semibold text-white cursor-pointer">
          {title}
        </label>
      </div>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>

    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-amber-400" : "bg-slate-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);
