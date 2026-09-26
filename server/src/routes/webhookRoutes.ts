import express from "express";
import {
  DeleteWebhook,
  GetWebhook,
  GetWebhookDeadLetters,
  GetWebhookDeliveries,
  GetWebhookHealth,
  RegisterWebhook,
  ReplayWebhookDeadLetter,
  RotateWebhookSecret,
  TestWebhook,
  validateRegisterWebhook,
} from "../controllers/webhookControllers";
import { validateBody } from "../middleware/validateRequest";
import { z } from "zod";

const WalletAddressBody = z.object({
  walletAddress: z.string().trim().min(1, "walletAddress is required."),
}).strict();

export const webhookRouter = express.Router();

webhookRouter.post("/", validateRegisterWebhook, RegisterWebhook);
webhookRouter.get("/", GetWebhook);
webhookRouter.delete("/", validateBody(WalletAddressBody), DeleteWebhook);
webhookRouter.post("/rotate-secret", validateBody(WalletAddressBody), RotateWebhookSecret);
webhookRouter.post("/test", validateBody(WalletAddressBody), TestWebhook);
webhookRouter.get("/deliveries", GetWebhookDeliveries);
webhookRouter.get("/health", GetWebhookHealth);
webhookRouter.get("/dead-letters", GetWebhookDeadLetters);
webhookRouter.post("/dead-letters/:id/replay", ReplayWebhookDeadLetter);
