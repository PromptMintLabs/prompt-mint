import { describe, it, expect } from "vitest";
import { groupNotificationsByPrompt, isNotificationGroup } from "./grouping";
import type { NotificationRecord } from "./store";

describe("Notification Prompt Grouping (Issue #747)", () => {
  const baseNotification: NotificationRecord = {
    id: "notif-1",
    message: "Your prompt was purchased",
    type: "success",
    isRead: false,
    createdAt: 1000,
  };

  it("leaves individual notifications without promptId ungrouped", () => {
    const items: NotificationRecord[] = [
      { ...baseNotification, id: "1", message: "System update" },
      { ...baseNotification, id: "2", message: "Welcome" },
    ];

    const result = groupNotificationsByPrompt(items);
    expect(result).toHaveLength(2);
    expect(isNotificationGroup(result[0])).toBe(false);
    expect(isNotificationGroup(result[1])).toBe(false);
  });

  it("leaves a single prompt notification ungrouped", () => {
    const items: NotificationRecord[] = [
      {
        ...baseNotification,
        id: "1",
        promptId: "prompt-100",
        promptTitle: "AI Art Generator",
      },
    ];

    const result = groupNotificationsByPrompt(items);
    expect(result).toHaveLength(1);
    expect(isNotificationGroup(result[0])).toBe(false);
  });

  it("collapses multiple notifications sharing the same promptId into a group", () => {
    const items: NotificationRecord[] = [
      {
        ...baseNotification,
        id: "1",
        promptId: "prompt-100",
        promptTitle: "AI Art Generator",
        createdAt: 1000,
        isRead: true,
      },
      {
        ...baseNotification,
        id: "2",
        promptId: "prompt-100",
        promptTitle: "AI Art Generator",
        createdAt: 2000,
        isRead: false,
      },
      {
        ...baseNotification,
        id: "3",
        promptId: "prompt-100",
        promptTitle: "AI Art Generator",
        createdAt: 3000,
        isRead: false,
      },
      {
        ...baseNotification,
        id: "4",
        promptId: "prompt-200",
        promptTitle: "Copywriting Prompt",
        createdAt: 1500,
      },
    ];

    const result = groupNotificationsByPrompt(items);
    expect(result).toHaveLength(2);

    const group = result.find((r) => isNotificationGroup(r) && r.promptId === "prompt-100");
    expect(group).toBeDefined();
    if (group && isNotificationGroup(group)) {
      expect(group.items).toHaveLength(3);
      expect(group.unreadCount).toBe(2);
      expect(group.isRead).toBe(false);
      expect(group.promptTitle).toBe("AI Art Generator");
      expect(group.latestCreatedAt).toBe(3000);
    }
  });

  it("marks group as read when all child notifications are read", () => {
    const items: NotificationRecord[] = [
      { ...baseNotification, id: "1", promptId: "prompt-1", isRead: true },
      { ...baseNotification, id: "2", promptId: "prompt-1", isRead: true },
    ];

    const result = groupNotificationsByPrompt(items);
    expect(result).toHaveLength(1);
    expect(isNotificationGroup(result[0])).toBe(true);
    if (isNotificationGroup(result[0])) {
      expect(result[0].unreadCount).toBe(0);
      expect(result[0].isRead).toBe(true);
    }
  });
});
