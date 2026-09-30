import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { AppealSubmissionForm } from "@/components/moderation/AppealSubmissionForm";
import { useWallet } from "@/hooks/useWallet";
import { useSearchParams } from "react-router-dom";

export default function AppealsPage() {
  const { address, signMessage } = useWallet();
  const [searchParams] = useSearchParams();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_55%_35%_at_0%_0%,rgba(34,211,238,0.08),transparent),linear-gradient(180deg,#080b0f_0%,#0d1117_55%,#080b0f_100%)] text-white">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Marketplace moderation</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Appeal a review decision</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Explain why a moderation decision should be reconsidered. You can attach up to three files as supporting evidence.
          </p>
        </header>
        <AppealSubmissionForm
          key={searchParams.get("reviewId") ?? ""}
          address={address}
          signMessage={signMessage}
          initialReviewId={searchParams.get("reviewId") ?? ""}
        />
      </main>
      <Footer />
    </div>
  );
}