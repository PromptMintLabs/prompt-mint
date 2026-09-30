import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { AppealStatusTimeline } from "./AppealStatusTimeline";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 3 * 1024 * 1024;

interface AppealSubmissionFormProps {
  address?: string;
  // eslint-disable-next-line no-unused-vars
  signMessage(_message: string): Promise<{ signedMessage?: string } | string>;
  initialReviewId?: string;
}

interface AppealReceipt {
  appealId: string;
  submittedAt: string;
}

interface EncodedAttachment {
  name: string;
  size: number;
  content: string;
}

async function encodeFile(file: File): Promise<EncodedAttachment> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return { name: file.name, size: file.size, content: btoa(binary) };
}

export function AppealSubmissionForm({ address, signMessage, initialReviewId = "" }: AppealSubmissionFormProps) {
  const [reviewId, setReviewId] = useState(initialReviewId);
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<AppealReceipt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    const nextFiles = [...files, ...selected];
    const totalBytes = nextFiles.reduce((sum, file) => sum + file.size, 0);

    if (nextFiles.length > MAX_FILES) {
      setError(`Attach no more than ${MAX_FILES} supporting files.`);
    } else if (selected.some((file) => file.size > MAX_FILE_BYTES)) {
      setError("Each supporting file must be 1 MB or smaller.");
    } else if (totalBytes > MAX_TOTAL_FILE_BYTES) {
      setError("Supporting files must total 3 MB or less.");
    } else {
      setError("");
      setFiles(nextFiles);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!address) {
      setError("Connect the wallet that submitted this review to appeal the decision.");
      return;
    }
    if (!reviewId.trim()) {
      setError("Enter the review reference shown with the moderation decision.");
      return;
    }
    if (reason.trim().length < 20) {
      setError("Explain why you are appealing in at least 20 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const challengeResponse = await fetch("/api/reviews/appeal-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, reviewId: reviewId.trim() }),
      });
      if (!challengeResponse.ok) {
        const data = await challengeResponse.json().catch(() => ({}));
        throw new Error(data.error || "Could not verify appeal eligibility");
      }
      const challenge = await challengeResponse.json();
      const walletResult = await signMessage(challenge.challenge);
      const signedMessage = typeof walletResult === "string" ? walletResult : walletResult?.signedMessage;
      if (!signedMessage) throw new Error("Wallet did not return a signed message");

      const attachments = await Promise.all(files.map(encodeFile));
      const response = await fetch("/api/reviews/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          reviewId: reviewId.trim(),
          reason: reason.trim(),
          token: challenge.token,
          signedMessage,
          attachments,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Appeal submission failed");
      }

      const data = await response.json();
      setReceipt({ appealId: data.appealId, submittedAt: data.submittedAt });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Appeal submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="space-y-5" aria-live="polite">
        <div className="border-b border-white/10 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Appeal received</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Your appeal is in the review queue</h2>
          <p className="mt-2 text-sm text-slate-400">Reference: <span className="font-mono text-slate-300">{receipt.appealId}</span></p>
        </div>
        <AppealStatusTimeline
          currentStatus="submitted"
          events={[{
            status: "submitted",
            occurredAt: receipt.submittedAt,
            note: "Your appeal and supporting files have been received.",
          }]}
        />
        <Button type="button" variant="outline" onClick={() => setReceipt(null)}>
          Submit another appeal
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="appeal-review-id" className="text-sm font-medium text-slate-200">Review reference</label>
          <Input
            id="appeal-review-id"
            value={reviewId}
            onChange={(event) => setReviewId(event.target.value)}
            placeholder="review_..."
            maxLength={120}
            required
            className="border-white/15 bg-white/[0.04] text-white"
          />
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-slate-200">Appealing as</span>
          <p className="min-h-10 truncate rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 font-mono text-xs text-slate-400">
            {address || "Connect your wallet"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="appeal-reason" className="text-sm font-medium text-slate-200">Why should this decision be reconsidered?</label>
        <Textarea
          id="appeal-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain what you believe was misunderstood and provide relevant context."
          minLength={20}
          maxLength={3000}
          required
          className="min-h-32 resize-y border-white/15 bg-white/[0.04] text-white placeholder:text-slate-500"
          aria-describedby="appeal-reason-count"
        />
        <p id="appeal-reason-count" className="text-right text-xs text-slate-500">{reason.length}/3000</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label htmlFor="appeal-files" className="text-sm font-medium text-slate-200">Supporting files</label>
            <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPEG, WebP, or plain text. Up to 3 files, 1 MB each, 3 MB total.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES || isSubmitting}
          >
            <Paperclip className="mr-2 h-4 w-4" />
            Add files
          </Button>
          <input
            ref={fileInputRef}
            id="appeal-files"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Choose supporting files"
          />
        </div>

        {files.length > 0 && (
          <ul className="space-y-2" aria-label="Selected supporting files">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-cyan-200" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{file.name}</span>
                <span className="text-xs tabular-nums text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                  disabled={isSubmitting}
                  className="h-8 w-8 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

      <Button type="submit" disabled={isSubmitting || !address} className="bg-emerald-300 font-semibold text-slate-950 hover:bg-emerald-200">
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        {isSubmitting ? "Submitting appeal..." : "Submit appeal"}
      </Button>
    </form>
  );
}