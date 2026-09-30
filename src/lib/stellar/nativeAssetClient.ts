import {
  getRpcServer,
  scValArg,
  prepareContractCall,
  submitPreparedTransaction,
  type StellarNetworkConfig,
  type WalletTransactionSigner,
} from "./tx";

export interface NativeAssetConfig extends StellarNetworkConfig {
  nativeAssetContractId: string;
}

const DEFAULT_APPROVAL_DURATION_LEDGERS = 60;

export class NativeAssetApprovalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NativeAssetApprovalError";
  }
}

function describeApprovalFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/user rejected|declined/i.test(message)) {
    return "Approval was declined in your wallet.";
  }
  if (/op_underfunded|insufficient balance|insufficient funds/i.test(message)) {
    return "Your wallet does not have enough XLM to submit the approval.";
  }
  if (/op_no_trust|trustline/i.test(message)) {
    return "This approval requires the native asset trustline to be available in your wallet.";
  }
  if (/^(Transaction failed|Transaction submission failed):\s*[A-Za-z0-9+/=]+\.?$/i.test(message)) {
    return "The Stellar network rejected the approval. Check your wallet balance and network, then try again.";
  }
  return `Native asset approval failed: ${message}`;
}

export async function approveNativeAssetSpend(
  config: NativeAssetConfig,
  signer: WalletTransactionSigner,
  owner: string,
  spender: string,
  amount: bigint,
  approvalDurationLedgers = DEFAULT_APPROVAL_DURATION_LEDGERS,
) {
  if (amount <= 0n) {
    throw new NativeAssetApprovalError("Approval amount must be greater than zero.");
  }
  if (!Number.isSafeInteger(approvalDurationLedgers) || approvalDurationLedgers <= 0) {
    throw new NativeAssetApprovalError("Approval duration must be a positive whole number of ledgers.");
  }

  try {
    const { sequence: latestLedger } = await getRpcServer(config).getLatestLedger();
    const expirationLedger = latestLedger + approvalDurationLedgers;
    if (!Number.isSafeInteger(expirationLedger) || expirationLedger > 0xffff_ffff) {
      throw new Error("The calculated approval expiration is outside the supported ledger range.");
    }

    const prepared = await prepareContractCall(
      config,
      owner,
      config.nativeAssetContractId,
      "approve",
      [
        scValArg(owner, "address"),
        scValArg(spender, "address"),
        scValArg(amount, "i128"),
        scValArg(expirationLedger, "u32"),
      ],
    );

    return await submitPreparedTransaction(config, prepared, signer, owner);
  } catch (error) {
    if (error instanceof NativeAssetApprovalError) throw error;
    throw new NativeAssetApprovalError(describeApprovalFailure(error), { cause: error });
  }
}
