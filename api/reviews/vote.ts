import {
  findReview,
  HELPFUL_VOTE_ACTIVITY_RETENTION_MS,
  hasHelpfulVoteManipulationAlert,
  updateReview,
} from "./data";
import { negotiateVersion } from "../../src/lib/api/versionGuard";
import { withVersion } from "../../src/lib/api/payloadVersion";
import { apiError, ErrorCode } from "../../src/lib/api/errorCodes";
import { withBodySizeLimit } from "../../src/lib/api/bodySizeLimit";

interface VoteRequest {
  promptId: string;
  reviewId: string;
  userAddress: string;
}

async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const version = negotiateVersion(req, res);
  if (!version) return;

  const { promptId, reviewId, userAddress }: VoteRequest = req.body;

  if (!promptId || !reviewId || !userAddress) {
    res.status(400).json(apiError(ErrorCode.MISSING_FIELDS, "Missing required fields: promptId, reviewId, userAddress", undefined, version));
    return;
  }

  try {
    const review = findReview(promptId, reviewId);

    if (!review) {
      res.status(404).json({ apiVersion: version, error: "Review not found" });
      return;
    }

    const normalizedVoter = userAddress.toLowerCase();
    const normalizedAuthor = review.userAddress.toLowerCase();

    if (normalizedVoter === normalizedAuthor) {
      res.status(403).json({ apiVersion: version, error: "You cannot vote on your own review" });
      return;
    }

    const hasVoted = review.voters.some((v) => v.toLowerCase() === normalizedVoter);

    if (hasVoted) {
      const updatedVoters = review.voters.filter((v) => v.toLowerCase() !== normalizedVoter);
      const updatedReview = updateReview(promptId, reviewId, {
        voters: updatedVoters,
        helpfulVotes: updatedVoters.length,
      });

      res.status(200).json(
        withVersion({
          voted: false,
          helpfulVotes: updatedReview?.helpfulVotes ?? 0,
          helpfulVoteAlert: updatedReview ? hasHelpfulVoteManipulationAlert(updatedReview) : false,
          message: "Vote removed",
        }, version),
      );
      return;
    }

    const now = Date.now();
    const helpfulVoteActivity = (review.helpfulVoteActivity ?? [])
      .filter((activity) => now - activity.votedAt <= HELPFUL_VOTE_ACTIVITY_RETENTION_MS);
    helpfulVoteActivity.push({ voterAddress: normalizedVoter, votedAt: now });
    const updatedVoters = [...review.voters, userAddress];
    const updatedReview = updateReview(promptId, reviewId, {
      voters: updatedVoters,
      helpfulVotes: updatedVoters.length,
      helpfulVoteActivity,
    });

    console.log(`✓ Vote recorded for review ${reviewId} by ${userAddress.slice(0, 8)}...`);

    res.status(200).json(
      withVersion({
        voted: true,
        helpfulVotes: updatedReview?.helpfulVotes ?? 0,
        helpfulVoteAlert: updatedReview ? hasHelpfulVoteManipulationAlert(updatedReview, now) : false,
        message: "Vote recorded",
      }, version),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record vote";
    console.error("Vote error:", message);
    res.status(500).json(apiError(ErrorCode.TEMPORARY_FAILURE, message, undefined, version));
  }
}

export default withBodySizeLimit(handler);
