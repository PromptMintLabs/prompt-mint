import { Request, Response } from "express";
import connectDb from "../db/connectDb";
import Notification from "../models/Notification";
import User from "../models/User";
import { AppError } from "../lib/AppError";
import { asyncRoute } from "../lib/asyncRoute";

function getWalletAddress(req: Request): string | null {
  const candidate =
    String(req.query.walletAddress || req.body.walletAddress || req.headers["x-user-address"] || "").trim();
  return candidate === "" ? null : candidate.toLowerCase();
}

export const GetNotifications = asyncRoute(async (req, res) => {
  await connectDb();
  const walletAddress = getWalletAddress(req);
  if (!walletAddress) {
    throw new AppError("walletAddress is required to fetch notifications.", 401, "UNAUTHENTICATED");
  }

  const user = await User.findOne({ walletAddress });
  if (!user) {
    throw new AppError("User not found.", 404, "NOT_FOUND");
  }
  const notifications = await Notification.find(
    { userId: user._id, read: false },
    undefined,
    { sort: { createdAt: -1 } },
  );

  res.json({ notifications });
});

export const MarkNotificationRead = asyncRoute(async (req, res) => {
  await connectDb();
  const walletAddress = getWalletAddress(req);
  if (!walletAddress) {
    throw new AppError("walletAddress is required to mark notifications read.", 401, "UNAUTHENTICATED");
  }

  const user = await User.findOne({ walletAddress });
  if (!user) {
    throw new AppError("User not found.", 404, "NOT_FOUND");
  }

  const { id } = req.params;
  if (!id) {
    throw new AppError("Notification id is required.", 400, "MISSING_FIELDS");
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId: user._id },
    { read: true },
    { new: true },
  );

  if (!notification) {
    throw new AppError("Notification not found.", 404, "NOT_FOUND");
  }

  res.json({ notification });
});

// ─── Notification history export (#752) ───────────────────────────────────────
//
// Downloads the caller's complete notification history (read and unread,
// newest first) as an attachment, in either CSV or JSON. Auth matches the
// other notification routes: the wallet address is resolved from the query,
// body, or `x-user-address` header and used to look up the owning user.

const NOTIFICATION_EXPORT_FORMATS = ["json", "csv"] as const;
type NotificationExportFormat = (typeof NOTIFICATION_EXPORT_FORMATS)[number];

const NOTIFICATION_EXPORT_COLUMNS = [
  "id",
  "promptId",
  "versionIndex",
  "walletAddress",
  "message",
  "read",
  "createdAt",
  "updatedAt",
] as const;

interface NotificationExportRow {
  _id?: unknown;
  promptId?: string;
  versionIndex?: number;
  walletAddress?: string;
  message?: string;
  read?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Quote cells containing a comma, quote, or line break (RFC 4180).
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildNotificationExportCsv(notifications: NotificationExportRow[]): string {
  const rows = notifications.map((notification) => [
    notification._id,
    notification.promptId,
    notification.versionIndex,
    notification.walletAddress,
    notification.message,
    notification.read,
    notification.createdAt,
    notification.updatedAt,
  ]);
  return [NOTIFICATION_EXPORT_COLUMNS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export const ExportNotifications = asyncRoute(async (req: Request, res: Response) => {
  await connectDb();

  const walletAddress = getWalletAddress(req);
  if (!walletAddress) {
    throw new AppError("walletAddress is required to export notifications.", 401, "UNAUTHENTICATED");
  }

  const requestedFormat = String(req.query.format || "json").trim().toLowerCase();
  if (!(NOTIFICATION_EXPORT_FORMATS as readonly string[]).includes(requestedFormat)) {
    throw new AppError('format must be either "json" or "csv".', 400, "INVALID_INPUT");
  }
  const format = requestedFormat as NotificationExportFormat;

  const user = await User.findOne({ walletAddress });
  if (!user) {
    throw new AppError("User not found.", 404, "NOT_FOUND");
  }

  // Unlike GET /api/notifications (unread only), the export returns the full
  // history for the wallet, newest first.
  const notifications = await Notification.find({ userId: user._id }, undefined, {
    sort: { createdAt: -1 },
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="notifications_${walletAddress}_${timestamp}.csv"`,
    );
    res.status(200).send(buildNotificationExportCsv(notifications));
    return;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="notifications_${walletAddress}_${timestamp}.json"`,
  );
  res.status(200).send(
    JSON.stringify(
      {
        walletAddress,
        exportedAt: new Date().toISOString(),
        count: notifications.length,
        notifications,
      },
      null,
      2,
    ),
  );
});

export const UnsubscribeNotification = asyncRoute(async (req: Request, res: Response) => {
  await connectDb();
  const token = String(req.query.token || req.body?.token || "").trim();
  if (!token) {
    throw new AppError("Unsubscribe token is required.", 400, "MISSING_TOKEN");
  }

  const { verifyUnsubscribeToken } = await import("../services/unsubscribeToken.js");
  const verification = verifyUnsubscribeToken(token);
  if (!verification.valid || !verification.wallet) {
    throw new AppError(`Invalid or expired unsubscribe token: ${verification.reason}`, 400, "INVALID_TOKEN");
  }

  const walletAddress = verification.wallet.toLowerCase();
  const event = verification.event;

  const update: Record<string, boolean> = {};
  if (event) {
    update[`notificationPreferences.${event}`] = false;
  } else {
    update["notificationPreferences.PromptPurchased"] = false;
    update["notificationPreferences.PromptUpdated"] = false;
  }

  const user = await User.findOneAndUpdate(
    { walletAddress },
    { $set: update },
    { new: true }
  );

  if (!user) {
    throw new AppError("User not found for this wallet address.", 404, "NOT_FOUND");
  }

  res.json({
    success: true,
    message: event
      ? `Successfully unsubscribed from ${event} notifications.`
      : "Successfully unsubscribed from all email notifications.",
    walletAddress,
    event: event ?? "all",
  });
});
