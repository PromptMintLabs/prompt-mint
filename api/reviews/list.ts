import { getReviews } from "./data";

const SORTS = ["newest", "oldest", "helpful", "highest", "lowest"] as const;
type ReviewSort = (typeof SORTS)[number];

function parsePositiveInteger(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? parsed : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { promptId, page: rawPage, limit: rawLimit, sort: rawSort = "newest", rating: rawRating } = req.query;

  if (!promptId) {
    res.status(400).json({ error: "promptId query parameter is required" });
    return;
  }

  try {
    const reviews = getReviews(String(promptId));
    const page = parsePositiveInteger(rawPage, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInteger(rawLimit, 10, 50);
    const sort = String(rawSort) as ReviewSort;
    const rating = rawRating === undefined || rawRating === "" ? undefined : parsePositiveInteger(rawRating, 0, 5);

    if (!page || !limit || !SORTS.includes(sort) || (rawRating !== undefined && (!rating || rating > 5))) {
      res.status(400).json({ error: "Invalid pagination, sort, or rating filter" });
      return;
    }

    const visibleReviews = reviews.filter((review) => review.moderation?.status !== "removed");
    const filteredReviews = rating ? visibleReviews.filter((review) => review.rating === rating) : visibleReviews;
    const sortedReviews = [...filteredReviews].sort((a, b) => {
      const byId = a.id.localeCompare(b.id);
      switch (sort) {
        case "oldest": return a.createdAt - b.createdAt || byId;
        case "helpful": return b.helpfulVotes - a.helpfulVotes || b.createdAt - a.createdAt || byId;
        case "highest": return b.rating - a.rating || b.createdAt - a.createdAt || byId;
        case "lowest": return a.rating - b.rating || b.createdAt - a.createdAt || byId;
        default: return b.createdAt - a.createdAt || byId;
      }
    });
    const total = sortedReviews.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const pagedReviews = sortedReviews.slice(start, start + limit);

    const averageRating =
      visibleReviews.length > 0
        ? visibleReviews.reduce((sum, r) => sum + r.rating, 0) / visibleReviews.length
        : 0;

    res.status(200).json({
      reviews: pagedReviews.map((r) => ({
        id: r.id,
        promptId: r.promptId,
        userAddress: r.userAddress,
        rating: r.rating,
        text: r.text,
        createdAt: r.createdAt,
        verified: r.verified,
        helpfulVotes: r.helpfulVotes,
        editedAt: r.editedAt,
        sellerResponse: r.sellerResponse || null,
      })),
      stats: {
        total: visibleReviews.length,
        averageRating: Math.round(averageRating * 10) / 10,
        distribution: {
          5: visibleReviews.filter((r) => r.rating === 5).length,
          4: visibleReviews.filter((r) => r.rating === 4).length,
          3: visibleReviews.filter((r) => r.rating === 3).length,
          2: visibleReviews.filter((r) => r.rating === 2).length,
          1: visibleReviews.filter((r) => r.rating === 1).length,
        },
      },
      pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
      filters: { sort, rating: rating ?? null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch reviews";
    console.error("Review fetch error:", message);
    res.status(500).json({ error: message });
  }
}
