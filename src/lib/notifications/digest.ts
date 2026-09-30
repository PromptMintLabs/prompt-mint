import {
  type NotificationCategory,
  type NotificationRecord,
} from "./store";
import { calculateImportanceScore } from "./importance";

export const DAILY_DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface DailyDigestGroup {
  category: NotificationCategory;
  count: number;
  unread: number;
  items: NotificationRecord[];
}

export interface DailyDigest {
  date: string;
  total: number;
  unread: number;
  groups: DailyDigestGroup[];
}

export interface BuildDailyDigestOptions {
  now?: number;
  windowMs?: number;
}

function scoreOf(item: NotificationRecord, now: number): number {
  return calculateImportanceScore(item, now).score;
}

/**
 * Builds a daily activity digest over notifications in [now - windowMs, now].
 *
 * Pure and framework-free: groups by category, orders items by importance
 * (ties broken by recency), and orders groups by their max item importance.
 */
export function buildDailyDigest(
  notifications: NotificationRecord[],
  options: BuildDailyDigestOptions = {},
): DailyDigest {
  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? DAILY_DIGEST_WINDOW_MS;
  const windowStart = now - windowMs;

  const inWindow = notifications.filter(
    (item) => item.createdAt >= windowStart && item.createdAt <= now,
  );

  const byCategory = new Map<NotificationCategory, NotificationRecord[]>();
  for (const item of inWindow) {
    const category = item.category ?? "system";
    const existing = byCategory.get(category) ?? [];
    existing.push(item);
    byCategory.set(category, existing);
  }

  const groups: DailyDigestGroup[] = [];
  for (const [category, items] of byCategory.entries()) {
    const sorted = [...items].sort((a, b) => {
      const scoreDiff = scoreOf(b, now) - scoreOf(a, now);
      if (scoreDiff !== 0) return scoreDiff;
      return b.createdAt - a.createdAt;
    });
    groups.push({
      category,
      count: sorted.length,
      unread: sorted.reduce((count, item) => (item.isRead ? count : count + 1), 0),
      items: sorted,
    });
  }

  groups.sort((a, b) => {
    const maxA = Math.max(...a.items.map((item) => scoreOf(item, now)));
    const maxB = Math.max(...b.items.map((item) => scoreOf(item, now)));
    return maxB - maxA;
  });

  return {
    date: new Date(now).toISOString().slice(0, 10),
    total: inWindow.length,
    unread: inWindow.reduce((count, item) => (item.isRead ? count : count + 1), 0),
    groups,
  };
}
