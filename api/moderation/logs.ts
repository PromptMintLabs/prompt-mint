import { getModerationLogs, isAuthorizedModerator } from "./data";
export type { ModerationLogEntry } from "./data";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const moderatorAddress = (req.query.moderatorAddress as string) ?? "";

  if (!moderatorAddress) {
    res.status(401).json({ error: "Moderator address is required" });
    return;
  }

  if (!isAuthorizedModerator(moderatorAddress)) {
    res.status(403).json({
      error: "Unauthorized: Only authorized moderators can view audit logs",
    });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const action = (req.query.action as string) ?? "";
  const targetType = (req.query.targetType as string) ?? "";
  const since = req.query.since ? parseInt(req.query.since as string) : 0;

  try {
    let filtered = [...getModerationLogs()];

    if (action) {
      filtered = filtered.filter((l) => l.action === action);
    }
    if (targetType) {
      filtered = filtered.filter((l) => l.targetType === targetType);
    }
    if (since) {
      filtered = filtered.filter((l) => l.createdAt >= since);
    }

    filtered.sort((a, b) => b.createdAt - a.createdAt);

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const entries = filtered.slice(start, start + limit);

    res.status(200).json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch audit logs";
    console.error("Moderation logs error:", message);
    res.status(500).json({ error: message });
  }
}
