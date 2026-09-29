/**
 * Immutable snapshot of a listing's public metadata, captured when a buyer
 * files an abuse report (#737).
 *
 * Moderators investigate reports after the fact, but a listing can be edited or
 * deleted in the meantime. Storing the public fields as they were at report
 * time preserves the evidence that was actually reported.
 *
 * Only public listing metadata is captured. The gated prompt body and the
 * encrypted payload / wrapped keys are never copied, so a report cannot be used
 * to exfiltrate paid content into a moderation record.
 */

export const LISTING_SNAPSHOT_LIMITS = {
  promptId: 64,
  title: 120,
  category: 40,
  creator: 64,
  imageUrl: 512,
  previewText: 2000,
  price: 64,
  tag: 30,
  tags: 10,
} as const;

export interface ReportedListingSnapshot {
  promptId: string;
  capturedAt: number;
  title?: string;
  category?: string;
  creator?: string;
  imageUrl?: string;
  previewText?: string;
  price?: string;
  tags?: string[];
}

/**
 * Untrusted listing metadata as it arrives on a report request. Values are
 * `unknown` because the payload is client-supplied and must be normalized
 * before it is stored.
 */
export interface ReportListingInput {
  promptId?: unknown;
  title?: unknown;
  category?: unknown;
  creator?: unknown;
  imageUrl?: unknown;
  previewText?: unknown;
  price?: unknown;
  tags?: unknown;
}

function trimTo(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function toBoundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value === "bigint") return trimTo(value.toString(), maxLength);
  if (typeof value === "number" && Number.isFinite(value)) return trimTo(String(value), maxLength);
  return trimTo(value, maxLength);
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of value) {
    const tag = trimTo(entry, LISTING_SNAPSHOT_LIMITS.tag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= LISTING_SNAPSHOT_LIMITS.tags) break;
  }
  return tags;
}

/** Deep-freeze a normalized snapshot so later listing edits cannot alter it. */
export function freezeListingSnapshot(
  snapshot: ReportedListingSnapshot,
): ReportedListingSnapshot {
  if (snapshot.tags) Object.freeze(snapshot.tags);
  return Object.freeze(snapshot);
}

/**
 * Normalize untrusted listing metadata into a frozen snapshot.
 *
 * Returns `undefined` when there is no usable listing id — a snapshot without
 * the listing it describes cannot be used for investigation. Any client-supplied
 * timestamp is ignored so `capturedAt` reflects when the report was received.
 */
export function buildListingSnapshot(
  input: unknown,
  capturedAt: number = Date.now(),
): ReportedListingSnapshot | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as ReportListingInput;

  const promptId = trimTo(source.promptId, LISTING_SNAPSHOT_LIMITS.promptId);
  if (!promptId) return undefined;

  const snapshot: ReportedListingSnapshot = { promptId, capturedAt };

  const title = trimTo(source.title, LISTING_SNAPSHOT_LIMITS.title);
  if (title) snapshot.title = title;
  const category = trimTo(source.category, LISTING_SNAPSHOT_LIMITS.category);
  if (category) snapshot.category = category;
  const creator = trimTo(source.creator, LISTING_SNAPSHOT_LIMITS.creator);
  if (creator) snapshot.creator = creator;
  const imageUrl = trimTo(source.imageUrl, LISTING_SNAPSHOT_LIMITS.imageUrl);
  if (imageUrl) snapshot.imageUrl = imageUrl;
  const previewText = trimTo(source.previewText, LISTING_SNAPSHOT_LIMITS.previewText);
  if (previewText) snapshot.previewText = previewText;
  const price = toBoundedText(source.price, LISTING_SNAPSHOT_LIMITS.price);
  if (price) snapshot.price = price;

  const tags = normalizeTags(source.tags);
  if (tags.length > 0) snapshot.tags = tags;

  return freezeListingSnapshot(snapshot);
}

/**
 * Deep-copy a snapshot before it is persisted so the stored copy is independent
 * of the object the caller handed us.
 */
export function cloneListingSnapshot(
  snapshot: ReportedListingSnapshot,
): ReportedListingSnapshot {
  return freezeListingSnapshot({
    ...snapshot,
    ...(snapshot.tags ? { tags: [...snapshot.tags] } : {}),
  });
}
