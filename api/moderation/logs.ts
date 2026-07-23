const MODERATOR_ADDRESSES = (process.env.MODERATOR_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

export interface ModerationLogEntry {
  id: string;
  action: string;
  moderatorAddress: string;
  targetId: string;
  targetType: "prompt" | "review" | "user";
  reason: string;
  details?: string;
  createdAt: number;
}

const mockLogs: ModerationLogEntry[] = [
  {
    id: "mod_1",
    action: "review_removed",
    moderatorAddress: "GMODERATOR1",
    targetId: "review_2",
    targetType: "review",
    reason: "Inappropriate content",
    details: "Review contained offensive language",
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: "mod_2",
    action: "prompt_hidden",
    moderatorAddress: "GMODERATOR1",
    targetId: "prompt_5",
    targetType: "prompt",
    reason: "Copyright violation",
    details: "Prompt contained copyrighted material from third party",
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: "mod_3",
    action: "user_warned",
    moderatorAddress: "GMODERATOR2",
    targetId: "GUSER12345",
    targetType: "user",
    reason: "Repeated policy violations",
    details: "User warned for submitting spam reviews",
    createdAt: Date.now() - 86400000 * 1,
  },
];

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

  if (
    MODERATOR_ADDRESSES.length > 0 &&
    !MODERATOR_ADDRESSES.includes(moderatorAddress.toLowerCase())
  ) {
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
    let filtered = [...mockLogs];

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
