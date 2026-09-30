import { useState } from "react";
import { ArrowLeft, ArrowRight, MessageSquareText, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "Open one of your listings",
    description: "Go to Browse and open a listing you created to see its reviews.",
  },
  {
    title: "Find the review",
    description: "Scroll to Reviews and choose a buyer review that does not already have a seller response.",
  },
  {
    title: "Choose Respond as seller",
    description: "This action is available when the connected wallet is the verified seller for that listing.",
  },
  {
    title: "Write and submit your reply",
    description: "Keep it helpful and respectful. Responses can be up to 1,000 characters; submitting again updates your existing reply.",
  },
];

export function SellerResponseTour() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <section
      aria-label="Seller response tour"
      className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MessageSquareText className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Respond to a review</h2>
            <p className="text-xs text-slate-400">A quick tour of seller replies.</p>
          </div>
        </div>
        {activeStep === null ? (
          <Button
            size="sm"
            className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            onClick={() => setActiveStep(0)}
          >
            Start tour
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={() => setActiveStep(null)}
            aria-label="Close seller response tour"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {activeStep !== null && (
        <div className="mt-4 border-t border-emerald-400/10 pt-4" aria-live="polite">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase text-emerald-200">
              Step {activeStep + 1} of {steps.length}
            </p>
            <div
              className="h-1 w-24 overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-label="Tour progress"
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={activeStep + 1}
            >
              <div
                className="h-full bg-emerald-400 transition-[width]"
                style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
          <h3 className="text-base font-semibold text-white">{steps[activeStep].title}</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
            {steps[activeStep].description}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {activeStep === steps.length - 1 ? (
              <Link
                to="/browse"
                className="inline-flex min-h-9 items-center rounded-md bg-emerald-400 px-3 text-sm font-medium text-slate-950 hover:bg-emerald-300"
              >
                Browse listings
              </Link>
            ) : <span />}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                onClick={() => setActiveStep((step) => Math.max(0, (step ?? 0) - 1))}
                disabled={activeStep === 0}
              >
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              {activeStep < steps.length - 1 ? (
                <Button
                  size="sm"
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  onClick={() => setActiveStep((step) => Math.min(steps.length - 1, (step ?? 0) + 1))}
                >
                  Next
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  onClick={() => setActiveStep(null)}
                >
                  Finish
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}