import { AnalyticsEvent } from "../models/AnalyticsEvent";

export interface AnalyticsEventParams {
  event: string;
  walletHash?: string | null;
  promptId?: string | null;
  occurredAt: Date;
  requestId?: string | null;
  properties: Record<string, unknown>;
}

/**
 * Persist a validated analytics event. Fire-and-forget: a storage hiccup
 * must never block or fail the caller's request, matching the audit-trail
 * service's failure posture.
 *
 * Callers must have already validated `event`/`properties` against the
 * taxonomy in `src/lib/analytics/taxonomy.ts` — this function does not
 * re-validate the payload shape.
 */
export async function recordAnalyticsEvent(params: AnalyticsEventParams): Promise<void> {
  try {
    await AnalyticsEvent.create({
      event: params.event,
      walletHash: params.walletHash ?? null,
      promptId: params.promptId ?? null,
      occurredAt: params.occurredAt,
      requestId: params.requestId ?? null,
      properties: params.properties ?? {},
    });
  } catch (err) {
    console.error("[analytics] Failed to write analytics event", { event: params.event, err });
  }
}

/**
 * Query recorded events for operational/creator-facing aggregation. Returns
 * the most recent `limit` events matching the filter.
 */
export async function queryAnalyticsEvents(filter: {
  event?: string;
  walletHash?: string;
  promptId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}) {
  const query: Record<string, unknown> = {};

  if (filter.event) query.event = filter.event;
  if (filter.walletHash) query.walletHash = filter.walletHash;
  if (filter.promptId) query.promptId = filter.promptId;
  if (filter.since || filter.until) {
    query.createdAt = {} as Record<string, Date>;
    if (filter.since) (query.createdAt as Record<string, Date>)["$gte"] = filter.since;
    if (filter.until) (query.createdAt as Record<string, Date>)["$lte"] = filter.until;
  }

  return AnalyticsEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(filter.limit ?? 100)
    .lean();
}
