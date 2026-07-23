import { findReview, updateReview } from "./data";

interface VoteRequest {
  promptId: string;
  reviewId: string;
  userAddress: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { promptId, reviewId, userAddress }: VoteRequest = req.body;

  if (!promptId || !reviewId || !userAddress) {
    res.status(400).json({ error: "Missing required fields: promptId, reviewId, userAddress" });
    return;
  }

  try {
    const review = findReview(promptId, reviewId);

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const normalizedVoter = userAddress.toLowerCase();
    const normalizedAuthor = review.userAddress.toLowerCase();

    if (normalizedVoter === normalizedAuthor) {
      res.status(403).json({ error: "You cannot vote on your own review" });
      return;
    }

    const hasVoted = review.voters.some((v) => v.toLowerCase() === normalizedVoter);

    if (hasVoted) {
      const updatedVoters = review.voters.filter((v) => v.toLowerCase() !== normalizedVoter);
      const updatedReview = updateReview(promptId, reviewId, {
        voters: updatedVoters,
        helpfulVotes: updatedVoters.length,
      });

      res.status(200).json({
        voted: false,
        helpfulVotes: updatedReview?.helpfulVotes ?? 0,
        message: "Vote removed",
      });
      return;
    }

    const updatedVoters = [...review.voters, userAddress];
    const updatedReview = updateReview(promptId, reviewId, {
      voters: updatedVoters,
      helpfulVotes: updatedVoters.length,
    });

    console.log(
      `✓ Vote recorded for review ${reviewId} by ${userAddress.slice(0, 8)}...`
    );

    res.status(200).json({
      voted: true,
      helpfulVotes: updatedReview?.helpfulVotes ?? 0,
      message: "Vote recorded",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record vote";
    console.error("Vote error:", message);
    res.status(500).json({ error: message });
  }
}
