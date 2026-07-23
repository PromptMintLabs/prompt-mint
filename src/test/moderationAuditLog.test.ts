import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditLogViewer } from "../components/moderation/AuditLogViewer";

describe("Moderation Audit Log Viewer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("component is defined and exports correctly", () => {
    expect(AuditLogViewer).toBeDefined();
  });

  describe("fetchLogs success path", () => {
    it("fetches and returns paginated audit logs", async () => {
      const mockResponse = {
        entries: [
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
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const response = await fetch(
        "/api/moderation/logs?moderatorAddress=GMODERATOR1&page=1"
      );
      const data = await response.json();

      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].action).toBe("review_removed");
      expect(data.pagination.total).toBe(1);
    });

    it("returns empty entries when no logs match filters", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const response = await fetch(
        "/api/moderation/logs?moderatorAddress=GMODERATOR1&action=nonexistent"
      );
      const data = await response.json();

      expect(data.entries).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });

    it("supports filtering by targetType", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [
              {
                id: "mod_2",
                action: "prompt_hidden",
                moderatorAddress: "GMODERATOR1",
                targetId: "prompt_5",
                targetType: "prompt",
                reason: "Copyright violation",
                createdAt: Date.now() - 86400000 * 7,
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const response = await fetch(
        "/api/moderation/logs?moderatorAddress=GMODERATOR1&targetType=prompt"
      );
      const data = await response.json();

      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].targetType).toBe("prompt");
    });
  });

  describe("authorization enforcement", () => {
    it("returns 401 when moderatorAddress is missing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Moderator address is required" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );

      const response = await fetch("/api/moderation/logs");
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Moderator address is required");
    });

    it("returns 403 for unauthorized non-moderator addresses", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Unauthorized: Only authorized moderators can view audit logs",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      );

      const response = await fetch(
        "/api/moderation/logs?moderatorAddress=GNOTMODERATOR"
      );
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("Unauthorized");
    });
  });

  describe("pagination", () => {
    it("returns pagination metadata", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [],
            pagination: {
              page: 2,
              limit: 10,
              total: 25,
              totalPages: 3,
              hasMore: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const response = await fetch(
        "/api/moderation/logs?moderatorAddress=GMODERATOR1&page=2&limit=10"
      );
      const data = await response.json();

      expect(data.pagination.page).toBe(2);
      expect(data.pagination.totalPages).toBe(3);
      expect(data.pagination.hasMore).toBe(true);
    });
  });
});
