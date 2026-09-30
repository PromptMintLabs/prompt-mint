/**
 * Immutable snapshot of an off-chain listing's public fields, captured when an
 * abuse report is filed (#737) so moderators can review what was reported even
 * after the listing is edited, archived, or deleted.
 *
 * The pre-encryption prompt body (`content`) is intentionally excluded: a
 * moderation record must never copy paid/gated content.
 */

export const LISTING_SNAPSHOT_LIMITS = {
  promptId: 64,
  title: 120,
  category: 40,
  image: 512,
  tag: 30,
  tags: 10,
} as const;

export interface ReportedListingSnapshot {
  promptId: string;
  capturedAt: Date;
  title?: string;
  category?: string;
  image?: string;
  price?: number;
  tags?: string[];
  onChainId?: string;
  salesCount?: number;
  listingStatus?: string;
}

export interface ListingSnapshotSource {
  _id?: unknown;
  onChainId?: unknown;
  title?: unknown;
  category?: unknown;
  image?: unknown;
  price?: unknown;
  tags?: unknown;
  salesCount?: unknown;
  listingStatus?: unknown;
}

function trimmed(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  if (!result) return undefined;
  return result.length > maxLength ? result.slice(0, maxLength) : result;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of value) {
    const tag = trimmed(entry, LISTING_SNAPSHOT_LIMITS.tag);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= LISTING_SNAPSHOT_LIMITS.tags) break;
  }
  return tags;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Build a frozen snapshot of a listing's public fields from a `Prompt` document.
 * Returns `undefined` when the listing has no usable identifier.
 *
 * `capturedAt` defaults to the moment the report is received, not a caller
 * supplied value.
 */
export function buildListingSnapshotFromPrompt(
  prompt: ListingSnapshotSource | null | undefined,
  capturedAt: Date = new Date(),
): ReportedListingSnapshot | undefined {
  if (!prompt) return undefined;

  const onChainId = trimmed(prompt.onChainId, LISTING_SNAPSHOT_LIMITS.promptId);
  const promptId =
    onChainId ??
    (prompt._id !== undefined && prompt._id !== null
      ? trimmed(String(prompt._id), LISTING_SNAPSHOT_LIMITS.promptId)
      : undefined);
  if (!promptId) return undefined;

  const snapshot: ReportedListingSnapshot = { promptId, capturedAt };

  const title = trimmed(prompt.title, LISTING_SNAPSHOT_LIMITS.title);
  if (title) snapshot.title = title;
  const category = trimmed(prompt.category, LISTING_SNAPSHOT_LIMITS.category);
  if (category) snapshot.category = category;
  const image = trimmed(prompt.image, LISTING_SNAPSHOT_LIMITS.image);
  if (image) snapshot.image = image;
  const listingStatus = trimmed(prompt.listingStatus, LISTING_SNAPSHOT_LIMITS.category);
  if (listingStatus) snapshot.listingStatus = listingStatus;

  const price = toFiniteNumber(prompt.price);
  if (price !== undefined) snapshot.price = price;
  const salesCount = toFiniteNumber(prompt.salesCount);
  if (salesCount !== undefined) snapshot.salesCount = salesCount;
  if (onChainId) snapshot.onChainId = onChainId;

  const tags = normalizeTags(prompt.tags);
  if (tags.length > 0) snapshot.tags = tags;
  if (snapshot.tags) Object.freeze(snapshot.tags);

  return Object.freeze(snapshot);
}
