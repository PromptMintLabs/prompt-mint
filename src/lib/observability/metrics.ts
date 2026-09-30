import { logger } from "./logger";

export const METRIC_NAMES = {
  unlockSuccess: "unlock_success_total",
  unlockFailure: "unlock_failure_total",
  challengeIssued: "challenge_issued_total",
  rateLimitHit: "rate_limit_hit_total",
  analyticsEvent: "analytics_event_total",
  analyticsRejected: "analytics_event_rejected_total",
  apiDuration: "api_request_duration_ms",
  apiError: "api_request_error_total",
  rpcDuration: "rpc_call_duration_ms",
  rpcError: "rpc_call_error_total",
  activeUsers: "active_users_total",
  transactionVolume: "transaction_volume_total",
  endpointHealth: "api_endpoint_health",
  /**
   * Gauge: the quality score (0.0–1.0) of a moderation decision recorded
   * during a spot-check.  Labels: targetType, outcome.
   */
  moderationQualityScore: "moderation_quality_score",
  /**
   * Counter: incremented each time a moderation outcome is recorded.
   * Labels: targetType, outcome.
   */
  moderationOutcomeRecorded: "moderation_outcome_recorded_total",
  /**
   * Gauge: elapsed time in milliseconds between an abuse report being filed
   * and a moderator responding to it (resolving or dismissing it).
   * Labels: targetType, outcome.
   */
  abuseReportResponseDuration: "abuse_report_response_duration_ms",
  /**
   * Counter: incremented each time a moderator responds to an abuse report
   * (resolving or dismissing it). Labels: targetType, outcome.
   */
  abuseReportResponded: "abuse_report_responded_total",
} as const;

type MetricLabels = Record<string, string | number>;

export interface MetricSample {
  name: string;
  value: number;
  labels: MetricLabels;
  timestamp: number;
}

const MAX_SAMPLES = 4000;
const samples: MetricSample[] = [];
const counters = new Map<string, number>();
const gauges = new Map<string, number>();

function seriesKey(name: string, labels: MetricLabels): string {
  const encoded = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return `${name}{${encoded}}`;
}

function prometheusEscape(value: string | number): string {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function prometheusLabels(labels: MetricLabels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return `{${entries.map(([k, v]) => `${k}="${prometheusEscape(v)}"`).join(",")}}`;
}

export const metrics = {
  emit(name: string, value: number = 1, labels: MetricLabels = {}) {
    // Structured logs are the Datadog/CloudWatch ingestion path.
    logger.info({ metric: { name, value, labels } }, `Metric: ${name}`);

    const sample: MetricSample = { name, value, labels, timestamp: Date.now() };
    samples.push(sample);
    if (samples.length > MAX_SAMPLES) {
      samples.splice(0, samples.length - MAX_SAMPLES);
    }

    const key = seriesKey(name, labels);
    if (name.endsWith("_ms") || name.endsWith("_health")) {
      gauges.set(key, value);
    } else {
      counters.set(key, (counters.get(key) ?? 0) + value);
    }
  },

  snapshot(): MetricSample[] {
    return samples.slice();
  },

  toPrometheus(): string {
    const lines: string[] = ["# PromptMint metrics"];
    for (const sample of [...counters.entries(), ...gauges.entries()]) {
      const name = sample[0].slice(0, sample[0].indexOf("{"));
      const encoded = sample[0].slice(sample[0].indexOf("{") + 1, -1);
      const labels: MetricLabels = {};
      if (encoded) {
        for (const part of encoded.split(",")) {
          const eq = part.indexOf("=");
          if (eq > 0) labels[part.slice(0, eq)] = part.slice(eq + 1);
        }
      }
      lines.push(`${name}${prometheusLabels(labels)} ${sample[1]}`);
    }
    return `${lines.join("\n")}\n`;
  },

  // Specific helpers for this project
  trackUnlockSuccess(wallet: string, promptId: string) {
    this.emit(METRIC_NAMES.unlockSuccess, 1, { wallet, promptId });
  },

  trackUnlockFailure(wallet: string, promptId: string, reason: string) {
    this.emit(METRIC_NAMES.unlockFailure, 1, { wallet, promptId, reason });
  },

  trackChallengeIssued(wallet: string, promptId: string) {
    this.emit(METRIC_NAMES.challengeIssued, 1, { wallet, promptId });
  },

  trackRateLimitHit(type: string, identifier: string) {
    this.emit(METRIC_NAMES.rateLimitHit, 1, { type, identifier });
  },

  trackAnalyticsEvent(eventName: string) {
    this.emit(METRIC_NAMES.analyticsEvent, 1, { event: eventName });
  },

  trackAnalyticsEventRejected(reason: string) {
    this.emit(METRIC_NAMES.analyticsRejected, 1, { reason });
  },

  trackRpcCall(method: string, durationMs: number, status: "ok" | "error") {
    this.emit(METRIC_NAMES.rpcDuration, durationMs, { method, status });
    if (status === "error") {
      this.emit(METRIC_NAMES.rpcError, 1, { method });
    }
  },

  trackActiveUser(surface: string) {
    this.emit(METRIC_NAMES.activeUsers, 1, { surface });
  },

  trackTransactionVolume(kind: string, count: number = 1) {
    this.emit(METRIC_NAMES.transactionVolume, count, { kind });
  },

  trackEndpointHealth(path: string, healthy: boolean, latencyMs: number) {
    this.emit(METRIC_NAMES.endpointHealth, healthy ? 1 : 0, { path, latencyMs });
  },

  /**
   * Records the quality outcome of a moderation decision captured during a
   * spot-check review.
   *
   * Emits two metrics:
   *  - `moderation_quality_score`            (gauge, 0.0–1.0)
   *  - `moderation_outcome_recorded_total`   (counter)
   *
   * @param targetType  The type of moderated target ("prompt" | "review" | "user" | "report")
   * @param outcome     The reviewer's verdict ("correct" | "incorrect" | "disputed")
   * @param score       Quality score in [0.0, 1.0]
   */
  trackModerationQuality(
    targetType: string,
    outcome: "correct" | "incorrect" | "disputed",
    score: number,
  ) {
    this.emit(METRIC_NAMES.moderationQualityScore, score, { targetType, outcome });
    this.emit(METRIC_NAMES.moderationOutcomeRecorded, 1, { targetType, outcome });
  },

  /**
   * Records a moderator's response to an abuse report (resolution or
   * dismissal) for SLA tracking.
   *
   * Emits two metrics:
   *  - `abuse_report_response_duration_ms` (gauge) – time in milliseconds
   *    between the report being filed and the response being recorded.
   *  - `abuse_report_responded_total` (counter)
   *
   * @param targetType  The type of reported target ("prompt" | "review" | "user")
   * @param outcome     How the report was responded to ("resolved" | "dismissed")
   * @param durationMs  Response time in milliseconds (>= 0)
   */
  trackAbuseReportResponse(targetType: string, outcome: "resolved" | "dismissed", durationMs: number) {
    const safeDuration = Math.max(0, Math.round(durationMs));
    this.emit(METRIC_NAMES.abuseReportResponseDuration, safeDuration, { targetType, outcome });
    this.emit(METRIC_NAMES.abuseReportResponded, 1, { targetType, outcome });
  },

  _resetForTests() {
    samples.length = 0;
    counters.clear();
    gauges.clear();
  },
};
