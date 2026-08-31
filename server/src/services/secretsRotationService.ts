/**
 * Automated Secrets Rotation Scheduler Service (#255)
 *
 * Runs scheduled checks to automatically rotate challenge token secrets
 * and API keys every 90 days, maintains overlapping grace periods, and
 * dispatches notifications to the team and key owners.
 */

import connectDb from "../db/connectDb";
import ApiKey from "../models/ApiKey";
import {
  checkAndExecuteAutomatedRotation,
  cleanupExpiredSecrets,
  notifyTeamOnRotation,
} from "../../../src/lib/auth/secretsRotation";
import {
  generateApiKey,
  computeExpirationDate,
  computeGracePeriodDate,
  API_KEY_MAX_AGE_DAYS,
} from "./apiKeys";
import { recordAuditEvent } from "./auditTrail";

export interface ApiKeyRotationResult {
  rotatedCount: number;
  expiredCount: number;
  rotatedKeys: Array<{
    id: string;
    ownerWallet: string;
    label: string;
    prefix: string;
    newPrefix: string;
    gracePeriodUntil: Date;
  }>;
}

/**
 * Checks all active API keys in Mongo and auto-rotates those that are 90 days or older,
 * setting an overlapping grace period window on the old key and issuing a new key doc.
 */
export async function autoRotateExpiringApiKeys(
  maxAgeDays = API_KEY_MAX_AGE_DAYS,
): Promise<ApiKeyRotationResult> {
  await connectDb();
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);

  // Find non-revoked keys created before the cutoff date, or keys with expiresAt <= now
  const expiringKeys = await ApiKey.find({
    revoked: false,
    $or: [{ createdAt: { $lte: cutoffDate } }, { expiresAt: { $lte: now } }],
  });

  const rotatedKeys: ApiKeyRotationResult["rotatedKeys"] = [];

  for (const key of expiringKeys) {
    const gracePeriodUntil = computeGracePeriodDate(now);
    const newExpiresAt = computeExpirationDate(now, maxAgeDays);
    const generated = generateApiKey();

    // 1. Mark existing key as revoked with overlapping grace period
    key.revoked = true;
    key.gracePeriodUntil = gracePeriodUntil;
    await key.save();

    // 2. Create the new replacement key
    const newDoc = await ApiKey.create({
      ownerWallet: key.ownerWallet,
      label: `${key.label} (auto-rotated)`,
      prefix: generated.prefix,
      hashedKey: generated.hash,
      scopes: key.scopes,
      rateLimitTier: key.rateLimitTier,
      rotatedFrom: key.prefix,
      expiresAt: newExpiresAt,
      autoRotated: true,
    });

    rotatedKeys.push({
      id: String(key._id),
      ownerWallet: key.ownerWallet,
      label: key.label,
      prefix: key.prefix,
      newPrefix: generated.prefix,
      gracePeriodUntil,
    });

    void recordAuditEvent({
      action: "api_key_auto_rotated",
      result: "success",
      promptId: null,
      walletAddress: key.ownerWallet,
      requestId: null,
      clientIp: null,
      reason: `90_day_key_rotation_replaced_${key.prefix}_with_${generated.prefix}`,
    });
  }

  // 3. Find and fully revoke keys whose grace period has expired
  const expiredResult = await ApiKey.updateMany(
    {
      revoked: true,
      gracePeriodUntil: { $lte: now, $ne: null },
    },
    {
      $set: { gracePeriodUntil: null },
    },
  );

  if (rotatedKeys.length > 0) {
    await notifyTeamOnRotation({
      secretType: "API_KEYS_BATCH",
      rotationTimestamp: now.getTime(),
      gracePeriodExpiresAt: computeGracePeriodDate(now).getTime(),
      nextScheduledRotation: now.getTime() + maxAgeDays * 24 * 60 * 60 * 1000,
      status: "success",
      message: `Auto-rotated ${rotatedKeys.length} API key(s) that reached 90-day expiration. Overlapping grace window active.`,
    });
  }

  return {
    rotatedCount: rotatedKeys.length,
    expiredCount: expiredResult.modifiedCount || 0,
    rotatedKeys,
  };
}

/**
 * Runs the full 90-day automated rotation cycle for all system secrets and API keys
 */
export async function runAutomatedSecretsRotationCycle(force = false): Promise<{
  systemSecretRotated: boolean;
  apiKeysRotated: number;
}> {
  console.log("[SecretsRotationService] Running automated 90-day secrets rotation check...");

  // 1. Check and rotate system challenge token secrets if >= 90 days
  const systemResult = await checkAndExecuteAutomatedRotation(force);
  if (systemResult.rotated) {
    console.log("[SecretsRotationService] Challenge token secret auto-rotated successfully.");
  }

  // 2. Clean up expired challenge secrets
  await cleanupExpiredSecrets();

  // 3. Auto-rotate expiring API keys
  let apiKeysRotated = 0;
  try {
    const keyResult = await autoRotateExpiringApiKeys();
    apiKeysRotated = keyResult.rotatedCount;
    if (apiKeysRotated > 0) {
      console.log(`[SecretsRotationService] Auto-rotated ${apiKeysRotated} expiring API keys.`);
    }
  } catch (err: any) {
    console.error("[SecretsRotationService] Error checking expiring API keys:", err.message);
  }

  return {
    systemSecretRotated: systemResult.rotated,
    apiKeysRotated,
  };
}
