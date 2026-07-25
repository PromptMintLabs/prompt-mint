import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashWalletAddress,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
  trackEvent,
  trackEventWithWallet,
} from "./track";

describe("hashWalletAddress", () => {
  it("returns a 64-char lowercase hex digest", async () => {
    const hash = await hashWalletAddress("GBUYERACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH123456789");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same address", async () => {
    const a = await hashWalletAddress("GSAMEADDRESS1234567890ABCDEFGH1234567890ABCDEFGH123456789");
    const b = await hashWalletAddress("GSAMEADDRESS1234567890ABCDEFGH1234567890ABCDEFGH123456789");
    expect(a).toBe(b);
  });

  it("produces different digests for different addresses", async () => {
    const a = await hashWalletAddress("GADDRESSONE1234567890ABCDEFGH1234567890ABCDEFGH1234567890");
    const b = await hashWalletAddress("GADDRESSTWO1234567890ABCDEFGH1234567890ABCDEFGH1234567890");
    expect(a).not.toBe(b);
  });

  it("never contains the raw address as a substring", async () => {
    const address = "GRAWADDRESS1234567890ABCDEFGH1234567890ABCDEFGH1234567890";
    const hash = await hashWalletAddress(address);
    expect(hash).not.toContain(address);
  });
});

describe("analytics opt-out", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to opted-in", () => {
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("respects an explicit opt-out", () => {
    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);
  });

  it("can be reversed by opting back in", () => {
    setAnalyticsOptOut(true);
    setAnalyticsOptOut(false);
    expect(isAnalyticsOptedOut()).toBe(false);
  });
});

describe("trackEvent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a valid event to the analytics endpoint", async () => {
    trackEvent("wallet_connected", { walletKind: "freighter" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analytics/events");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body as string);
    expect(body.event).toBe("wallet_connected");
    expect(body.properties).toEqual({ walletKind: "freighter" });
    expect(typeof body.occurredAt).toBe("number");
  });

  it("never sends a raw wallet address in the payload", () => {
    // @ts-expect-error intentionally passing a malformed payload to prove it is dropped
    trackEvent("wallet_connected", { walletHash: "GRAWADDRESS1234567890ABCDEFGH1234567890ABCDEFGH1234567890" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch when the user has opted out", () => {
    setAnalyticsOptOut(true);
    trackEvent("wallet_disconnected", {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops an invalid payload instead of sending it", () => {
    // @ts-expect-error intentionally invalid payload for prompt_purchase_failed
    trackEvent("prompt_purchase_failed", { reasonCode: "this is definitely not a short code" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when fetch rejects", () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(() => trackEvent("prompt_purchase_initiated", {})).not.toThrow();
  });

  it("never throws when fetch is unavailable", () => {
    vi.stubGlobal("fetch", undefined);
    expect(() => trackEvent("prompt_purchase_initiated", {})).not.toThrow();
  });
});

describe("trackEventWithWallet", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hashes the address and sends walletHash, never the raw address", async () => {
    const address = "GBUYERACCOUNT1234567890ABCDEFGH1234567890ABCDEFGH123456789";
    trackEventWithWallet("prompt_unlocked", address, { promptId: "42" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.properties.walletHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain(address);
  });

  it("sends walletHash: null when no address is connected", async () => {
    trackEventWithWallet("prompt_purchase_failed", null, { reasonCode: "no_wallet" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.properties.walletHash).toBeNull();
  });

  it("respects opt-out without attempting to hash", () => {
    setAnalyticsOptOut(true);
    trackEventWithWallet("wallet_connected", "GADDRESS1234567890ABCDEFGH1234567890ABCDEFGH1234567890AB");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
