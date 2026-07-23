import { useWallet } from "../hooks/useWallet";
import { Navigation } from "../components/navigation";
import { Footer } from "../components/footer";
import { AuditLogViewer } from "../components/moderation/AuditLogViewer";

export default function ModerationPage() {
  const { address } = useWallet();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_35%),linear-gradient(180deg,_#020617,_#0f172a_45%,_#020617)] text-white">
      <Navigation />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Moderation Dashboard</h1>
          <p className="text-slate-400 text-sm mt-2">
            Review and audit moderation actions taken on the marketplace
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-6 sm:p-8">
          <AuditLogViewer moderatorAddress={address ?? ""} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
