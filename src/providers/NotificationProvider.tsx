import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { Notification as StellarNotification } from "@stellar/design-system";
import "./NotificationProvider.css";

export type NotificationType =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning";

export interface NotificationItem {
  id: string;
  title?: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: number;
  isVisible?: boolean;
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (message: string, type?: NotificationType, title?: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const STORAGE_KEY = "prompt_mint_notifications_center_v1";

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return [
      {
        id: "welcome-1",
        title: "Welcome to Prompt Mint",
        message: "Explore encrypted AI prompt licensing powered by Stellar smart contracts.",
        type: "primary",
        isRead: false,
        createdAt: Date.now() - 3600000,
        isVisible: false,
      },
    ];
  });

  const [toasts, setToasts] = useState<NotificationItem[]>([]);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore quota errors
    }
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const addNotification = useCallback(
    (message: string, type: NotificationType = "primary", title?: string) => {
      const newItem: NotificationItem = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        message,
        type,
        isRead: false,
        createdAt: Date.now(),
        isVisible: true,
      };

      setNotifications((prev) => [newItem, ...prev]);

      // Add to toast banner list
      setToasts((prev) => [...prev, newItem]);

      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === newItem.id ? { ...t, isVisible: false } : t))
        );
      }, 2500);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newItem.id));
      }, 5000);
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearNotifications,
    }),
    [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearNotifications]
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
              title={toast.title ? `${toast.title}: ${toast.message}` : toast.message}
              variant={toast.type}
            />
          </div>
        ))}
      </div>
    </NotificationContext>
  );
};

export { NotificationContext };
