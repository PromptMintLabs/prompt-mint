export type ModerationTemplateAction =
  | "report_resolved"
  | "report_dismissed"
  | "prompt_takedown"
  | "prompt_reinstated";

export interface CustomModerationActionTemplate {
  id: string;
  action: ModerationTemplateAction;
  name: string;
  reason: string;
}

export interface ModerationActionTemplate extends CustomModerationActionTemplate {
  source: "built-in" | "custom";
}

const STORAGE_PREFIX = "prompt-mint:moderation-action-templates:v1";

const ACTIONS: ModerationTemplateAction[] = [
  "report_resolved",
  "report_dismissed",
  "prompt_takedown",
  "prompt_reinstated",
];

const BUILT_IN_DEFINITIONS: Array<{
  id: string;
  action: ModerationTemplateAction;
  nameKey: string;
  reasonKey: string;
}> = [
  {
    id: "builtin-report-resolved",
    action: "report_resolved",
    nameKey: "report_resolved_name",
    reasonKey: "report_resolved_reason",
  },
  {
    id: "builtin-report-dismissed",
    action: "report_dismissed",
    nameKey: "report_dismissed_name",
    reasonKey: "report_dismissed_reason",
  },
  {
    id: "builtin-prompt-takedown",
    action: "prompt_takedown",
    nameKey: "prompt_takedown_name",
    reasonKey: "prompt_takedown_reason",
  },
  {
    id: "builtin-prompt-reinstated",
    action: "prompt_reinstated",
    nameKey: "prompt_reinstated_name",
    reasonKey: "prompt_reinstated_reason",
  },
];

function storageKey(moderatorAddress: string): string {
  return `${STORAGE_PREFIX}:${moderatorAddress.toLowerCase()}`;
}

function isTemplate(value: unknown): value is CustomModerationActionTemplate {
  if (!value || typeof value !== "object") return false;
  const template = value as Partial<CustomModerationActionTemplate>;
  return (
    typeof template.id === "string" &&
    typeof template.name === "string" &&
    typeof template.reason === "string" &&
    ACTIONS.includes(template.action as ModerationTemplateAction)
  );
}

function readCustomTemplates(moderatorAddress: string): CustomModerationActionTemplate[] {
  if (!moderatorAddress || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(moderatorAddress));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isTemplate) : [];
  } catch {
    return [];
  }
}

function writeCustomTemplates(
  moderatorAddress: string,
  templates: CustomModerationActionTemplate[],
): boolean {
  if (!moderatorAddress || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey(moderatorAddress), JSON.stringify(templates));
    return true;
  } catch {
    return false;
  }
}

export function getBuiltInModerationActionTemplates(
  translate: (key: string) => string,
): ModerationActionTemplate[] {
  return BUILT_IN_DEFINITIONS.map((definition) => ({
    ...definition,
    name: translate(`errors.moderation.action_templates.defaults.${definition.nameKey}`),
    reason: translate(`errors.moderation.action_templates.defaults.${definition.reasonKey}`),
    source: "built-in",
  }));
}

export function listCustomModerationActionTemplates(
  moderatorAddress: string,
): CustomModerationActionTemplate[] {
  return readCustomTemplates(moderatorAddress);
}

export function saveCustomModerationActionTemplate(
  moderatorAddress: string,
  template: Omit<CustomModerationActionTemplate, "id">,
): CustomModerationActionTemplate | null {
  const name = template.name.trim();
  const reason = template.reason.trim();
  if (
    !moderatorAddress ||
    !ACTIONS.includes(template.action) ||
    !name ||
    name.length > 80 ||
    !reason ||
    reason.length > 1000
  ) {
    return null;
  }

  const saved: CustomModerationActionTemplate = {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    action: template.action,
    name,
    reason,
  };
  const templates = readCustomTemplates(moderatorAddress);
  templates.push(saved);
  return writeCustomTemplates(moderatorAddress, templates) ? saved : null;
}

export function deleteCustomModerationActionTemplate(
  moderatorAddress: string,
  templateId: string,
): boolean {
  const templates = readCustomTemplates(moderatorAddress);
  const remaining = templates.filter((template) => template.id !== templateId);
  return remaining.length !== templates.length && writeCustomTemplates(moderatorAddress, remaining);
}