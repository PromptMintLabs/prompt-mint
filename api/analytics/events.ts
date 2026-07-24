import {
  AnalyticsEventEnvelope,
  containsRawWalletAddress,
  isKnownEvent,
  MAX_CLIENT_CLOCK_DRIFT_MS,
  validateEventProperties,
} from "../../src/lib/analytics/taxonomy";
import { withObservability } from "../../src/lib/observability/wrapper";
import { checkRateLimit } from "../../src/lib/observability/rateLimiter";
import { metrics } from "../../src/lib/observability/metrics";
import { recordAnalyticsEvent } from "../../server/src/services/analyticsEvents";
import { apiError, ErrorCode } from "../../src/lib/api/errorCodes";

/**
 * Receives privacy-safe product analytics events from the frontend.
 *
 * This endpoint is intentionally decoupled from the marketplace's on-chain
 * access authority: it never reads or writes contract state, never receives
 * a raw wallet address, and a failure here can never block a purchase,
 * listing, or unlock flow (the client fire-and-forgets these calls).
 */
async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json(apiError(ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed."));
    return;
  }

  const clientIp = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress) as string;

  const ipRateLimit = await checkRateLimit("analytics", clientIp ?? "unknown", false);
  if (!ipRateLimit.success) {
    req.logger?.warn?.({ clientIp }, "Rate limit exceeded for analytics events");
    metrics.trackRateLimitHit("analytics_ip", clientIp ?? "unknown");
    res.setHeader("X-RateLimit-Limit", ipRateLimit.limit);
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader("X-RateLimit-Reset", ipRateLimit.reset);
    res.status(429).json(
      apiError(ErrorCode.RATE_LIMIT_IP, "Too many requests. Please try again later.", {
        reset: ipRateLimit.reset,
      }),
    );
    return;
  }

  const envelopeResult = AnalyticsEventEnvelope.safeParse(req.body ?? {});
  if (!envelopeResult.success) {
    res.status(400).json(
      apiError(ErrorCode.MISSING_FIELDS, "event, occurredAt, and properties are required."),
    );
    return;
  }

  const { event, occurredAt, properties } = envelopeResult.data;

  // z.enum in the envelope already restricts `event` to known names, but this
  // guard keeps the 400 path explicit and independently testable.
  if (!isKnownEvent(event)) {
    metrics.trackAnalyticsEventRejected("unknown_event");
    res.status(400).json(apiError(ErrorCode.UNKNOWN_EVENT, "This event type is not recognized."));
    return;
  }

  const propertiesResult = validateEventProperties(event, properties);
  if (!propertiesResult.success) {
    req.logger?.warn?.({ event, error: propertiesResult.error }, "Rejected invalid analytics payload");
    metrics.trackAnalyticsEventRejected("invalid_payload");
    res.status(400).json(
      apiError(ErrorCode.INVALID_EVENT_PAYLOAD, "The event payload did not match the expected shape."),
    );
    return;
  }

  if (containsRawWalletAddress(propertiesResult.data)) {
    req.logger?.error?.({ event }, "Rejected analytics payload containing a raw wallet address");
    metrics.trackAnalyticsEventRejected("raw_wallet_address");
    res.status(400).json(
      apiError(ErrorCode.INVALID_EVENT_PAYLOAD, "The event payload did not match the expected shape."),
    );
    return;
  }

  const now = Date.now();
  const drift = Math.abs(now - occurredAt);
  const effectiveOccurredAt = drift > MAX_CLIENT_CLOCK_DRIFT_MS ? new Date(now) : new Date(occurredAt);

  const { walletHash = null, promptId = null } = propertiesResult.data as {
    walletHash?: string | null;
    promptId?: string | null;
  };

  await recordAnalyticsEvent({
    event,
    walletHash,
    promptId,
    occurredAt: effectiveOccurredAt,
    requestId: req.requestId ?? null,
    properties: propertiesResult.data,
  });

  metrics.trackAnalyticsEvent(event);
  req.logger?.info?.({ event }, "Analytics event recorded");

  res.status(202).json({ accepted: true });
}

export default withObservability(handler, "analytics/events");
