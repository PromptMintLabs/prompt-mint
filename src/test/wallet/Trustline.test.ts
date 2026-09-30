import { describe, it, expect, vi, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

vi.mock("@/util/wallet", () => ({ fetchBalance: vi.fn() }));

import {
  detectTrustlines,
  evaluateTrustlines,
  parseTrustlineAssets,
  type HorizonBalanceLine,
  type TrustlineAsset,
} from "@/lib/wallet/trustline";

const ISSUER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const OTHER_ISSUER = Keypair.fromRawEd25519Seed(
  Buffer.alloc(32, 2),
).publicKey();
const ACCOUNT = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();

const USDC: TrustlineAsset = { code: "USDC", issuer: ISSUER };
const native: HorizonBalanceLine = { asset_type: "native" };
const usdcLine = (
  extra: Partial<HorizonBalanceLine> = {},
): HorizonBalanceLine => ({
  asset_type: "credit_alphanum4",
  asset_code: "USDC",
  asset_issuer: ISSUER,
  ...extra,
});

describe("parseTrustlineAssets", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns an empty list when nothing is configured", () => {
    expect(parseTrustlineAssets(undefined)).toEqual([]);
    expect(parseTrustlineAssets("")).toEqual([]);
    expect(parseTrustlineAssets(" , ")).toEqual([]);
  });

  it("parses CODE:ISSUER pairs and trims whitespace", () => {
    expect(
      parseTrustlineAssets(` USDC:${ISSUER} , EURC:${OTHER_ISSUER} `),
    ).toEqual([
      { code: "USDC", issuer: ISSUER },
      { code: "EURC", issuer: OTHER_ISSUER },
    ]);
  });

  it("collapses duplicates", () => {
    expect(parseTrustlineAssets(`USDC:${ISSUER},USDC:${ISSUER}`)).toHaveLength(
      1,
    );
  });

  it("skips malformed entries without throwing", () => {
    const parsed = parseTrustlineAssets(
      [
        "USDC", // no issuer
        `USDC:not-a-key`, // bad issuer
        `TOOLONGASSETCODE:${ISSUER}`, // code > 12 chars
        `BAD-CODE:${ISSUER}`, // illegal character
        `XLM:${ISSUER}`, // native never needs a trustline
        `A:B:C`, // extra segment
        `EURC:${OTHER_ISSUER}`, // the only valid one
      ].join(","),
    );
    expect(parsed).toEqual([{ code: "EURC", issuer: OTHER_ISSUER }]);
    expect(console.warn).toHaveBeenCalledTimes(6);
  });
});

describe("evaluateTrustlines", () => {
  it("marks a matching credit line as present", () => {
    expect(evaluateTrustlines([native, usdcLine()], [USDC])).toEqual([
      { asset: USDC, state: "present" },
    ]);
  });

  it("marks an absent asset as missing", () => {
    expect(evaluateTrustlines([native], [USDC])).toEqual([
      { asset: USDC, state: "missing" },
    ]);
  });

  it("does not match the same code from a different issuer", () => {
    const spoof = usdcLine({ asset_issuer: OTHER_ISSUER });
    expect(evaluateTrustlines([native, spoof], [USDC])[0].state).toBe(
      "missing",
    );
  });

  it("flags a trustline the issuer has not authorized", () => {
    expect(
      evaluateTrustlines([usdcLine({ is_authorized: false })], [USDC])[0].state,
    ).toBe("unauthorized");
    expect(
      evaluateTrustlines([usdcLine({ is_authorized: true })], [USDC])[0].state,
    ).toBe("present");
  });

  it("ignores liquidity pool shares", () => {
    const pool: HorizonBalanceLine = { asset_type: "liquidity_pool_shares" };
    expect(evaluateTrustlines([pool], [USDC])[0].state).toBe("missing");
  });
});

describe("detectTrustlines", () => {
  it("skips the network call when no assets are required", async () => {
    const fetcher = vi.fn();
    const result = await detectTrustlines(ACCOUNT, [], fetcher);
    expect(result).toEqual({ status: "not-required", results: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports ok when every trustline is present", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ balances: [native, usdcLine()] });
    const result = await detectTrustlines(ACCOUNT, [USDC], fetcher);
    expect(fetcher).toHaveBeenCalledWith(ACCOUNT);
    expect(result.status).toBe("ok");
  });

  it("accepts a bare balances array", async () => {
    const fetcher = vi.fn().mockResolvedValue([native, usdcLine()]);
    expect((await detectTrustlines(ACCOUNT, [USDC], fetcher)).status).toBe(
      "ok",
    );
  });

  it("reports action-required when a trustline is missing", async () => {
    const fetcher = vi.fn().mockResolvedValue({ balances: [native] });
    const result = await detectTrustlines(ACCOUNT, [USDC], fetcher);
    expect(result.status).toBe("action-required");
    expect(result.results).toEqual([{ asset: USDC, state: "missing" }]);
  });

  it("reports unfunded when Horizon says the account does not exist", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not Found"), { response: { status: 404 } }),
      );
    const result = await detectTrustlines(ACCOUNT, [USDC], fetcher);
    expect(result.status).toBe("unfunded");
    expect(result.results).toEqual([{ asset: USDC, state: "missing" }]);
  });

  it("rethrows transport errors so callers can tell 'unknown' from 'missing'", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(detectTrustlines(ACCOUNT, [USDC], fetcher)).rejects.toThrow(
      "network down",
    );
  });
});
