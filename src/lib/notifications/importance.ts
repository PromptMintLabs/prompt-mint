import { type NotificationRecord, type NotificationCategory } from "./store";

export type NotificationImportanceTier = "critical" | "high" | "medium" | "low";

export interface ImportanceEvaluation {
  score: number;
  tier: NotificationImportanceTier;
  factors: {
    categoryWeight: number;
    typeBonus: number;
    unreadBonus: number;
    timeDecayFactor: number;
  };
}

const CATEGORY_BASE_WEIGHTS: Record<NotificationCategory | "prompt_group", number> = {
  purchase: 85,
  expiry: 70,
  price: 55,
  system: 45,
  follower: 25,
  prompt_group: 60,
};

const HALF_LIFE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculates dynamic importance score (0-100) and tier for a notification.
 */
export function calculateImportanceScore(
  notification: NotificationRecord,
  now: number = Date.now()
): ImportanceEvaluation {
  const category = notification.category ?? "system";
  const categoryWeight = CATEGORY_BASE_WEIGHTS[category] ?? 40;

  let typeBonus = 0;
  if (notification.type === "error") typeBonus = 25;
  else if (notification.type === "warning") typeBonus = 15;
  else if (notification.type === "success") typeBonus = 10;

  const unreadBonus = notification.isRead ? 0 : 15;

  // Time decay calculation
  const ageMs = Math.max(0, now - notification.createdAt);
  const timeDecayFactor = Math.pow(0.5, ageMs / HALF_LIFE_MS);

  // Raw combined score
  const baseScore = categoryWeight + typeBonus + unreadBonus;
  // Blend decayed score with base minimum floor
  const score = Math.min(100, Math.max(0, Math.round(baseScore * (0.6 + 0.4 * timeDecayFactor))));

  let tier: NotificationImportanceTier = "low";
  if (score >= 80) tier = "critical";
  else if (score >= 60) tier = "high";
  else if (score >= 40) tier = "medium";

  return {
    score,
    tier,
    factors: {
      categoryWeight,
      typeBonus,
      unreadBonus,
      timeDecayFactor: Number(timeDecayFactor.toFixed(3)),
    },
  };
}

/**
 * Sorts notifications by importance score descending, with ties broken by recency.
 */
export function sortNotificationsByImportance(
  items: NotificationRecord[],
  now: number = Date.now()
): NotificationRecord[] {
  return [...items].sort((a, b) => {
    const scoreA = a.importanceScore ?? calculateImportanceScore(a, now).score;
    const scoreB = b.importanceScore ?? calculateImportanceScore(b, now).score;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return b.createdAt - a.createdAt;
  });
}

/**
 * Filters notifications matching a minimum importance threshold.
 */
export function filterHighImportance(
  items: NotificationRecord[],
  now: number = Date.now()
): NotificationRecord[] {
  return items.filter((item) => {
    const evaluation = calculateImportanceScore(item, now);
    return evaluation.tier === "critical" || evaluation.tier === "high";
  });
}
