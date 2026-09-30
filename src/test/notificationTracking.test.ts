import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notificationsReducer,
  setNotificationClickTracker,
  trackNotificationClick,
  type NotificationRecord,
} from "../lib/notifications/store";

describe("Notification Click Tracking (#749)", () => {
  const baseItem: NotificationRecord = {
    id: "notif-101",
    title: "Sale Confirmed",
    message: "A buyer purchased your prompt #42.",
    type: "success",
    isRead: false,
    createdAt: Date.now() - 5000,
    link: "https://promptmint.io/orders/42",
    linkText: "View Order",
  };

  beforeEach(() => {
    setNotificationClickTracker(null);
  });

  it("updates notification state on TRACK_CLICK action", () => {
    const initialState = [baseItem];
    const newState = notificationsReducer(initialState, {
      type: "TRACK_CLICK",
      id: "notif-101",
      link: "https://promptmint.io/orders/42",
    });

    expect(newState).toHaveLength(1);
    expect(newState[0].isClicked).toBe(true);
    expect(newState[0].isRead).toBe(true);
    expect(typeof newState[0].clickedAt).toBe("number");
    expect(newState[0].link).toBe("https://promptmint.io/orders/42");
  });

  it("attaches link on TRACK_CLICK if notification did not already have one", () => {
    const noLinkItem: NotificationRecord = {
      ...baseItem,
      id: "notif-102",
      link: undefined,
    };
    const newState = notificationsReducer([noLinkItem], {
      type: "TRACK_CLICK",
      id: "notif-102",
      link: "https://promptmint.io/details",
    });

    expect(newState[0].isClicked).toBe(true);
    expect(newState[0].link).toBe("https://promptmint.io/details");
  });

  it("invokes global tracker callback when trackNotificationClick is called", () => {
    const trackerSpy = vi.fn();
    setNotificationClickTracker(trackerSpy);

    trackNotificationClick(baseItem, "https://promptmint.io/orders/42");
    expect(trackerSpy).toHaveBeenCalledTimes(1);
    expect(trackerSpy).toHaveBeenCalledWith(
      baseItem,
      "https://promptmint.io/orders/42",
    );
  });

  it("safely ignores errors in tracker callback without throwing", () => {
    const throwingTracker = vi.fn(() => {
      throw new Error("Analytics offline");
    });
    setNotificationClickTracker(throwingTracker);

    expect(() => {
      trackNotificationClick(baseItem, "https://promptmint.io/orders/42");
    }).not.toThrow();
  });
});
