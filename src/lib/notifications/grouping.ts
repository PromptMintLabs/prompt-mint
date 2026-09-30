import {
  type NotificationRecord,
  type NotificationVariant,
  selectUnreadCount,
} from "./store";

export interface NotificationGroup {
  id: string;
  isGroup: true;
  promptId: string;
  promptTitle: string;
  items: NotificationRecord[];
  unreadCount: number;
  latestCreatedAt: number;
  isRead: boolean;
  type: NotificationVariant;
  category: "prompt_group";
}

export type NotificationDisplayItem =
  | (NotificationRecord & { isGroup?: false })
  | NotificationGroup;

/**
 * Checks if a display item is a grouped prompt container.
 */
export function isNotificationGroup(
  item: NotificationDisplayItem
): item is NotificationGroup {
  return "isGroup" in item && item.isGroup === true;
}

/**
 * Groups notifications by promptId when multiple notifications share the same prompt.
 * Single notifications without a promptId or with only 1 item remain individual records.
 */
export function groupNotificationsByPrompt(
  notifications: NotificationRecord[]
): NotificationDisplayItem[] {
  const promptMap = new Map<string, NotificationRecord[]>();
  const nonPromptItems: NotificationRecord[] = [];

  for (const item of notifications) {
    if (item.promptId) {
      const existing = promptMap.get(item.promptId) ?? [];
      existing.push(item);
      promptMap.set(item.promptId, existing);
    } else {
      nonPromptItems.push(item);
    }
  }

  const result: NotificationDisplayItem[] = [];

  for (const [promptId, items] of promptMap.entries()) {
    if (items.length === 1) {
      result.push(items[0]);
    } else {
      // Sort items within group by createdAt desc
      const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt);
      const unreadCount = selectUnreadCount(sortedItems);
      const latestCreatedAt = sortedItems[0].createdAt;
      const promptTitle =
        sortedItems.find((i) => i.promptTitle)?.promptTitle ||
        sortedItems[0].title ||
        `Prompt #${promptId}`;

      const primaryType: NotificationVariant = sortedItems.some(
        (i) => i.type === "error"
      )
        ? "error"
        : sortedItems.some((i) => i.type === "warning")
        ? "warning"
        : sortedItems.some((i) => i.type === "success")
        ? "success"
        : "primary";

      result.push({
        id: `group-prompt-${promptId}`,
        isGroup: true,
        promptId,
        promptTitle,
        items: sortedItems,
        unreadCount,
        latestCreatedAt,
        isRead: unreadCount === 0,
        type: primaryType,
        category: "prompt_group",
      });
    }
  }

  for (const item of nonPromptItems) {
    result.push(item);
  }

  // Sort final display list by latest timestamp
  return result.sort((a, b) => {
    const timeA = isNotificationGroup(a) ? a.latestCreatedAt : a.createdAt;
    const timeB = isNotificationGroup(b) ? b.latestCreatedAt : b.createdAt;
    return timeB - timeA;
  });
}
