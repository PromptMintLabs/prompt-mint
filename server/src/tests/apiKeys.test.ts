import {
  InMemoryRateLimiter,
  RATE_LIMIT_TIERS,
  generateApiKey,
  hasScope,
  hashApiKey,
  isValidScope,
  maskKey,
  parseKeyPrefix,
  rateLimitForTier,
  verifyApiKey,
} from "../services/apiKeys";

describe("generateApiKey", () => {
  it("produces a pm_<prefix>_<secret> plaintext and a matching hash", () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith("pm_")).toBe(true);
    expect(key.plaintext.split("_").length).toBeGreaterThanOrEqual(3);
    expect(parseKeyPrefix(key.plaintext)).toBe(key.prefix);
    expect(hashApiKey(key.plaintext)).toBe(key.hash);
  });

  it("generates unique keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("verifyApiKey", () => {
  it("accepts the correct plaintext against its hash", () => {
    const key = generateApiKey();
    expect(verifyApiKey(key.plaintext, key.hash)).toBe(true);
  });

  it("rejects a wrong plaintext", () => {
    const key = generateApiKey();
    expect(verifyApiKey(key.plaintext + "x", key.hash)).toBe(false);
    expect(verifyApiKey("", key.hash)).toBe(false);
    expect(verifyApiKey(key.plaintext, "")).toBe(false);
  });
});

describe("parseKeyPrefix", () => {
  it("returns null for malformed keys", () => {
    expect(parseKeyPrefix("nope")).toBeNull();
    expect(parseKeyPrefix("gh_abc_def")).toBeNull();
    expect(parseKeyPrefix("pm_abc")).toBeNull();
  });
});

describe("hasScope", () => {
  it("honours the admin > write > read hierarchy", () => {
    expect(hasScope(["read"], "read")).toBe(true);
    expect(hasScope(["read"], "write")).toBe(false);
    expect(hasScope(["write"], "read")).toBe(true);
    expect(hasScope(["admin"], "write")).toBe(true);
    expect(hasScope(["admin"], "read")).toBe(true);
    expect(hasScope([], "read")).toBe(false);
  });
});

describe("scopes and tiers", () => {
  it("validates scope strings", () => {
    expect(isValidScope("read")).toBe(true);
    expect(isValidScope("delete")).toBe(false);
  });

  it("resolves tier limits with a free fallback", () => {
    expect(rateLimitForTier("pro")).toBe(RATE_LIMIT_TIERS.pro);
    expect(rateLimitForTier("bogus" as unknown as "free")).toBe(
      RATE_LIMIT_TIERS.free,
    );
  });

  it("masks a key without revealing the secret", () => {
    expect(maskKey("abc123")).toContain("pm_abc123_");
    expect(maskKey("abc123")).not.toMatch(/[A-Za-z0-9]{20,}/);
  });
});

describe("InMemoryRateLimiter", () => {
  it("allows up to the limit then blocks within the window", () => {
    const now = 1000;
    const limiter = new InMemoryRateLimiter(60_000, () => now);
    expect(limiter.check("k", 2).allowed).toBe(true);
    expect(limiter.check("k", 2).allowed).toBe(true);
    expect(limiter.check("k", 2).allowed).toBe(false);
  });

  it("resets after the window elapses", () => {
    let now = 1000;
    const limiter = new InMemoryRateLimiter(60_000, () => now);
    limiter.check("k", 1);
    expect(limiter.check("k", 1).allowed).toBe(false);
    now += 60_001;
    expect(limiter.check("k", 1).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = new InMemoryRateLimiter();
    expect(limiter.check("a", 1).allowed).toBe(true);
    expect(limiter.check("b", 1).allowed).toBe(true);
  });
});
