import { describe, it, expect, vi } from "vitest";
import {
  deliverPushOrFallback,
  isPushSupported,
  getPushPermissionStatus,
  requestPushPermission,
  type PushNotificationCtor,
} from "./push";
import type { NotificationRecord } from "./store";

function makeRecord(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id: "n1",
    title: "New follower",
    message: "Ada started following you",
    type: "secondary",
    isRead: false,
    createdAt: 1,
    category: "follower",
    dedupeKey: "follower:ada",
    ...overrides,
  };
}

/** Constructor whose permission is fixed and which records every call. */
function makeCtor(permission: NotificationPermission, throwOnShow = false) {
  const calls: Array<[string, NotificationOptions | undefined]> = [];
  class FakePush {
    static permission: NotificationPermission = permission;
    constructor(title: string, options?: NotificationOptions) {
      calls.push([title, options]);
      if (throwOnShow) throw new Error("push rejected by the browser");
    }
  }
  return { ctor: FakePush as unknown as PushNotificationCtor, calls };
}

describe("deliverPushOrFallback", () => {
  it("falls back to in-app when the Notification API is unavailable", async () => {
    const record = makeRecord();
    const onInAppFallback = vi.fn();

    const result = await deliverPushOrFallback(record, {
      notificationCtor: null,
      onInAppFallback,
    });

    expect(result).toEqual({ outcome: "in_app_fallback", reason: "unsupported" });
    expect(onInAppFallback).toHaveBeenCalledWith(record, "unsupported");
  });

  it("falls back when permission is still default and no prompt is provided", async () => {
    const { ctor } = makeCtor("default");
    const onInAppFallback = vi.fn();

    const result = await deliverPushOrFallback(makeRecord(), {
      notificationCtor: ctor,
      onInAppFallback,
    });

    expect(result).toEqual({
      outcome: "in_app_fallback",
      reason: "permission_default",
    });
    expect(onInAppFallback).toHaveBeenCalledTimes(1);
  });

  it("asks for permission once and pushes when it is granted", async () => {
    const record = makeRecord();
    const { ctor, calls } = makeCtor("default");
    const requestPermission = vi.fn(async () => "granted" as const);
    const onInAppFallback = vi.fn();

    const result = await deliverPushOrFallback(record, {
      notificationCtor: ctor,
      requestPermission,
      onInAppFallback,
    });

    expect(result).toEqual({ outcome: "pushed" });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(onInAppFallback).not.toHaveBeenCalled();
    expect(calls).toEqual([
      [
        "New follower",
        { body: "Ada started following you", tag: "follower:ada" },
      ],
    ]);
  });

  it("falls back when the permission request is rejected", async () => {
    const { ctor, calls } = makeCtor("default");
    const onInAppFallback = vi.fn();

    const result = await deliverPushOrFallback(makeRecord(), {
      notificationCtor: ctor,
      requestPermission: async () => {
        throw new Error("dismissed");
      },
      onInAppFallback,
    });

    expect(result).toEqual({
      outcome: "in_app_fallback",
      reason: "permission_denied",
    });
    expect(calls).toHaveLength(0);
    expect(onInAppFallback).toHaveBeenCalledTimes(1);
  });

  it("falls back when permission was denied", async () => {
    const { ctor, calls } = makeCtor("denied");

    const result = await deliverPushOrFallback(makeRecord(), {
      notificationCtor: ctor,
    });

    expect(result).toEqual({
      outcome: "in_app_fallback",
      reason: "permission_denied",
    });
    expect(calls).toHaveLength(0);
  });

  it("falls back when the granted push constructor throws", async () => {
    const record = makeRecord();
    const { ctor, calls } = makeCtor("granted", true);
    const onInAppFallback = vi.fn();

    const result = await deliverPushOrFallback(record, {
      notificationCtor: ctor,
      onInAppFallback,
    });

    expect(calls).toHaveLength(1);
    expect(result).toEqual({
      outcome: "in_app_fallback",
      reason: "show_failed",
    });
    expect(onInAppFallback).toHaveBeenCalledWith(record, "show_failed");
  });

  it("uses the record id as the tag when there is no dedupe key", async () => {
    const { ctor, calls } = makeCtor("granted");

    await deliverPushOrFallback(makeRecord({ dedupeKey: undefined }), {
      notificationCtor: ctor,
    });

    expect(calls[0][1]?.tag).toBe("n1");
  });
});

describe("Push Permission Helpers (#750)", () => {
  it("detects push support correctly", () => {
    const { ctor } = makeCtor("granted");
    expect(isPushSupported(ctor)).toBe(true);
    expect(isPushSupported(null)).toBe(false);
  });

  it("retrieves current permission status", () => {
    const { ctor: grantedCtor } = makeCtor("granted");
    const { ctor: deniedCtor } = makeCtor("denied");

    expect(getPushPermissionStatus(grantedCtor)).toBe("granted");
    expect(getPushPermissionStatus(deniedCtor)).toBe("denied");
    expect(getPushPermissionStatus(null)).toBe("unsupported");
  });

  it("requests permission using provided requester", async () => {
    const customRequester = vi.fn(async () => "granted" as NotificationPermission);

    const result = await requestPushPermission(customRequester);
    expect(result).toBe("granted");
    expect(customRequester).toHaveBeenCalledTimes(1);
  });
});


