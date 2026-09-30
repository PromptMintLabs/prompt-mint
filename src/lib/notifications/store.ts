/**
 * Pure notification store logic (#283).
 *
 * Kept framework-free so the reducer + selectors can be unit tested without a
 * DOM. The React provider (src/providers/NotificationProvider.tsx) delegates its
 * state transitions here so behaviour (mark-read, unread-count, add/dedupe) has
 * a single tested source of truth.
 */

export type NotificationVariant =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning";

/**
 * Product event categories the notification center surfaces.
 */
export type NotificationCategory =
  | "purchase"
  | "expiry"
  | "price"
  | "follower"
  | "system";

export interface NotificationRecord {
  id: string;
  title?: string;
  message: string;
  type: NotificationVariant;
  isRead: boolean;
  createdAt: number;
  isVisible?: boolean;
  category?: NotificationCategory;
  /**
   * Optional URL for click-through actions (#749).
   */
  link?: string;
  /**
   * Optional custom label for the action link (#749).
   */
  linkText?: string;
  /**
   * Whether the user has clicked the notification or its tracking link (#749).
   */
  isClicked?: boolean;
  /**
   * Timestamp when the click was recorded (#749).
   */
  clickedAt?: number;
  /**
   * Optional idempotency key. When present, adding a record whose key matches
   * an existing record is a no-op (prevents duplicate purchase/price alerts
   * from repeated transport deliveries).
   */
  dedupeKey?: string;
  /** Associated prompt identifier for grouping (#747). */
  promptId?: string;
  /** Associated prompt title for group headers (#747). */
  promptTitle?: string;
  /** Importance classification (#746). */
  importance?: "critical" | "high" | "medium" | "low";
  /** Numerical score 0-100 (#746). */
  importanceScore?: number;
}

export type NotificationAction =
  | { type: "ADD"; item: NotificationRecord }
  | { type: "MARK_READ"; id: string }
  | { type: "MARK_ALL_READ" }
  | { type: "TRACK_CLICK"; id: string; link?: string }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: NotificationRecord[] };

/** Maps a product category to its default visual variant. */
export function variantForCategory(
  category: NotificationCategory,
): NotificationVariant {
  switch (category) {
    case "purchase":
      return "success";
    case "expiry":
      return "warning";
    case "price":
      return "primary";
    case "follower":
      return "secondary";
    default:
      return "primary";
  }
}

export type NotificationClickTracker = (
  record: NotificationRecord,
  link?: string,
) => void;

let globalClickTracker: NotificationClickTracker | null = null;

export function setNotificationClickTracker(
  tracker: NotificationClickTracker | null,
): void {
  globalClickTracker = tracker;
}

export function trackNotificationClick(
  record: NotificationRecord,
  link?: string,
): void {
  if (globalClickTracker) {
    try {
      globalClickTracker(record, link);
    } catch {
      // Tracker errors should not crash notification flow
    }
  }
}

function isDuplicate(
  items: NotificationRecord[],
  candidate: NotificationRecord,
): boolean {
  return items.some(
    (existing) =>
      existing.id === candidate.id ||
      (candidate.dedupeKey != null &&
        existing.dedupeKey === candidate.dedupeKey),
  );
}

export function notificationsReducer(
  state: NotificationRecord[],
  action: NotificationAction,
): NotificationRecord[] {
  switch (action.type) {
    case "ADD":
      if (isDuplicate(state, action.item)) return state;
      return [action.item, ...state];
    case "MARK_READ":
      return state.map((n) =>
        n.id === action.id ? { ...n, isRead: true } : n,
      );
    case "MARK_ALL_READ":
      return state.map((n) => (n.isRead ? n : { ...n, isRead: true }));
    case "TRACK_CLICK":
      return state.map((n) =>
        n.id === action.id
          ? {
              ...n,
              isClicked: true,
              clickedAt: Date.now(),
              isRead: true,
              ...(action.link && !n.link ? { link: action.link } : {}),
            }
          : n,
      );
    case "CLEAR":
      return [];
    case "HYDRATE":
      return action.items;
    default:
      return state;
  }
}

export function selectUnreadCount(items: NotificationRecord[]): number {
  return items.reduce((count, n) => (n.isRead ? count : count + 1), 0);
}

