/**
 * BundleModal
 *
 * Detail + checkout modal for a bundle listing.
 * Mirrors the structure of PromptModal but handles the multi-prompt
 * unlock flow via unlockBundleContent.
 */
import { useContext, useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Eye,
  Layers,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyPrice } from "@/components/CurrencyPrice";
import { WalletContext } from "@/providers/WalletProvider";
import { browserStellarConfig } from "@/lib/stellar/browserConfig";
import {
  BundleHashClient,
  type BundleRecord,
  type PromptRecord,
} from "@/lib/stellar/promptHashClient";
import { unlockBundleContent, type UnlockedBundleItem } from "@/lib/prompts/unlockBundle";
import { copyToClipboard } from "@/lib/clipboard/secureClipboard";
import { useNetworkState } from "@/hooks/useNetworkState";
import { detectNetworkMismatch } from "@/lib/wallet/networkDetection";
import { shortenAddress } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuyStatus =
  | "IDLE"
  | "AWAITING_APPROVAL"
  | "CONFIRMING"
  | "PURCHASED_LOCKED"
  | "UNLOCKING"
  | "SUCCESS"
  | "ERROR";

interface BundleModalProps {
  bundle: BundleRecord;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

// ─── UnlockedItemCard ─────────────────────────────────────────────────────────

function UnlockedItemCard({ item }: { item: UnlockedBundleItem }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    const result = await copyToClipboard(item.plaintext);
    setCopied(result.success);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            {item.title}
          </span>
          <span className="text-[10px] font-mono text-slate-500 truncate hidden sm:block">
            #{item.promptId}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-200 rounded-lg bg-black/30 p-3">
            {item.plaintext}
          </pre>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-600 truncate">
              hash: {item.contentHash.slice(0, 16)}…
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-3 text-xs text-slate-400 hover:text-white"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BundleModal ──────────────────────────────────────────────────────────────

export function BundleModal({
  bundle,
  isOpen,
  onClose,
  onRefresh,
}: BundleModalProps) {
  const wallet = useContext(WalletContext);
  const networkState = useNetworkState();

  const [status, setStatus] = useState<BuyStatus>("IDLE");
  const [unlockedItems, setUnlockedItems] = useState<UnlockedBundleItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  // Fetch member prompt metadata for the preview list
  const { data: allPrompts } = useQuery<PromptRecord[]>({
    queryKey: ["marketplace-prompts"],
    staleTime: 60_000,
  });

  const memberPrompts = (allPrompts ?? []).filter((p) =>
    bundle.promptIds.some((id) => id === p.id),
  );

  // Check existing access on open
  useEffect(() => {
    if (!isOpen) return;
    lastActiveRef.current = document.activeElement as HTMLElement;
    setTimeout(() => closeButtonRef.current?.focus(), 0);

    if (wallet?.address) {
      setIsCheckingAccess(true);
      BundleHashClient.hasBundleAccess(
        browserStellarConfig,
        wallet.address,
        bundle.id,
      )
        .then((has) => setStatus(has ? "PURCHASED_LOCKED" : "IDLE"))
        .catch(() => setStatus("IDLE"))
        .finally(() => setIsCheckingAccess(false));
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { last.focus(); e.preventDefault(); }
        } else {
          if (document.activeElement === last) { first.focus(); e.preventDefault(); }
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      lastActiveRef.current?.focus();
    };
  }, [isOpen, bundle.id, onClose, wallet?.address]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePurchase = async () => {
    if (!wallet?.address) return;
    setErrorMessage(null);

    if (!networkState.canTrustConfirmation) {
      setErrorMessage(
        "Network connection lost. Transaction confirmation cannot be trusted.",
      );
      return;
    }

    const mismatch = detectNetworkMismatch(
      !!wallet.address,
      wallet.network,
      wallet.status,
    );
    if (mismatch.type === "wrong-network") {
      setErrorMessage(mismatch.message || "Wrong network connected.");
      return;
    }

    try {
      setStatus("AWAITING_APPROVAL");
      await BundleHashClient.buyBundle(
        browserStellarConfig,
        { signTransaction: wallet.signTransaction },
        wallet.address,
        bundle.id,
        bundle.priceStroops,
      );
      setStatus("PURCHASED_LOCKED");
      onRefresh?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed.";
      setErrorMessage(msg);
      setStatus("ERROR");
    }
  };

  const handleUnlock = async () => {
    if (!wallet?.address || !wallet.signMessage) return;
    setErrorMessage(null);
    setStatus("UNLOCKING");
    try {
      const result = await unlockBundleContent(
        wallet.address,
        bundle.id,
        wallet.signMessage,
      );
      setUnlockedItems(result.items);
      setStatus("SUCCESS");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unlock failed.";
      setErrorMessage(msg);
      setStatus("PURCHASED_LOCKED");
    }
  };

  if (!isOpen) return null;

  const isPurchased =
    status === "PURCHASED_LOCKED" || status === "SUCCESS";
  const isBusy =
    status === "AWAITING_APPROVAL" ||
    status === "CONFIRMING" ||
    status === "UNLOCKING";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:p-4">
      <div
        ref={modalRef}
        className="relative max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 shadow-2xl sm:rounded-[32px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bundle-modal-title"
        aria-describedby="bundle-modal-description"
      >
        {/* Top colour strip — violet for bundles */}
        <div className="h-2 w-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />

        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-slate-400 hover:text-white transition-all z-10"
          aria-label="Close bundle modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-violet-600/20 text-violet-300 border-violet-500/30">
                <Layers className="h-3 w-3 mr-1" />
                Bundle
              </Badge>
              {bundle.salesCount > 0 && (
                <span className="text-xs text-slate-500">
                  {bundle.salesCount} sold
                </span>
              )}
            </div>
            <h2
              id="bundle-modal-title"
              className="text-2xl font-bold text-white"
            >
              {bundle.title}
            </h2>
            <p
              id="bundle-modal-description"
              className="mt-1 text-sm text-slate-400 leading-relaxed"
            >
              {bundle.description}
            </p>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-3 w-3 text-slate-400" />
                <p className="text-xs text-slate-400">Creator</p>
              </div>
              <p className="text-xs font-mono text-white truncate" title={bundle.creator}>
                {shortenAddress(bundle.creator)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-3 w-3 text-slate-400" />
                <p className="text-xs text-slate-400">Contents</p>
              </div>
              <p className="text-sm font-bold text-white">
                {bundle.promptIds.length} prompt
                {bundle.promptIds.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="col-span-2 p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-3 w-3 text-slate-400" />
                <p className="text-xs text-slate-400">Bundle price</p>
              </div>
              <p className="text-xl font-black text-violet-400 font-mono tracking-tight">
                <CurrencyPrice stroops={bundle.priceStroops} />
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                One payment unlocks all {bundle.promptIds.length} prompts
              </p>
            </div>
          </div>

          {/* Member prompt list */}
          {memberPrompts.length > 0 && (
            <div className="mb-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                Included prompts
              </p>
              {memberPrompts.map((p) => (
                <div
                  key={p.id.toString()}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5"
                >
                  <Layers className="h-3.5 w-3.5 text-violet-400/70 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {p.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {p.category}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="ml-auto shrink-0 text-[10px] text-slate-400 border-white/10"
                  >
                    {p.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Purchase / owned indicator */}
          {isPurchased && !unlockedItems.length && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300 font-semibold">
                You own this bundle — unlock the prompts below
              </p>
            </div>
          )}

          {/* Unlocked items */}
          {status === "SUCCESS" && unlockedItems.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  Decrypted prompts
                </p>
              </div>
              {unlockedItems.map((item) => (
                <UnlockedItemCard key={item.promptId} item={item} />
              ))}
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {isCheckingAccess ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking access…
            </div>
          ) : (
            <div className="space-y-3">
              {/* Primary action button */}
              {status === "SUCCESS" ? (
                <Button
                  className="w-full h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold"
                  onClick={handleUnlock}
                  disabled={isBusy}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Re-unlock all prompts
                </Button>
              ) : (isPurchased || status === "UNLOCKING") ? (
                <Button
                  className="w-full h-10 bg-cyan-200 text-slate-950 hover:bg-cyan-100 font-bold"
                  onClick={handleUnlock}
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Unlocking…
                    </>
                  ) : (
                    <>
                      <LockKeyhole className="h-4 w-4 mr-2" />
                      Unlock all {bundle.promptIds.length} prompts
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full h-10 bg-violet-600 text-white hover:bg-violet-500 font-bold disabled:opacity-50"
                  onClick={handlePurchase}
                  disabled={!wallet?.address || isBusy || !bundle.active}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {status === "AWAITING_APPROVAL"
                        ? "Awaiting approval…"
                        : "Confirming…"}
                    </>
                  ) : !bundle.active ? (
                    "Bundle unavailable"
                  ) : !wallet?.address ? (
                    "Connect wallet to purchase"
                  ) : (
                    <>
                      <Layers className="h-4 w-4 mr-2" />
                      Purchase bundle ·{" "}
                      <span className="ml-1">
                        <CurrencyPrice stroops={bundle.priceStroops} />
                      </span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
