export interface StoredReview {
  id: string;
  promptId: string;
  userAddress: string;
  rating: number;
  text: string;
  createdAt: number;
  verified: boolean;
  helpfulVotes: number;
  voters: string[];
  helpfulVoteActivity?: Array<{ voterAddress: string; votedAt: number }>;
  editedAt?: number;
  editHistory: ReviewEditAuditEntry[];
  moderation?: {
    status: "approved" | "removed";
    moderatorAddress: string;
    reason: string;
    updatedAt: number;
  };
  sellerResponse?: {
    text: string;
    createdAt: number;
    editedAt?: number;
  };
}

export const HELPFUL_VOTE_ALERT_THRESHOLD = 5;
export const HELPFUL_VOTE_ALERT_WINDOW_MS = 10 * 60 * 1000;
export const HELPFUL_VOTE_ACTIVITY_RETENTION_MS = 24 * 60 * 60 * 1000;
export const REMOVED_REVIEW_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days retention for removed reviews

export function hasHelpfulVoteManipulationAlert(review: StoredReview, now = Date.now()): boolean {
  const recentVoters = new Set(
    (review.helpfulVoteActivity ?? [])
      .filter((activity) => now - activity.votedAt <= HELPFUL_VOTE_ALERT_WINDOW_MS)
      .map((activity) => activity.voterAddress.toLowerCase()),
  );
  return recentVoters.size >= HELPFUL_VOTE_ALERT_THRESHOLD;
}

/** Immutable snapshots retained whenever an author changes a review. */
export interface ReviewEditAuditEntry {
  editedAt: number;
  editorAddress: string;
  previousRating: number;
  previousText: string;
}

const reviewStorage = new Map<string, StoredReview[]>();

function seedMockReviews() {
  const mockReviews: StoredReview[] = [
    {
      id: "review_1",
      promptId: "1",
      userAddress: "GABC123XYZ456DEF789GHI012JKL345MNO678PQR901STU234VWX567YZ",
      rating: 5,
      text: "Excellent prompt! Helped me generate high-quality technical documentation in minutes. The structure and clarity are outstanding.",
      createdAt: Date.now() - 86400000 * 2,
      verified: true,
      helpfulVotes: 3,
      voters: ["GBCD234ABC567EFG890HIJ123KLM456NOP789QRS012TUV345WXY678ZA"],
      editHistory: [],
    },
    {
      id: "review_2",
      promptId: "1",
      userAddress: "GBCD234ABC567EFG890HIJ123KLM456NOP789QRS012TUV345WXY678ZA",
      rating: 4,
      text: "Very useful for system design work. Could use a bit more detail on edge cases, but overall a solid prompt.",
      createdAt: Date.now() - 86400000 * 5,
      verified: true,
      helpfulVotes: 1,
      voters: [],
      editHistory: [],
      moderation: {
        status: "removed",
        moderatorAddress: "gmoderator1",
        reason: "Inappropriate content",
        updatedAt: Date.now() - 86400000 * 3,
      },
    },
    {
      id: "review_3",
      promptId: "2",
      userAddress: "GCDE345BCD678FGH901IJK234LMN567OPQ890RST123UVW456XYZ789AB",
      rating: 5,
      text: "Amazing for creative writing! The narrative structures it generates are incredibly detailed and engaging. Worth every XLM.",
      createdAt: Date.now() - 86400000 * 1,
      verified: true,
      helpfulVotes: 0,
      voters: [],
      editHistory: [],
    },
  ];

  mockReviews.forEach((review) => {
    const existing = reviewStorage.get(review.promptId) || [];
    existing.push(review);
    reviewStorage.set(review.promptId, existing);
  });
}

if (reviewStorage.size === 0) {
  seedMockReviews();
}

export function getReviews(promptId: string): StoredReview[] {
  return reviewStorage.get(promptId) || [];
}

export function addReview(review: StoredReview): void {
  const reviews = reviewStorage.get(review.promptId) || [];
  reviews.push(review);
  reviewStorage.set(review.promptId, reviews);
}

export function findReview(promptId: string, reviewId: string): StoredReview | undefined {
  const reviews = reviewStorage.get(promptId) || [];
  return reviews.find((r) => r.id === reviewId);
}

export function updateReview(promptId: string, reviewId: string, update: Partial<StoredReview>): StoredReview | undefined {
  const reviews = reviewStorage.get(promptId) || [];
  const index = reviews.findIndex((r) => r.id === reviewId);
  if (index === -1) return undefined;
  reviews[index] = { ...reviews[index], ...update };
  reviewStorage.set(promptId, reviews);
  return reviews[index];
}

export function getReviewsByUser(userAddress: string): StoredReview[] {
  const result: StoredReview[] = [];
  for (const reviews of reviewStorage.values()) {
    for (const r of reviews) {
      if (r.userAddress === userAddress) {
        result.push(r);
      }
    }
  }
  return result;
}

export function findReviewById(reviewId: string): StoredReview | undefined {
  for (const reviews of reviewStorage.values()) {
    const review = reviews.find((item) => item.id === reviewId);
    if (review) return review;
  }
  return undefined;
}

export function deleteReviewById(reviewId: string): boolean {
  for (const [promptId, reviews] of reviewStorage.entries()) {
    const index = reviews.findIndex((r) => r.id === reviewId);
    if (index !== -1) {
      reviews.splice(index, 1);
      reviewStorage.set(promptId, reviews);
      return true;
    }
  }
  return false;
}

/**
 * Prunes helpfulVoteActivity older than HELPFUL_VOTE_ACTIVITY_RETENTION_MS across all stored reviews.
 */
export function pruneExpiredHelpfulVoteActivity(now = Date.now()): number {
  let prunedCount = 0;
  for (const reviews of reviewStorage.values()) {
    for (const review of reviews) {
      if (review.helpfulVoteActivity && review.helpfulVoteActivity.length > 0) {
        const initialCount = review.helpfulVoteActivity.length;
        review.helpfulVoteActivity = review.helpfulVoteActivity.filter(
          (activity) => now - activity.votedAt <= HELPFUL_VOTE_ACTIVITY_RETENTION_MS,
        );
        prunedCount += initialCount - review.helpfulVoteActivity.length;
      }
    }
  }
  return prunedCount;
}

/**
 * Prunes removed reviews whose removal time is older than the retention period.
 * Excludes reviews with active/pending appeals if provided in excludedReviewIds.
 */
export function pruneRemovedReviews(
  retentionMs = REMOVED_REVIEW_RETENTION_MS,
  now = Date.now(),
  excludedReviewIds: Set<string> | string[] = new Set(),
): { removedCount: number; removedReviewIds: string[] } {
  const excludedSet = excludedReviewIds instanceof Set ? excludedReviewIds : new Set(excludedReviewIds);
  let removedCount = 0;
  const removedReviewIds: string[] = [];

  for (const [promptId, reviews] of reviewStorage.entries()) {
    const retainedReviews: StoredReview[] = [];
    for (const review of reviews) {
      if (review.moderation?.status === "removed" && !excludedSet.has(review.id)) {
        const removalTime = review.moderation.updatedAt || review.createdAt;
        if (now - removalTime > retentionMs) {
          removedCount++;
          removedReviewIds.push(review.id);
          continue;
        }
      }
      retainedReviews.push(review);
    }
    reviewStorage.set(promptId, retainedReviews);
  }

  return { removedCount, removedReviewIds };
}

/**
 * Comprehensive in-memory review retention cleanup.
 */
export function cleanupReviewData(options?: {
  voteRetentionMs?: number;
  removedRetentionMs?: number;
  now?: number;
  excludedReviewIds?: string[] | Set<string>;
}): {
  prunedVotes: number;
  removedReviews: number;
  removedReviewIds: string[];
} {
  const now = options?.now ?? Date.now();
  const prunedVotes = pruneExpiredHelpfulVoteActivity(now);
  const { removedCount, removedReviewIds } = pruneRemovedReviews(
    options?.removedRetentionMs ?? REMOVED_REVIEW_RETENTION_MS,
    now,
    options?.excludedReviewIds ?? new Set(),
  );

  return {
    prunedVotes,
    removedReviews: removedCount,
    removedReviewIds,
  };
}

export function _resetReviewStorage(): void {
  reviewStorage.clear();
  seedMockReviews();
}

