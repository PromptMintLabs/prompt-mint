import express from "express";
import {
  GetNotifications,
  MarkNotificationRead,
  ExportNotifications,
  UnsubscribeNotification,
} from "../controllers/notificationControllers";

export const notificationRouter = express.Router();

notificationRouter.get("/", GetNotifications);
// #752 - full notification history export (CSV or JSON attachment).
notificationRouter.get("/export", ExportNotifications);
// #748 - one-click email unsubscribe via HMAC token.
notificationRouter.get("/unsubscribe", UnsubscribeNotification);
notificationRouter.post("/unsubscribe", UnsubscribeNotification);
notificationRouter.patch("/:id/read", MarkNotificationRead);
