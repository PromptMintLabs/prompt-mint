import { afterEach, describe, expect, it } from "vitest";
import { METRIC_NAMES, metrics } from "./metrics";

describe("metrics helpers", () => {
  afterEach(() => {
    metrics._resetForTests();
  });

  it("records RPC latency, errors, active users, tx volume, and endpoint health", () => {
    metrics.trackRpcCall("simulateTransaction", 42, "ok");
    metrics.trackRpcCall("sendTransaction", 80, "error");
    metrics.trackActiveUser("wallet_connected");
    metrics.trackTransactionVolume("submit", 2);
    metrics.trackEndpointHealth("health", true, 12);
    metrics.trackEndpointHealth("unlock", false, 900);

    const names = metrics.snapshot().map((s) => s.name);
    expect(names).toContain(METRIC_NAMES.rpcDuration);
    expect(names).toContain(METRIC_NAMES.rpcError);
    expect(names).toContain(METRIC_NAMES.activeUsers);
    expect(names).toContain(METRIC_NAMES.transactionVolume);
    expect(names).toContain(METRIC_NAMES.endpointHealth);

    const text = metrics.toPrometheus();
    expect(text).toContain("rpc_call_duration_ms");
    expect(text).toContain("transaction_volume_total");
    expect(text).toContain("api_endpoint_health");
  });

  it("keeps existing unlock helpers working", () => {
    metrics.trackUnlockSuccess("GABC", "1");
    metrics.trackUnlockFailure("GABC", "1", "no_access");
    expect(metrics.snapshot().some((s) => s.name === "unlock_success_total")).toBe(true);
    expect(metrics.snapshot().some((s) => s.labels.reason === "no_access")).toBe(true);
  });

  it("tracks moderation quality score and outcome counter", () => {
    metrics.trackModerationQuality("prompt", "correct", 1.0);
    metrics.trackModerationQuality("review", "incorrect", 0.0);
    metrics.trackModerationQuality("prompt", "disputed", 0.5);

    const names = metrics.snapshot().map((s) => s.name);
    expect(names).toContain(METRIC_NAMES.moderationQualityScore);
    expect(names).toContain(METRIC_NAMES.moderationOutcomeRecorded);

    // Quality score is emitted as a gauge per call
    const scores = metrics
      .snapshot()
      .filter((s) => s.name === METRIC_NAMES.moderationQualityScore);
    expect(scores).toHaveLength(3);
    expect(scores.find((s) => s.labels.outcome === "correct")?.value).toBe(1.0);
    expect(scores.find((s) => s.labels.outcome === "incorrect")?.value).toBe(0.0);
    expect(scores.find((s) => s.labels.outcome === "disputed")?.value).toBe(0.5);

    // Labels are correctly set
    expect(scores.find((s) => s.labels.targetType === "review")?.labels.outcome).toBe("incorrect");

    // Prometheus output contains both metric names
    const text = metrics.toPrometheus();
    expect(text).toContain("moderation_quality_score");
    expect(text).toContain("moderation_outcome_recorded_total");
  });
});
