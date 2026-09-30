import React, {
  createContext,
  useReducer,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Notification as StellarNotification } from "@stellar/design-system";
import "./NotificationProvider.css";
import {
  notificationsReducer,
  selectUnreadCount,
  variantForCategory,
  type NotificationCategory,
  type NotificationRecord,
  type NotificationVariant,
} from "@/lib/notifications/store";
import type { NotificationTransport } from "@/lib/notifications/transport";
import { deliverPushOrFallback } from "@/lib/notifications/push";

// Backwards-compatible aliases (existing imports depend on these names).
export type NotificationType = NotificationVariant;
export type NotificationItem = NotificationRecord;

export interface NotifyEventInput {
  category: NotificationCategory;
  message: string;
  title?: string;
  /** Idempotency key so repeated transport deliveries do not duplicate. */
  dedupeKey?: string;
  /** Optional click-through action URL (#749). */
  link?: string;
  /** Optional custom action link text (#749). */
  linkText?: string;
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (
    message: string,
    type?: NotificationType,
    title?: string,
    link?: string,
    linkText?: string,
  ) => void;
  /** Category-typed helper for product events (purchase/expiry/price/follower). */
  notifyEvent: (input: NotifyEventInput) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  /** Tracks click interaction on a notification record (#749). */
  trackClick: (id: string, link?: string) => void;
}

const STORAGE_KEY = "prompt_mint_notifications_center_v1";

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

function loadInitial(): NotificationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as NotificationRecord[];
  } catch {
    // fall through to default
  }
  return [
    {
      id: "welcome-1",
      title: "Welcome to Prompt Mint",
      message:
        "Explore encrypted AI prompt licensing powered by Stellar smart contracts.",
      type: "primary",
      isRead: false,
      createdAt: Date.now() - 3600000,
      isVisible: false,
      category: "system",
    },
  ];
}

function newId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const NotificationProvider: React.FC<{
  children: ReactNode;
  /** Optional real-time transport (polling today, WebSocket when available). */
  transport?: NotificationTransport;
}> = ({ children, transport }) => {
  const [notifications, dispatch] = useReducer(
    notificationsReducer,
    undefined,
    loadInitial,
  );
  const [toasts, setToasts] = useState<NotificationRecord[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore quota errors
    }
  }, [notifications]);

  const unreadCount = useMemo(
    () => selectUnreadCount(notifications),
    [notifications],
  );

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: "MARK_READ", id });
  }, []);

  const markAllAsRead = useCallback(() => {
    dispatch({ type: "MARK_ALL_READ" });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const trackClick = useCallback((id: string, link?: string) => {
    dispatch({ type: "TRACK_CLICK", id, link });
  }, []);

  const pushToast = useCallback((item: NotificationRecord) => {
    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, isVisible: false } : t)),
      );
    }, 2500);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== item.id));
    }, 5000);
  }, []);

  const addRecord = useCallback(
    (record: NotificationRecord, showToast: boolean) => {
      dispatch({ type: "ADD", item: record });
      if (showToast) pushToast(record);
    },
    [pushToast],
  );

  const addNotification = useCallback(
    (
      message: string,
      type: NotificationType = "primary",
      title?: string,
      link?: string,
      linkText?: string,
    ) => {
      addRecord(
        {
          id: newId(),
          title,
          message,
          type,
          isRead: false,
          createdAt: Date.now(),
          isVisible: true,
          link,
          linkText,
        },
        true,
      );
    },
    [addRecord],
  );

  const notifyEvent = useCallback(
    ({ category, message, title, dedupeKey, link, linkText }: NotifyEventInput) => {
      addRecord(
        {
          id: newId(),
          title,
          message,
          type: variantForCategory(category),
          isRead: false,
          createdAt: Date.now(),
          isVisible: true,
          category,
          dedupeKey,
          link,
          linkText,
        },
        true,
      );
    },
    [addRecord],
  );

  // Wire the injected transport (polling fallback / future WebSocket).
  const addRecordRef = useRef(addRecord);
  addRecordRef.current = addRecord;
  useEffect(() => {
    if (!transport) return;
    return transport.subscribe((incoming) => {
      const record: NotificationRecord = {
        ...incoming,
        isRead: incoming.isRead ?? false,
        isVisible: false,
      };
      addRecordRef.current(record, false);
      // Push is best-effort (#751): when the browser cannot show one, the
      // record is surfaced in-app instead so the notification is never lost.
      // The store dedupes by id, so this cannot create a second entry.
      void deliverPushOrFallback(record, {
        onInAppFallback: (fallbackRecord) => {
          addRecordRef.current(fallbackRecord, true);
        },
      });
    });
  }, [transport]);

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      notifyEvent,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      trackClick,
    }),
    [
      notifications,
      unreadCount,
      addNotification,
      notifyEvent,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      trackClick,
    ],
  );

  return (
    <NotificationContext value={contextValue}>
      {children}
      <div className="notification-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`notification ${toast.isVisible ? "slide-in" : "slide-out"}`}
          >
            <StellarNotification
              title={
                toast.title ? `${toast.title}: ${toast.message}` : toast.message
              }
              variant={toast.type === "secondary" ? "primary" : (toast.type as "primary" | "success" | "error" | "warning")}
            />
          </div>
        ))}
      </div>
    </NotificationContext>
  );
};

export { NotificationContext };
