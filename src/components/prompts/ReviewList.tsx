import { useState } from "react";
import { StarRating } from "./StarRating";
import { User, ThumbsUp, MessageSquare, Pencil } from "lucide-react";
import { ReviewClient, type Review } from "../../lib/reviews/reviewClient";
import { Button } from "../ui/button";

const formatDistanceToNow = (date: Date, options?: { addSuffix?: boolean }) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const suffix = options?.addSuffix ? " ago" : "";

  if (years > 0) return `${years} year${years > 1 ? "s" : ""}${suffix}`;
  if (months > 0) return `${months} month${months > 1 ? "s" : ""}${suffix}`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""}${suffix}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}${suffix}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""}${suffix}`;
  return `${seconds} second${seconds !== 1 ? "s" : ""}${suffix}`;
};

interface ReviewListProps {
  reviews: Review[];
  isLoading?: boolean;
  currentUserAddress?: string;
  sellerAddress?: string;
  promptId?: string;
  onReviewUpdate?: () => void;
}

const formatAddress = (address: string) => {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatDate = (timestamp: number) => {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "Recently";
  }
};

export const ReviewList = ({
  reviews,
  isLoading,
  currentUserAddress,
  sellerAddress,
  promptId,
  onReviewUpdate,
}: ReviewListProps) => {
  const [voteLoading, setVoteLoading] = useState<Set<string>>(new Set());
  const [voteError, setVoteError] = useState<string | null>(null);
  const [respondToReviewId, setRespondToReviewId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseLoading, setResponseLoading] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editRating, setEditRating] = useState(0);
  const [editLoading, setEditLoading] = useState(false);

  const handleVote = async (reviewId: string) => {
    if (!currentUserAddress || !promptId) return;
    setVoteLoading((prev) => new Set(prev).add(reviewId));
    setVoteError(null);
    try {
      await ReviewClient.voteReview(promptId, reviewId, currentUserAddress);
      onReviewUpdate?.();
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setVoteLoading((prev) => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
    }
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!currentUserAddress || !promptId || !responseText.trim()) return;
    setResponseLoading(true);
    try {
      await ReviewClient.submitSellerResponse(promptId, reviewId, currentUserAddress, responseText.trim());
      setRespondToReviewId(null);
      setResponseText("");
      onReviewUpdate?.();
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setResponseLoading(false);
    }
  };

  const handleEdit = async (reviewId: string) => {
    if (!currentUserAddress || !promptId) return;
    setEditLoading(true); setVoteError(null);
    try {
      await ReviewClient.editReview(promptId, reviewId, currentUserAddress, editRating, editText.trim());
      setEditingReviewId(null); setEditText(""); onReviewUpdate?.();
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Failed to edit review");
    } finally { setEditLoading(false); }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-white/5 border border-white/5 animate-pulse"
          >
            <div className="h-4 w-32 bg-white/10 rounded mb-3" />
            <div className="h-3 w-full bg-white/10 rounded mb-2" />
            <div className="h-3 w-2/3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
          <User className="h-8 w-8 text-slate-600" />
        </div>
        <p className="text-slate-400 text-sm">No reviews yet</p>
        <p className="text-slate-500 text-xs mt-1">
          Be the first to share your experience
        </p>
      </div>
    );
  }

  const isSeller = (address: string) =>
    sellerAddress && address.toLowerCase() === sellerAddress.toLowerCase();

  return (
    <div className="space-y-4">
      {voteError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {voteError}
        </div>
      )}
      {reviews.map((review) => (
        <div
          key={review.id}
          className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {review.userAddress.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {formatAddress(review.userAddress)}
                  </span>
                  {review.verified && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                      Verified Buyer
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {formatDate(review.createdAt)}
                  {review.editedAt ? " (edited)" : ""}
                </span>
              </div>
            </div>
            <StarRating rating={review.rating} readonly size="sm" />
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            {review.text}
          </p>

          <div className="flex items-center gap-4">
            {currentUserAddress && currentUserAddress.toLowerCase() !== review.userAddress.toLowerCase() && promptId && (
              <button
                onClick={() => handleVote(review.id)}
                disabled={voteLoading.has(review.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  voteLoading.has(review.id)
                    ? "text-slate-600"
                    : "text-slate-400 hover:text-emerald-400"
                }`}
                aria-label={`${review.helpfulVotes} found this helpful. Click to vote.`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>Helpful ({review.helpfulVotes})</span>
              </button>
            )}
            {!currentUserAddress && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>Helpful ({review.helpfulVotes})</span>
              </span>
            )}
            {currentUserAddress === review.userAddress && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{review.helpfulVotes}</span>
              </span>
            )}
          </div>

          {currentUserAddress?.toLowerCase() === review.userAddress.toLowerCase() && promptId && editingReviewId !== review.id && (
            <button onClick={() => { setEditingReviewId(review.id); setEditText(review.text); setEditRating(review.rating); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-emerald-400">
              <Pencil className="h-3.5 w-3.5" /> Edit review
            </button>
          )}

          {editingReviewId === review.id && (
            <div className="mt-4 space-y-3">
              <StarRating rating={editRating} onRatingChange={setEditRating} size="sm" />
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={500} className="w-full min-h-[100px] p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm resize-none" aria-label="Edit review" />
              <div className="flex gap-2"><Button size="sm" onClick={() => handleEdit(review.id)} disabled={editLoading || editRating < 1 || editText.trim().length < 10} className="bg-emerald-500 text-slate-950">{editLoading ? "Saving..." : "Save changes"}</Button><Button size="sm" variant="ghost" onClick={() => setEditingReviewId(null)}>Cancel</Button></div>
            </div>
          )}

          {review.sellerResponse && (
            <div className="mt-4 ml-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Seller Response
                </span>
                <span className="text-xs text-slate-500">
                  {formatDate(review.sellerResponse.createdAt)}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {review.sellerResponse.text}
              </p>
            </div>
          )}

          {isSeller(currentUserAddress ?? "") &&
            !review.sellerResponse &&
            respondToReviewId !== review.id && (
              <button
                onClick={() => setRespondToReviewId(review.id)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Respond as seller
              </button>
            )}

          {respondToReviewId === review.id && (
            <div className="mt-4 space-y-3">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write your response as the seller..."
                className="w-full min-h-[80px] p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                maxLength={1000}
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSubmitResponse(review.id)}
                  disabled={responseLoading || !responseText.trim()}
                  size="sm"
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
                >
                  {responseLoading ? "Submitting..." : "Submit Response"}
                </Button>
                <Button
                  onClick={() => {
                    setRespondToReviewId(null);
                    setResponseText("");
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-slate-400"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
