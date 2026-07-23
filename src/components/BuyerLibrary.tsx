import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Eye,
  Loader2,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { browserStellarConfig } from "@/lib/stellar/browserConfig";
import { getPromptsByBuyer, type PromptRecord } from "@/lib/stellar/promptHashClient";
import { formatPriceLabel } from "@/lib/stellar/format";
import { unlockPromptContent } from "@/lib/prompts/unlock";
import { UnlockExplainer, type UnlockState } from "@/components/UnlockExplainer";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { useNetworkState } from "@/hooks/useNetworkState";

const EXPECTED_NETWORK = stellarNetwork;

interface CachedBuyerLibrary {
  timestamp: number;
  prompts: PromptRecord[];
}

function getCachedBuyerPrompts(address?: string): CachedBuyerLibrary | null {
  if (!address) return null;
  try {
    const raw = window.localStorage.getItem(`prompt-mint:buyer-library-cache:${address}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCachedBuyerPrompts(address: string, prompts: PromptRecord[]) {
  try {
    window.localStorage.setItem(
      `prompt-mint:buyer-library-cache:${address}`,
      JSON.stringify({ timestamp: Date.now(), prompts }),
    );
  } catch {}
}

function EmptyLibrary() {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
      <div className="max-w-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-200/10 text-cyan-100">
          <BookOpenCheck className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">No purchases yet</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Prompts you purchase will appear here with a direct unlock path to the
          decrypted content.
        </p>
        <Button asChild className="mt-5 h-9 bg-cyan-200 text-slate-950 hover:bg-cyan-100 px-5">
          <Link to="/browse">
            <ShoppingBag className="h-4 w-4" />
            Browse marketplace
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DisconnectedState() {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
      <div className="max-w-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-700/50 text-slate-400">
          <PlugZap className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">Wallet not connected</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Connect your Stellar wallet to view prompts you have purchased.
        </p>
      </div>
    </div>
  );
}

function WrongNetworkState({ network }: { network?: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-8 text-center">
      <div className="max-w-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
          <WifiOff className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">Wrong network</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          You are connected to{" "}
          <span className="font-semibold text-amber-200">{network ?? "an unknown network"}</span>.
          Switch to{" "}
          <span className="font-semibold text-white">{EXPECTED_NETWORK}</span> to
          view your library.
        </p>
      </div>
    </div>
  );
}

function PromptLibraryCard({
  prompt,
  plaintext,
  unlockState,
  isBusy,
  onUnlock,
}: {
  prompt: PromptRecord;
  plaintext?: string;
  unlockState: UnlockState;
  isBusy: boolean;
  onUnlock: () => void;
}) {
  const isUnlocked = Boolean(plaintext);
  const showExplainer = unlockState !== "idle" && unlockState !== "success";

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0f1419] transition-colors hover:border-white/[0.18]">
      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className="border-cyan-200/30 bg-cyan-200/10 text-cyan-100">
                <BookOpenCheck className="mr-1 h-3 w-3" />
                License owned
              </Badge>
              <Badge className="border-white/10 bg-white/[0.04] text-slate-300">
                {prompt.category}
              </Badge>
              <Badge
                className={
                  isUnlocked
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                    : "border-amber-300/30 bg-amber-300/10 text-amber-100"
                }
              >
                {isUnlocked ? (
                  <Eye className="mr-1 h-3 w-3" />
                ) : (
                  <LockKeyhole className="mr-1 h-3 w-3" />
                )}
                {isUnlocked ? "Unlocked" : "Locked"}
              </Badge>
            </div>
            <h3 className="text-base font-semibold text-white leading-snug">
              {prompt.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 line-clamp-2">
              {prompt.previewText}
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Paid
            </p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {formatPriceLabel(prompt.priceStroops)} XLM
            </p>
          </div>
        </div>

        {/* Unlock explainer — shown for non-idle, non-success states */}
        {showExplainer && (
          <UnlockExplainer
            state={unlockState}
            onRetry={
              unlockState === "rejected" ||
              unlockState === "expired" ||
              unlockState === "failed"
                ? onUnlock
                : undefined
            }
          />
        )}

        {/* Unlocked content */}
        {isUnlocked && (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Decrypted content
            </div>
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-200">
              {plaintext}
            </pre>
          </div>
        )}

        {/* Action button */}
        <Button
          className="h-9 bg-cyan-200 text-slate-950 hover:bg-cyan-100 disabled:opacity-50 text-xs font-bold"
          onClick={onUnlock}
          disabled={isBusy || unlockState === "signing" || unlockState === "verifying"}
        >
          {isBusy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Unlocking…
            </>
          ) : isUnlocked ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              Re-open prompt
            </>
          ) : (
            <>
              <LockKeyhole className="h-3.5 w-3.5" />
              Unlock full prompt
            </>
          )}
        </Button>
      </div>
    </article>
  );
}

export function BuyerLibrary() {
  const { address, network, signMessage } = useWallet();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Record<string, string>>({});
  const [unlockStates, setUnlockStates] = useState<Record<string, UnlockState>>({});

  const isWrongNetwork =
    Boolean(address) &&
    Boolean(network) &&
    network?.toLowerCase() !== EXPECTED_NETWORK.toLowerCase();

  const networkState = useNetworkState();

  const query = useQuery({
    queryKey: ["buyer-library", address],
    queryFn: async () => {
      if (!address) return [];
      try {
        const livePrompts = await getPromptsByBuyer(browserStellarConfig, address);
        if (livePrompts && livePrompts.length > 0) {
          setCachedBuyerPrompts(address, livePrompts);
        }
        return livePrompts;
      } catch (err) {
        const cached = getCachedBuyerPrompts(address);
        if (cached && cached.prompts.length > 0) {
          return cached.prompts;
        }
        throw err;
      }
    },
    enabled: Boolean(address) && !isWrongNetwork,
  });

  const cachedData = getCachedBuyerPrompts(address);
  const prompts = query.data ?? cachedData?.prompts ?? [];
  const isUsingCache = query.isError || !networkState.isOnline || (query.isSuccess && !query.isFetchedAfterMount);
  const freshnessTimestamp = query.dataUpdatedAt || cachedData?.timestamp || null;

  const setUnlockState = (id: string, state: UnlockState) =>
    setUnlockStates((prev) => ({ ...prev, [id]: state }));

  const handleUnlock = async (prompt: PromptRecord) => {
    if (!address || !signMessage) return;
    const id = prompt.id.toString();
    setBusyId(id);
    setUnlockState(id, "signing");
    try {
      const result = await unlockPromptContent(address, id, signMessage);
      setUnlockState(id, "success");
      setUnlocked((prev) => ({ ...prev, [id]: result.plaintext }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("declined") || msg.toLowerCase().includes("rejected")) {
        setUnlockState(id, "rejected");
      } else if (msg.toLowerCase().includes("expired")) {
        setUnlockState(id, "expired");
      } else {
        setUnlockState(id, "failed");
      }
    } finally {
      setBusyId(null);
    }
  };

  if (!address) return <DisconnectedState />;
  if (isWrongNetwork) return <WrongNetworkState network={network} />;

  if (query.isLoading && prompts.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl border border-white/5 bg-white/[0.02] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (query.isError && prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-8 text-center gap-3">
        <p className="text-sm font-medium text-rose-300">Failed to load library</p>
        <p className="text-xs text-slate-400">
          Could not read purchased prompts from the contract.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void query.refetch()}
          className="border border-white/10 text-slate-300 hover:bg-white/10 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (prompts.length === 0) return <EmptyLibrary />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <FreshnessBadge
          timestamp={freshnessTimestamp}
          isCached={isUsingCache}
          isOffline={!networkState.isOnline}
          isDegraded={networkState.isDegraded}
        />
        {!networkState.canTrustConfirmation && (
          <div className="text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg">
            Unlock Service Unavailable — Reconnect to verify on-chain license
          </div>
        )}
      </div>

      {prompts.map((prompt) => {
        const id = prompt.id.toString();
        return (
          <PromptLibraryCard
            key={id}
            prompt={prompt}
            plaintext={unlocked[id]}
            unlockState={unlockStates[id] ?? "idle"}
            isBusy={busyId === id}
            onUnlock={() => void handleUnlock(prompt)}
          />
        );
      })}
    </div>
  );
}
