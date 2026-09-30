/**
 * Push notification delivery with an in-app fallback (#751).
 *
 * The notification center is the record of what a user has been told, so a
 * push is strictly best-effort. Whenever the browser cannot show one — the
 * Notification API is missing, permission was never granted or was denied, or
 * the constructor throws — the caller is handed the record back so it can be
 * surfaced in-app instead. A dropped push must never mean a dropped
 * notification.
 *
 * Every browser global this touches is injectable, so the delivery policy is
 * unit-testable without a DOM.
 */

import type { NotificationRecord } from "./store";

/** Minimal constructor shape, so tests can pass a fake. */
export interface PushNotificationCtor {
  permission: NotificationPermission;
  new (title: string, options?: NotificationOptions): unknown;
}

/** Why a push was not shown. Safe to log — carries no user data. */
export type PushFallbackReason =
  | "unsupported"
  | "permission_default"
  | "permission_denied"
  | "show_failed";

export type PushDeliveryOutcome = "pushed" | "in_app_fallback";

export interface PushDeliveryResult {
  outcome: PushDeliveryOutcome;
  reason?: PushFallbackReason;
}

export interface PushDeliveryOptions {
  /**
   * Push constructor to use. Defaults to the global `Notification` when one
   * exists; pass `null` explicitly to simulate an environment without it.
   */
  notificationCtor?: PushNotificationCtor | null;
  /**
   * Called when permission is still `default`. The caller decides whether to
   * prompt — a permission request should follow a user gesture, not a timer.
   */
  requestPermission?: () => Promise<NotificationPermission>;
  /**
   * Invoked only when the push could not be shown, so the record can be
   * surfaced in the in-app notification center instead.
   */
  onInAppFallback?: (
    record: NotificationRecord,
    reason: PushFallbackReason,
  ) => void;
}

function resolveCtor(
  options: PushDeliveryOptions,
): PushNotificationCtor | null {
  if ("notificationCtor" in options) return options.notificationCtor ?? null;
  return typeof Notification !== "undefined"
    ? (Notification as unknown as PushNotificationCtor)
    : null;
}

function fallback(
  record: NotificationRecord,
  options: PushDeliveryOptions,
  reason: PushFallbackReason,
): PushDeliveryResult {
  options.onInAppFallback?.(record, reason);
  return { outcome: "in_app_fallback", reason };
}

/**
 * Returns true if push notification is supported in the current environment (#750).
 */
export function isPushSupported(ctor?: PushNotificationCtor | null): boolean {
  if (ctor !== undefined) return ctor !== null;
  return typeof Notification !== "undefined";
}

/**
 * Returns the current push notification permission status (#750).
 */
export function getPushPermissionStatus(
  ctor?: PushNotificationCtor | null,
): NotificationPermission | "unsupported" {
  const activeCtor =
    ctor !== undefined
      ? ctor
      : typeof Notification !== "undefined"
        ? (Notification as unknown as PushNotificationCtor)
        : null;

  if (!activeCtor) return "unsupported";
  return activeCtor.permission || "default";
}

/**
 * Requests push notification permission from the user (#750).
 */
export async function requestPushPermission(
  customRequester?: (() => Promise<NotificationPermission>) | null,
): Promise<NotificationPermission | "unsupported"> {
  if (customRequester) {
    try {
      return await customRequester();
    } catch {
      return "denied";
    }
  }

  if (typeof Notification === "undefined") {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return "denied";
  }
}

/**
 * Attempts a push for `record`, falling back to in-app delivery when the
 * browser cannot show one. Never throws: every failure is reported as an
 * `in_app_fallback` result carrying a reason.
 */
export async function deliverPushOrFallback(
  record: NotificationRecord,
  options: PushDeliveryOptions = {},
): Promise<PushDeliveryResult> {
  const ctor = resolveCtor(options);
  if (!ctor) return fallback(record, options, "unsupported");

  let permission = ctor.permission;
  if (permission === "default" && options.requestPermission) {
    try {
      permission = await options.requestPermission();
    } catch {
      permission = "denied";
    }
  }

  if (permission === "default") {
    return fallback(record, options, "permission_default");
  }
  if (permission !== "granted") {
    return fallback(record, options, "permission_denied");
  }

  try {
    new ctor(record.title ?? "Prompt Mint", {
      body: record.message,
      tag: record.dedupeKey ?? record.id,
    });
    return { outcome: "pushed" };
  } catch {
    return fallback(record, options, "show_failed");
  }
}

