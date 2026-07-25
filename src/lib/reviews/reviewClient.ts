export interface Review {
  id: string;
  promptId: string;
  userAddress: string;
  rating: number;
  text: string;
  createdAt: number;
  verified: boolean;
  helpfulVotes: number;
  editedAt?: number;
  sellerResponse?: {
    text: string;
    createdAt: number;
    editedAt?: number;
  };
}

export interface ReviewStats {
  total: number;
  averageRating: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface ReviewListResponse {
  reviews: Review[];
  stats: ReviewStats;
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
  filters: { sort: ReviewSort; rating: number | null };
}

export type ReviewSort = "newest" | "oldest" | "helpful" | "highest" | "lowest";
export interface ReviewListOptions { page?: number; limit?: number; sort?: ReviewSort; rating?: number; }

export interface ReviewEligibilityResponse {
  eligible: boolean;
  verified: boolean;
  alreadyReviewed: boolean;
  reason?: string;
}

export interface VoteResponse {
  voted: boolean;
  helpfulVotes: number;
  message?: string;
}

export interface SellerResponseInput {
  promptId: string;
  reviewId: string;
  sellerAddress: string;
  text: string;
  signature?: string;
}

const API_BASE = "/api/reviews";

export class ReviewClient {
  static async checkEligibility(
    promptId: string,
    userAddress: string
  ): Promise<ReviewEligibilityResponse> {
    try {
      const response = await fetch(
        `${API_BASE}/eligibility?promptId=${encodeURIComponent(promptId)}&userAddress=${encodeURIComponent(userAddress)}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          eligible: false,
          verified: false,
          alreadyReviewed: false,
          reason: error.error || "Eligibility check unavailable",
        };
      }

      return response.json();
    } catch (err) {
      return {
        eligible: false,
        verified: false,
        alreadyReviewed: false,
        reason: err instanceof Error ? err.message : "Failed to verify eligibility",
      };
    }
  }

  static async submitReview(
    promptId: string,
    userAddress: string,
    rating: number,
    text: string,
    signature: string = ""
  ): Promise<{ success: boolean; review: { id: string; rating: number; createdAt: number } }> {
    const response = await fetch(`${API_BASE}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptId,
        userAddress,
        rating,
        text,
        signature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to submit review");
    }

    return response.json();
  }

  static async getReviews(promptId: string, options: ReviewListOptions = {}): Promise<ReviewListResponse> {
    const params = new URLSearchParams({ promptId });
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    if (options.sort) params.set("sort", options.sort);
    if (options.rating) params.set("rating", String(options.rating));
    const response = await fetch(`${API_BASE}/list?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch reviews");
    }

    return response.json();
  }

  static async getReviewStats(promptId: string): Promise<ReviewStats> {
    const data = await this.getReviews(promptId);
    return data.stats;
  }

  static async editReview(promptId: string, reviewId: string, userAddress: string, rating: number, text: string) {
    const response = await fetch(`${API_BASE}/edit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId, reviewId, userAddress, rating, text }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to edit review");
    }
    return response.json();
  }

  static async voteReview(
    promptId: string,
    reviewId: string,
    userAddress: string
  ): Promise<VoteResponse> {
    const response = await fetch(`${API_BASE}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptId,
        reviewId,
        userAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to record vote");
    }

    return response.json();
  }

  static async submitSellerResponse(
    promptId: string,
    reviewId: string,
    sellerAddress: string,
    text: string,
    signature: string = ""
  ): Promise<{ success: boolean; sellerResponse: { text: string; createdAt: number } }> {
    const response = await fetch(`${API_BASE}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptId,
        reviewId,
        sellerAddress,
        text,
        signature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to submit seller response");
    }

    return response.json();
  }
}
