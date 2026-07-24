export interface ModerationLogEntry {
  id: string;
  action: "review_removed" | "review_approved" | "user_warned";
  moderatorAddress: string;
  targetId: string;
  targetType: "review" | "user";
  reason: string;
  details?: string;
  createdAt: number;
}

const logs: ModerationLogEntry[] = [];

export function addModerationLog(entry: Omit<ModerationLogEntry, "id" | "createdAt">): ModerationLogEntry {
  const stored = { ...entry, id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() };
  logs.push(stored);
  return stored;
}

export function getModerationLogs(): ModerationLogEntry[] {
  return logs;
}

export function isAuthorizedModerator(address: string): boolean {
  const configured = (process.env.MODERATOR_ADDRESSES ?? "")
    .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  // Failing closed prevents an unconfigured deployment from granting moderation authority.
  return configured.length > 0 && configured.includes(address.toLowerCase());
}
