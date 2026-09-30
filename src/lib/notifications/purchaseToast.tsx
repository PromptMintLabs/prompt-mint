import React from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { explorerTxUrl } from "@/lib/stellar/explorer";

export interface ToastPurchaseSuccessOptions {
  title?: string;
  network?: string;
}

export interface ToastPurchaseErrorOptions {
  title?: string;
}

/**
 * Displays a success toast notification after buying a prompt or bundle,
 * including transaction hash and a direct link to the Stellar explorer.
 */
export function showPurchaseSuccessToast(
  txHash?: string,
  options?: ToastPurchaseSuccessOptions
) {
  const title = options?.title || "Purchase Successful!";
  const hash = txHash?.trim();
  const url = hash ? explorerTxUrl(hash, options?.network) : null;

  toast.success(title, {
    description: (
      <div className="mt-1 flex flex-col gap-1 text-xs">
        {hash && (
          <span className="font-mono text-slate-300" data-testid="toast-tx-hash">
            Tx: {hash.length > 22 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash}
          </span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
            data-testid="toast-explorer-link"
          >
            View in Explorer <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    ),
    duration: 6000,
  });
}

/**
 * Displays an error toast notification if prompt or bundle purchase fails.
 */
export function showPurchaseErrorToast(
  message?: string,
  options?: ToastPurchaseErrorOptions
) {
  const title = options?.title || "Purchase Failed";
  const desc = message || "An unexpected error occurred during purchase.";

  toast.error(title, {
    description: desc,
    duration: 6000,
  });
}
