import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowUpRight, Loader2, Receipt, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TransactionHistorySkeleton } from "@/components/PageSkeletons";
import {
  AddressTooltip,
  XlmAmountTooltip,
  TimestampTooltip,
} from "@/components/ui/Tooltip";
import {
  fetchBuyerTransactionHistory,
  fetchCreatorTransactionHistory,
  type TransactionHistoryRow,
} from "@/lib/prompts/transactionHistory";
import { buildTransactionExplorerUrl } from "@/lib/stellar/explorer";
import { formatPriceLabel } from "@/lib/stellar/format";
import { buildPromptSharePath } from "@/lib/marketplace/shareUrls";

export interface TransactionHistoryPanelProps {
  walletAddress: string;
  role: "buyer" | "creator";
  title: string;
  description: string;
  emptyMessage: string;
}

function TransactionRow({
  row,
  role,
}: {
  row: TransactionHistoryRow;
  role: "buyer" | "creator";
}) {
  const counterparty =
    role === "buyer" ? row.creatorWallet : row.buyerWallet;
  const counterpartyLabel = role === "buyer" ? "Creator" : "Buyer";
  const explorerUrl = buildTransactionExplorerUrl(row.txHash);
  const promptPath = buildPromptSharePath(row.promptOnChainId);

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-white truncate">{row.promptTitle}</p>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              #{row.promptOnChainId}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            <TimestampTooltip value={row.occurredAt} /> ·{" "}
            <XlmAmountTooltip
              stroops={row.priceStroops}
              label={formatPriceLabel(row.priceStroops)}
            />
          </p>
          <p className="text-xs text-slate-500">
            {counterpartyLabel}: <AddressTooltip address={counterparty} />
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent text-white hover:bg-white/10"
          >
            <Link to={promptPath}>
              View listing
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {explorerUrl ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-cyan-200/30 text-cyan-100 hover:bg-cyan-200/10"
            >
              <a href={explorerUrl} target="_blank" rel="noreferrer">
                On-chain tx
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : (
            <span className="self-center text-xs text-slate-500">Tx hash pending</span>
          )}
        </div>
      </div>
    </li>
  );
}

export function TransactionHistoryPanel({
  walletAddress,
  role,
  title,
  description,
  emptyMessage,
}: TransactionHistoryPanelProps) {
  const query = useQuery({
    queryKey: ["transaction-history", role, walletAddress],
    queryFn: () =>
      role === "buyer"
        ? fetchBuyerTransactionHistory(walletAddress)
        : fetchCreatorTransactionHistory(walletAddress),
    enabled: Boolean(walletAddress),
  });

  const isInvalidWallet =
    query.isError &&
    query.error instanceof Error &&
    (query.error.message.toLowerCase().includes("invalid stellar") ||
      (query.error as Error & { status?: number }).status === 400);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-200/10 text-cyan-100">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/15 text-white hover:bg-white/10"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {query.isLoading ? (
        <TransactionHistorySkeleton />
      ) : null}

      {isInvalidWallet ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Connect a valid Stellar wallet to load transaction history.
        </div>
      ) : null}

      {!query.isLoading && query.isError && !isInvalidWallet ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {query.error instanceof Error
              ? query.error.message
              : "Failed to load transaction history."}
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-rose-500 text-white hover:bg-rose-600"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!query.isLoading && !query.isError && (query.data?.transactions.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
          {emptyMessage}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && (query.data?.transactions.length ?? 0) > 0 ? (
        <ul className="space-y-3">
          {query.data!.transactions.map((row) => (
            <TransactionRow key={row.id} row={row} role={role} />
          ))}
        </ul>
      ) : null}

      <p className="text-xs leading-5 text-slate-500">
        History reflects indexed on-chain purchases and recorded license claims. It does not
        grant unlock access — use your library and on-chain entitlements to open purchased
        content.
      </p>
    </section>
  );
}
