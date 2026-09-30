import { useState, useEffect } from "react";

export interface ExperimentVariant<T = Record<string, unknown>> {
  id: string;
  weight: number; // 0 to 100
  config: T;
}

export interface ExperimentDefinition<T = Record<string, unknown>> {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  variants: ExperimentVariant<T>[];
}

// Built-in notification experiments
export const NOTIFICATION_EXPERIMENTS: Record<string, ExperimentDefinition<any>> = {
  notification_grouping: {
    key: "notification_grouping",
    name: "Prompt-based Notification Grouping",
    description: "Tests collapsed accordion grouping by prompt vs flat list",
    enabled: true,
    variants: [
      { id: "control", weight: 50, config: { groupByType: false, defaultExpanded: true } },
      { id: "collapsed_by_prompt", weight: 50, config: { groupByType: true, defaultExpanded: false } },
    ],
  },
  importance_highlight: {
    key: "importance_highlight",
    name: "Importance Scoring & Badging",
    description: "Tests dynamic importance scoring badge and sorting",
    enabled: true,
    variants: [
      { id: "control", weight: 50, config: { showImportanceBadge: false, sortByImportance: false } },
      { id: "highlighted", weight: 50, config: { showImportanceBadge: true, sortByImportance: true } },
    ],
  },
  email_digest_preferences: {
    key: "email_digest_preferences",
    name: "Email Digest Frequency Option",
    description: "Tests smart digest vs instant email notifications",
    enabled: true,
    variants: [
      { id: "instant", weight: 50, config: { defaultCadence: "instant" } },
      { id: "smart_digest", weight: 50, config: { defaultCadence: "digest_24h" } },
    ],
  },
};

/**
 * Deterministic hash (FNV-1a) mapping subject + experiment key to 0-99 bucket.
 */
export function hashToBucket(subject: string, experimentKey: string): number {
  const input = `${experimentKey}:${subject.toLowerCase().trim()}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 100);
}

/**
 * Assigns a variant for a subject given an experiment definition.
 */
export function assignVariant<T = Record<string, unknown>>(
  experiment: ExperimentDefinition<T>,
  subjectId: string = "anonymous"
): ExperimentVariant<T> {
  if (!experiment.enabled || experiment.variants.length === 0) {
    return experiment.variants[0];
  }

  const bucket = hashToBucket(subjectId, experiment.key);
  let cumulativeWeight = 0;

  for (const variant of experiment.variants) {
    cumulativeWeight += variant.weight;
    if (bucket < cumulativeWeight) {
      return variant;
    }
  }

  return experiment.variants[0];
}

const IMPRESSIONS_STORAGE_KEY = "prompt_mint_notification_experiment_impressions";

/**
 * Records an experiment impression in local storage for conversion auditing.
 */
export function recordExperimentImpression(
  experimentKey: string,
  variantId: string,
  subjectId: string
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(IMPRESSIONS_STORAGE_KEY);
    const impressions = raw ? (JSON.parse(raw) as Record<string, { variantId: string; timestamp: number }>) : {};
    impressions[`${experimentKey}:${subjectId}`] = {
      variantId,
      timestamp: Date.now(),
    };
    localStorage.setItem(IMPRESSIONS_STORAGE_KEY, JSON.stringify(impressions));
  } catch {
    // Ignore storage quota limits
  }
}

/**
 * React hook to retrieve active experiment variant for a subject.
 */
export function useNotificationExperiment<T = Record<string, unknown>>(
  experimentKey: string,
  subjectId: string = "default_user"
): { variantId: string; config: T } {
  const experiment = NOTIFICATION_EXPERIMENTS[experimentKey] as ExperimentDefinition<T> | undefined;

  const [assignment, setAssignment] = useState(() => {
    if (!experiment) {
      return { variantId: "control", config: {} as T };
    }
    const variant = assignVariant(experiment, subjectId);
    return { variantId: variant.id, config: variant.config };
  });

  useEffect(() => {
    if (!experiment) return;
    const variant = assignVariant(experiment, subjectId);
    setAssignment({ variantId: variant.id, config: variant.config });
    recordExperimentImpression(experiment.key, variant.id, subjectId);
  }, [experimentKey, subjectId]);

  return assignment;
}
