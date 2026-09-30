import { Link } from "react-router-dom";
import { ArrowLeft, Check, CircleAlert, ShieldCheck } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";

const reviewGuidelines = [
  "Describe your own experience using the prompt. Reviews are for verified buyers.",
  "Be specific about what worked, what did not, and the results you saw.",
  "Keep your rating and written feedback fair, honest, and relevant to the prompt.",
  "Disclose any incentive or other relationship that could affect your opinion.",
];

const prohibitedContent = [
  "Threats, harassment, hate speech, or attacks on a person or group.",
  "Personal or confidential information, including contact details or private conversations.",
  "Spam, advertising, referral links, or content unrelated to the prompt.",
  "False claims presented as fact, impersonation, or reviews written on someone else's behalf.",
  "Content that promotes illegal activity or violates another person's rights.",
];

export default function ReviewPolicy() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_55%_35%_at_0%_0%,rgba(251,191,36,0.08),transparent),linear-gradient(180deg,#080b0f_0%,#101411_55%,#080b0f_100%)] text-white">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <Link
          to="/browse"
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>

        <header className="mb-10 border-b border-white/10 pb-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Community standards
          </p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Review Content Policy
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Reviews help buyers understand what a prompt is like to use. Keep
            feedback genuine, useful, and respectful so the marketplace can
            make better decisions.
          </p>
        </header>

        <div className="grid gap-10 md:grid-cols-2">
          <section aria-labelledby="helpful-reviews-heading">
            <h2 id="helpful-reviews-heading" className="mb-5 flex items-center gap-2 text-xl font-semibold">
              <Check className="h-5 w-5 text-emerald-300" />
              Write a helpful review
            </h2>
            <ul className="space-y-4">
              {reviewGuidelines.map((guideline) => (
                <li key={guideline} className="flex gap-3 text-sm leading-6 text-slate-300">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{guideline}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="not-allowed-heading">
            <h2 id="not-allowed-heading" className="mb-5 flex items-center gap-2 text-xl font-semibold">
              <CircleAlert className="h-5 w-5 text-amber-300" />
              Do not include
            </h2>
            <ul className="space-y-4">
              {prohibitedContent.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-300">
                  <CircleAlert className="mt-1 h-4 w-4 shrink-0 text-amber-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-10 border-t border-white/10 pt-8" aria-labelledby="review-basics-heading">
          <h2 id="review-basics-heading" className="text-lg font-semibold text-white">
            Review basics
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Reviews are public and tied to a verified purchase. You can submit
            one review per prompt, with a rating from 1 to 5 stars and written
            feedback between 10 and 500 characters. Submitting a review means
            you agree to follow this policy. Content that violates these
            standards may be removed.
          </p>
        </section>

        <div className="mt-8">
          <Link
            to="/browse"
            className="inline-flex min-h-10 items-center rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-200"
          >
            Browse prompts
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}