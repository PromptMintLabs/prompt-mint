/**
 * Secret Rotation Endpoint
 * 
 * This endpoint handles the rotation of challenge token secrets.
 * It supports multiple active secrets during a grace period to prevent
 * service disruption during rotation.
 */

import { negotiateVersion } from "../../src/lib/api/versionGuard";
import { withVersion } from "../../src/lib/api/payloadVersion";
import { isValidAdminToken } from "../../src/lib/auth/adminToken";
import { withBodySizeLimit } from "../../src/lib/api/bodySizeLimit";
import {
  generateNewSecret,
  getActiveChallengeSecretsSync,
  getGracePeriodMs,
  getRotationConfig,
  rotateChallengeTokenSecret,
  isSecretValid as checkSecretValid,
  cleanupExpiredSecrets as cleanSecrets,
  type SecretRotationConfig,
} from "../../src/lib/auth/secretsRotation";

export { generateNewSecret };

export function getActiveSecrets(): string[] {
  return getActiveChallengeSecretsSync();
}

export function rotateSecret(): SecretRotationConfig {
  const currentSecret = process.env.CHALLENGE_TOKEN_SECRET;
  if (!currentSecret || currentSecret.length < 16) {
    throw new Error("CHALLENGE_TOKEN_SECRET not configured correctly");
  }

  const newSecret = generateNewSecret();
  const gracePeriodMs = getGracePeriodMs();
  const now = Date.now();

  const newConfig: SecretRotationConfig = {
    currentSecret: newSecret,
    previousSecret: currentSecret,
    rotationTimestamp: now,
    gracePeriodMs,
    nextRotationTimestamp: now + 90 * 24 * 60 * 60 * 1000,
  };

  process.env.CHALLENGE_TOKEN_SECRET = newSecret;
  process.env.CHALLENGE_TOKEN_SECRET_PREVIOUS = currentSecret;
  process.env.CHALLENGE_TOKEN_ROTATION_TIMESTAMP = now.toString();
  process.env.CHALLENGE_TOKEN_GRACE_PERIOD_MS = gracePeriodMs.toString();

  return newConfig;
}

export function isSecretValid(secret: string): boolean {
  const activeSecrets = getActiveSecrets();
  return activeSecrets.includes(secret);
}

export function cleanupExpiredSecrets(): void {
  void cleanSecrets();
}

// HTTP endpoint handler for manual or automated rotation
async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const version = negotiateVersion(req, res);
  if (!version) return;

  // Authentication check - only allow authorized operators
  if (!isValidAdminToken(req.headers.authorization, process.env.ADMIN_ROTATION_TOKEN)) {
    res.status(401).json({ apiVersion: version, error: "Unauthorized" });
    return;
  }

  try {
    const newConfig = await rotateChallengeTokenSecret();
    
    res.status(200).json(
      withVersion(
        {
          success: true,
          message: "Secret rotated successfully",
          rotationTimestamp: newConfig.rotationTimestamp,
          gracePeriodMs: newConfig.gracePeriodMs,
          expiresAt: newConfig.rotationTimestamp + newConfig.gracePeriodMs,
          nextRotationTimestamp: newConfig.nextRotationTimestamp,
        },
        version,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rotation failed";
    res.status(500).json({ apiVersion: version, error: message });
  }
}

export default withBodySizeLimit(handler, 4 * 1024);

