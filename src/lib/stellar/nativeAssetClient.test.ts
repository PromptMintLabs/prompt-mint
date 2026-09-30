import { beforeEach, describe, expect, it, vi } from "vitest";

const txMocks = vi.hoisted(() => ({
  getRpcServer: vi.fn(),
  scValArg: vi.fn((value: unknown, type?: string) => ({ value, type })),
  prepareContractCall: vi.fn(),
  submitPreparedTransaction: vi.fn(),
}));

vi.mock("./tx", () => txMocks);

import {
  approveNativeAssetSpend,
  NativeAssetApprovalError,
  type NativeAssetConfig,
} from "./nativeAssetClient";
import { getRpcServer, prepareContractCall, submitPreparedTransaction } from "./tx";

const config: NativeAssetConfig = {
  rpcUrl: "https://rpc.example.test",
  networkPassphrase: "Test SDF Network ; September 2015",
  nativeAssetContractId: "CABC",
};
const signer = { signTransaction: vi.fn() };

describe("approveNativeAssetSpend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRpcServer).mockReturnValue({
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1200 }),
    } as never);
    vi.mocked(prepareContractCall).mockResolvedValue({} as never);
    vi.mocked(submitPreparedTransaction).mockResolvedValue({ status: "SUCCESS" } as never);
  });

  it("uses an expiry relative to the latest ledger", async () => {
    await approveNativeAssetSpend(config, signer, "GOWNER", "GSPENDER", 500n);

    expect(prepareContractCall).toHaveBeenCalledWith(
      config,
      "GOWNER",
      config.nativeAssetContractId,
      "approve",
      [
        { value: "GOWNER", type: "address" },
        { value: "GSPENDER", type: "address" },
        { value: 500n, type: "i128" },
        { value: 1260, type: "u32" },
      ],
    );
    expect(submitPreparedTransaction).toHaveBeenCalledWith(config, {}, signer, "GOWNER");
  });

  it("surfaces wallet rejection as an actionable approval error", async () => {
    vi.mocked(submitPreparedTransaction).mockRejectedValue(new Error("User rejected request"));

    await expect(
      approveNativeAssetSpend(config, signer, "GOWNER", "GSPENDER", 500n),
    ).rejects.toMatchObject({
      name: "NativeAssetApprovalError",
      message: "Approval was declined in your wallet.",
    });
  });

  it("replaces opaque transaction result data with a readable failure", async () => {
    vi.mocked(submitPreparedTransaction).mockRejectedValue(
      new Error("Transaction failed: AQAAAA=="),
    );

    await expect(
      approveNativeAssetSpend(config, signer, "GOWNER", "GSPENDER", 500n),
    ).rejects.toMatchObject({
      name: "NativeAssetApprovalError",
      message: "The Stellar network rejected the approval. Check your wallet balance and network, then try again.",
    });
  });

  it("rejects non-positive approval amounts before contacting the RPC", async () => {
    await expect(
      approveNativeAssetSpend(config, signer, "GOWNER", "GSPENDER", 0n),
    ).rejects.toBeInstanceOf(NativeAssetApprovalError);

    expect(getRpcServer).not.toHaveBeenCalled();
  });
});