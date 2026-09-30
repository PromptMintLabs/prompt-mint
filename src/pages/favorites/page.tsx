import { Link } from "react-router-dom";
import { BookmarkCheck, ArrowLeft, AlertCircle } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useWallet } from "@/hooks/useWallet";

export default function FavoritesPage() {
  const { address } = useWallet();
  const { bookmarks, remove, clear } = useBookmarks();

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-400">
              <BookmarkCheck className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-widest">
                Favorites
              </span>
            </div>
            <h1 className="text-3xl font-bold">Saved prompts</h1>
            <p className="mt-2 text-sm text-slate-400">
              {address
                ? "Your favorites follow your wallet across devices."
                : "Connect your wallet to see your favorites."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bookmarks.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={clear}
                className="text-slate-400 hover:text-white"
              >
                Clear all
              </Button>
            ) : null}
            <Button asChild variant="outline" className="border-white/15 bg-white/5">
              <Link to="/browse">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Browse
              </Link>
            </Button>
          </div>
        </div>

        {!address ? (
          <div className="rounded-xl border border-dashed border-amber-400/20 bg-amber-500/10 p-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-8 w-8 text-amber-400" />
            <p className="text-slate-300">
              Connect your Stellar wallet to view and manage your favorites.
            </p>
          </div>
        ) : bookmarks.length === 0 ? (
          <EmptyState
            variant="no-bookmarks"
            action={
              <Button
                asChild
                className="mt-6 bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400"
              >
                <Link to="/browse">Browse prompts</Link>
              </Button>
            }
            size="lg"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map((promptId) => (
              <Card
                key={promptId}
                className="border-white/10 bg-white/[0.03] text-white"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200">
                        Prompt #{promptId}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-wide">
                        ID: {promptId}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(promptId)}
                      className="shrink-0 text-slate-400 hover:text-red-400"
                      aria-label={`Remove prompt ${promptId} from favorites`}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      asChild
                      size="sm"
                      variant="link"
                      className="h-auto p-0 text-emerald-400"
                    >
                      <Link to={`/prompt/${promptId}`}>View details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
