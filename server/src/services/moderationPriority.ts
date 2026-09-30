export type ModerationPriorityLevel = "critical" | "high" | "medium" | "low";

export interface ModerationPriorityInput {
  reason: string;
  createdAt: Date | string | number;
  now?: Date | string | number;
}

export interface ModerationPriority {
  score: number;
  level: ModerationPriorityLevel;
  reasonWeight: number;
  ageBonus: number;
}

const REASON_WEIGHTS: Record<string, number> = {
  "harmful-content": 100,
  copyright: 90,
  plagiarism: 85,
  "misleading-content": 65,
  "quality-issue": 40,
  other: 20,
};

const MAX_AGE_BONUS = 30;
const AGE_BONUS_PER_DAY = 5;

function toTimestamp(value: Date | string | number) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function getModerationPriority({ reason, createdAt, now = Date.now() }: ModerationPriorityInput): ModerationPriority {
  const reasonWeight = REASON_WEIGHTS[reason] ?? REASON_WEIGHTS.other;
  const ageInDays = Math.max(0, toTimestamp(now) - toTimestamp(createdAt)) / (24 * 60 * 60 * 1000);
  const ageBonus = Math.min(MAX_AGE_BONUS, Math.floor(ageInDays * AGE_BONUS_PER_DAY));
  const score = reasonWeight + ageBonus;

  return {
    score,
    level: score >= 100 ? "critical" : score >= 75 ? "high" : score >= 45 ? "medium" : "low",
    reasonWeight,
    ageBonus,
  };
}

export function compareModerationPriority(
  a: ModerationPriorityInput,
  b: ModerationPriorityInput,
): number {
  const now = a.now ?? b.now ?? Date.now();
  const priorityDifference =
    getModerationPriority({ ...b, now }).score - getModerationPriority({ ...a, now }).score;

  if (priorityDifference !== 0) return priorityDifference;
  return toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
}