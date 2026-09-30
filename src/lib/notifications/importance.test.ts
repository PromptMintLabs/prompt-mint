import { describe, it, expect } from "vitest";
import {
  calculateImportanceScore,
  sortNotificationsByImportance,
  filterHighImportance,
} from "./importance";
import type { NotificationRecord } from "./store";

describe("Notification Importance Scoring Model (Issue #746)", () => {
  const now = 1700000000000;

  it("assigns higher scores to purchase and error notifications", () => {
    const purchaseNotif: NotificationRecord = {
      id: "p1",
      message: "Prompt purchased for 50 XLM",
      type: "success",
      category: "purchase",
      isRead: false,
      createdAt: now,
    };

    const followerNotif: NotificationRecord = {
      id: "f1",
      message: "User X followed your profile",
      type: "secondary",
      category: "follower",
      isRead: true,
      createdAt: now,
    };

    const purchaseEval = calculateImportanceScore(purchaseNotif, now);
    const followerEval = calculateImportanceScore(followerNotif, now);

    expect(purchaseEval.score).toBeGreaterThan(followerEval.score);
    expect(purchaseEval.tier).toBe("critical");
    expect(followerEval.tier).toBe("low");
  });

  it("applies time decay to older notifications", () => {
    const freshNotif: NotificationRecord = {
      id: "fresh",
      message: "License expiring soon",
      type: "warning",
      category: "expiry",
      isRead: false,
      createdAt: now,
    };

    const oldNotif: NotificationRecord = {
      ...freshNotif,
      id: "old",
      createdAt: now - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    };

    const freshEval = calculateImportanceScore(freshNotif, now);
    const oldEval = calculateImportanceScore(oldNotif, now);

    expect(freshEval.score).toBeGreaterThan(oldEval.score);
  });

  it("sorts notification list by importance score", () => {
    const items: NotificationRecord[] = [
      {
        id: "low",
        message: "New follower",
        type: "secondary",
        category: "follower",
        isRead: true,
        createdAt: now,
      },
      {
        id: "critical",
        message: "Prompt purchased",
        type: "success",
        category: "purchase",
        isRead: false,
        createdAt: now - 1000,
      },
      {
        id: "medium",
        message: "Price alert",
        type: "primary",
        category: "price",
        isRead: true,
        createdAt: now,
      },
    ];

    const sorted = sortNotificationsByImportance(items, now);
    expect(sorted[0].id).toBe("critical");
    expect(sorted[sorted.length - 1].id).toBe("low");
  });

  it("filters high and critical importance notifications", () => {
    const items: NotificationRecord[] = [
      {
        id: "p1",
        message: "Prompt purchased",
        type: "success",
        category: "purchase",
        isRead: false,
        createdAt: now,
      },
      {
        id: "f1",
        message: "New follower",
        type: "secondary",
        category: "follower",
        isRead: true,
        createdAt: now,
      },
    ];

    const highImportant = filterHighImportance(items, now);
    expect(highImportant).toHaveLength(1);
    expect(highImportant[0].id).toBe("p1");
  });
});
