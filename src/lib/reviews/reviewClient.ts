export interface Review {
  id: string;
  promptId: string;
  userAddress: string;
  rating: number;
  text: string;
  createdAt: number;
  verified: boolean;
  helpfulVotes: number;
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
}

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

  static async getReviews(promptId: string): Promise<ReviewListResponse> {
    const response = await fetch(`${API_BASE}/list?promptId=${promptId}`);

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
