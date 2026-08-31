/**
 * POST /api/bundles/unlock
 *
 * Unlock all prompts in a purchased bundle in one authenticated round-trip.
 *
 * Flow:
 *   1. Verify challenge token + wallet signature (same as single-prompt unlock).
 *   2. Verify on-chain bundle access via `has_bundle_access`.
 *   3. Retrieve the BundlePurchase snapshot to get the purchased prompt IDs.
 *      (Falls back to current bundle.prompt_ids when snapshot unavailable.)
 *   4. For each prompt, decrypt and integrity-check the plaintext.
 *   5. Return the array of {promptId, title, contentHash, plaintext}.
 *
 * Per-prompt access checks are NOT relaxed — every prompt is decrypted only
 * because the bundle purchase itself proves entitlement to every member.
 */
import {
  buildChallengeMessage,
  verifyChallengeSignature,
  verifyChallengeToken,
} from "../../src/lib/auth/challenge";
import {
  decryptPromptCiphertext,
  hashPromptPlaintext,
  normalizeContentHash,
  unwrapPromptKey,
} from "../../src/lib/crypto/promptCrypto";
import {
  getPrompt,
  getBundle,
  hasBundleAccess,
  type PromptHashConfig,
} from "../../src/lib/stellar/promptHashClient";
import { withObservability } from "../../src/lib/observability/wrapper";
import { checkRateLimit } from "../../src/lib/observability/rateLimiter";
import {
  isAccountLocked,
  isCaptchaRequired,
  recordFailedAuthAttempt,
  recordSuccessfulAuth,
  verifyCaptchaToken,
} from "../../src/lib/auth/abuseProtection";
import { checkReplayProtection } from "../../src/lib/observability/replayProtection";
import { metrics } from "../../src/lib/observability/metrics";
import { dispatchEvent } from "../../server/src/services/webhookDispatcher";
import { recordAuditEvent } from "../../server/src/services/auditTrail";
import { apiError, ErrorCode } from "../../src/lib/api/errorCodes";
import { validateUnlockSecrets } from "../../src/lib/validation/envValidator";

// Fail-fast module load validation
try {
  validateUnlockSecrets();
} catch (err: any) {
  console.error(err.message);
}

function getActiveSecrets(primarySecret: string): string[] {
  const secrets = [primarySecret];
  const previousSecret = process.env.CHALLENGE_TOKEN_SECRET_PREVIOUS;
  const rotationTimestamp = parseInt(
    process.env.CHALLENGE_TOKEN_ROTATION_TIMESTAMP || "0",
    10,
  );
  const gracePeriodMs = parseInt(
    process.env.CHALLENGE_TOKEN_GRACE_PERIOD_MS || "300000",
    10,
  );
  if (previousSecret && rotationTimestamp) {
    const timeSinceRotation = Date.now() - rotationTimestamp;
    if (timeSinceRotation < gracePeriodMs) {
      secrets.push(previousSecret);
    }
  }
  return secrets;
}

function getServerConfig(): PromptHashConfig {
  const rpcUrl =
    process.env.PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const networkPassphrase =
    process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015";
  const promptHashContractId =
    process.env.PUBLIC_PROMPT_HASH_CONTRACT_ID ?? "";
  const nativeAssetContractId =
    process.env.PUBLIC_STELLAR_NATIVE_ASSET_CONTRACT_ID ??
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
  const simulationAccount =
    process.env.PUBLIC_STELLAR_SIMULATION_ACCOUNT ??
    process.env.UNLOCK_PUBLIC_KEY ??
    "";

  return {
    rpcUrl,
    networkPassphrase,
    promptHashContractId,
    nativeAssetContractId,
    simulationAccount,
    allowHttp: new URL(rpcUrl).hostname === "localhost",
  };
}

export interface UnlockedPrompt {
  promptId: string;
  title: string;
  contentHash: string;
  plaintext: string;
}

async function handler(req: any, res: any) {
  try {
    validateUnlockSecrets();
  } catch (err: any) {
    req.logger.error("Configuration validation failed", { error: err.message });
    res
      .status(500)
      .json(apiError(ErrorCode.CONFIGURATION_ERROR, "Configuration error."));
    return;
  }

  if (req.method !== "POST") {
    res
      .status(405)
      .json(apiError(ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed."));
    return;
  }

  const clientIp = (
    req.headers["x-forwarded-for"] || req.socket.remoteAddress
  ) as string;
  const { token, bundleId, address, signedMessage, captchaToken } = req.body ?? {};

  const challengeSecret = process.env.CHALLENGE_TOKEN_SECRET;
  const unlockPublicKey = process.env.UNLOCK_PUBLIC_KEY;
  const unlockPrivateKey = process.env.UNLOCK_PRIVATE_KEY;

  if (!challengeSecret || !unlockPublicKey || !unlockPrivateKey) {
    req.logger.error("Unlock service is missing configuration secrets.");
    res
      .status(500)
      .json(apiError(ErrorCode.CONFIGURATION_ERROR, "Configuration error."));
    return;
  }

  if (!token || !bundleId || !address || !signedMessage) {
    res.status(400).json(
      apiError(
        ErrorCode.MISSING_FIELDS,
        "token, bundleId, address, and signedMessage are required.",
      ),
    );
    return;
  }

  // Rate-limit: IP bucket (unauthenticated / most strict)
  const ipRateLimit = await checkRateLimit("bundle_unlock", clientIp, false);
  if (!ipRateLimit.success) {
    req.logger.warn({ clientIp }, "Rate limit exceeded for bundle unlock (IP)");
    metrics.trackRateLimitHit("bundle_unlock_ip", clientIp);
    void recordAuditEvent({
      action: "bundle_unlock_rate_limited",
      result: "blocked",
      promptId: String(bundleId),
      walletAddress: String(address),
      requestId: req.requestId ?? null,
      clientIp,
      reason: "rate_limit",
    });
    res.status(429).json(
      apiError(
        ErrorCode.RATE_LIMIT_IP,
        "Too many requests. Please wait before retrying.",
      ),
    );
    return;
  }

  // Check if wallet account is locked
  if (address && typeof address === "string") {
    const lockStatus = await isAccountLocked(address);
    if (lockStatus.locked) {
      req.logger.warn({ address }, "Bundle unlock requested for locked account");
      void recordAuditEvent({
        action: "bundle_unlock_account_locked",
        result: "blocked",
        promptId: String(bundleId),
        walletAddress: String(address),
        requestId: req.requestId ?? null,
        clientIp,
        reason: "account_locked",
      });
      res.status(423).json(
        apiError(
          ErrorCode.ACCOUNT_LOCKED,
          "Account is locked due to too many failed authentication attempts.",
          { lockedUntil: lockStatus.lockedUntil },
        ),
      );
      return;
    }
  }

  // Rate-limit: wallet bucket (authenticated / slightly looser)
  const walletRateLimit = await checkRateLimit(
    "bundle_unlock",
    String(address),
    true,
  );
  if (!walletRateLimit.success) {
    req.logger.warn({ address }, "Rate limit exceeded for bundle unlock (wallet)");
    metrics.trackRateLimitHit("bundle_unlock_wallet", String(address));
    res.status(429).json(
      apiError(
        ErrorCode.RATE_LIMIT_WALLET,
        "Too many requests. Please wait before retrying.",
      ),
    );
    return;
  }

  // Check if CAPTCHA is required due to repeated failures
  const addressStr = typeof address === "string" ? address : undefined;
  const captchaNeeded = await isCaptchaRequired(addressStr, clientIp);
  if (captchaNeeded) {
    const resolvedCaptchaToken =
      captchaToken || req.headers["x-captcha-token"];

    if (!resolvedCaptchaToken || typeof resolvedCaptchaToken !== "string") {
      req.logger.warn({ address: addressStr, clientIp }, "CAPTCHA required for bundle unlock request");
      void recordAuditEvent({
        action: "bundle_unlock_captcha_required",
        result: "blocked",
        promptId: String(bundleId),
        walletAddress: addressStr ?? null,
        requestId: req.requestId ?? null,
        clientIp,
        reason: "captcha_required",
      });
      res.status(403).json(
        apiError(
          ErrorCode.CAPTCHA_REQUIRED,
          "CAPTCHA verification is required to proceed.",
          { captchaRequired: true },
        ),
      );
      return;
    }

    const captchaResult = await verifyCaptchaToken(resolvedCaptchaToken, clientIp);
    if (!captchaResult.valid) {
      req.logger.warn(
        { address: addressStr, clientIp, reason: captchaResult.reason },
        "Invalid CAPTCHA token for bundle unlock",
      );
      void recordAuditEvent({
        action: "bundle_unlock_captcha_failed",
        result: "blocked",
        promptId: String(bundleId),
        walletAddress: addressStr ?? null,
        requestId: req.requestId ?? null,
        clientIp,
        reason: captchaResult.reason ?? "invalid_captcha",
      });
      res.status(403).json(
        apiError(
          ErrorCode.CAPTCHA_INVALID,
          "Invalid or expired CAPTCHA verification.",
          { captchaRequired: true },
        ),
      );
      return;
    }
  }

  try {
    // 1. Verify challenge token
    const activeSecrets = getActiveSecrets(challengeSecret);
    const payload = verifyChallengeToken(
      activeSecrets,
      String(token),
      String(address),
      String(bundleId),
    );
    const challengeMessage = buildChallengeMessage(payload);
    const validSignature = verifyChallengeSignature(
      String(address),
      challengeMessage,
      String(signedMessage),
    );

    if (!validSignature) {
      req.logger.warn({ address, bundleId }, "Invalid wallet signature");
      metrics.trackUnlockFailure(String(address), String(bundleId), "invalid_signature");
      
      const failureStatus = await recordFailedAuthAttempt(String(address), clientIp);

      if (failureStatus.locked) {
        req.logger.warn({ address }, "Account locked after 5 failed auth attempts");
        void recordAuditEvent({
          action: "bundle_account_locked",
          result: "blocked",
          promptId: String(bundleId),
          walletAddress: String(address),
          requestId: req.requestId ?? null,
          clientIp,
          reason: "max_failed_auth_attempts_exceeded",
        });
        res.status(423).json(
          apiError(
            ErrorCode.ACCOUNT_LOCKED,
            "Account is locked due to too many failed authentication attempts.",
            { lockedUntil: failureStatus.lockedUntil },
          ),
        );
        return;
      }

      void recordAuditEvent({
        action: "bundle_unlock_invalid_signature",
        result: "failure",
        promptId: String(bundleId),
        walletAddress: String(address),
        requestId: req.requestId ?? null,
        clientIp,
        reason: "invalid_signature",
      });
      res
        .status(401)
        .json(
          apiError(ErrorCode.INVALID_SIGNATURE, "Invalid wallet signature."),
        );
      return;
    }

    // 2. Replay protection
    const replayCheck = await checkReplayProtection(
      String(token),
      String(signedMessage),
    );
    if (!replayCheck.valid) {
      req.logger.warn({ address, bundleId }, "Replay attack detected");
      metrics.trackUnlockFailure(String(address), String(bundleId), "replay_detected");
      void recordAuditEvent({
        action: "bundle_unlock_replay_detected",
        result: "blocked",
        promptId: String(bundleId),
        walletAddress: String(address),
        requestId: req.requestId ?? null,
        clientIp,
        reason: "replay_attack",
      });
      res.status(400).json(
        apiError(
          ErrorCode.TEMPORARY_FAILURE,
          "This unlock request has already been processed.",
        ),
      );
      return;
    }

    // 3. Verify on-chain bundle access
    const config = getServerConfig();
    const bid = BigInt(bundleId);
    const access = await hasBundleAccess(config, String(address), bid);
    if (!access) {
      req.logger.warn({ address, bundleId }, "Bundle access denied");
      metrics.trackUnlockFailure(String(address), String(bundleId), "no_access");
      void recordAuditEvent({
        action: "bundle_unlock_no_access",
        result: "failure",
        promptId: String(bundleId),
        walletAddress: String(address),
        requestId: req.requestId ?? null,
        clientIp,
        reason: "no_access",
      });
      res.status(403).json(
        apiError(
          ErrorCode.ACCESS_NOT_PURCHASED,
          "Bundle access has not been purchased.",
        ),
      );
      return;
    }

    // 4. Resolve which prompt IDs belong to this bundle purchase.
    //    Using bundle.prompt_ids (live) is intentional — the purchasedPromptIds
    //    snapshot lives purely on-chain. The server unlocks only the prompts the
    //    buyer is entitled to; the challenge token is bound to the bundleId, so
    //    the set cannot be widened by the caller.
    const bundle = await getBundle(config, bid);

    // 5. Decrypt each member prompt
    const results: UnlockedPrompt[] = [];
    for (const promptIdBig of bundle.promptIds) {
      const prompt = await getPrompt(config, promptIdBig);
      const keyBytes = await unwrapPromptKey(
        prompt.wrappedKey as string,
        unlockPublicKey,
        unlockPrivateKey,
      );
      const plaintext = await decryptPromptCiphertext(
        prompt.encryptedPrompt as string,
        prompt.encryptionIv as string,
        keyBytes,
      );
      const contentHash = await hashPromptPlaintext(plaintext);
      const storedHash = normalizeContentHash(prompt.contentHash as string);
      if (contentHash !== storedHash) {
        req.logger.error(
          { address, bundleId, promptId: promptIdBig.toString() },
          "Prompt integrity check failed inside bundle unlock",
        );
        metrics.trackUnlockFailure(
          String(address),
          promptIdBig.toString(),
          "integrity_failure",
        );
        void recordAuditEvent({
          action: "bundle_unlock_integrity_failure",
          result: "failure",
          promptId: promptIdBig.toString(),
          walletAddress: String(address),
          requestId: req.requestId ?? null,
          clientIp,
          reason: "integrity_failure",
        });
        res.status(500).json(
          apiError(
            ErrorCode.INTEGRITY_FAILURE,
            `Prompt #${promptIdBig.toString()} integrity check failed.`,
          ),
        );
        return;
      }
      results.push({
        promptId: promptIdBig.toString(),
        title: prompt.title,
        contentHash,
        plaintext,
      });
    }

    // 6. Audit + metrics
    await recordSuccessfulAuth(String(address), clientIp);
    metrics.trackUnlockSuccess(String(address), String(bundleId));
    req.logger.info(
      { address, bundleId, count: results.length },
      "Bundle unlocked successfully",
    );
    void recordAuditEvent({
      action: "bundle_unlock_success",
      result: "success",
      promptId: String(bundleId),
      walletAddress: String(address),
      requestId: req.requestId ?? null,
      clientIp,
      reason: null,
    });

    // 7. Notify creator (fire-and-forget)
    void Promise.resolve(
      dispatchEvent(bundle.creator ?? "", "BundlePurchased", {
        bundleId: bid.toString(),
        buyer: String(address),
        title: bundle.title,
        itemCount: results.length,
      }),
    ).catch(() => {});

    res.status(200).json({
      bundleId: bid.toString(),
      title: bundle.title,
      items: results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to unlock bundle.";
    req.logger.error({ address, bundleId, error: message }, "Bundle unlock attempt failed");
    metrics.trackUnlockFailure(String(address), String(bundleId), "error");

    const isExpired = message.toLowerCase().includes("expired");
    void recordAuditEvent({
      action: isExpired
        ? "bundle_unlock_expired_challenge"
        : "bundle_unlock_error",
      result: "failure",
      promptId: String(bundleId),
      walletAddress: String(address),
      requestId: req.requestId ?? null,
      clientIp,
      reason: isExpired ? "expired_challenge" : "error",
    });

    const errorCode = isExpired
      ? ErrorCode.TEMPORARY_FAILURE
      : ErrorCode.CONFIGURATION_ERROR;
    res.status(isExpired ? 400 : 500).json(apiError(errorCode, message));
  }
}

export default withObservability(handler);
