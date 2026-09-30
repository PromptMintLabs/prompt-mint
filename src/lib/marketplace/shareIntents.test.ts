import { describe, it, expect } from "vitest";
import {
  buildSocialShareUrl,
  buildTelegramShareUrl,
  buildTwitterShareUrl,
} from "./shareIntents";

const URL = "https://promptmint.app/prompt/42";
const TEXT = "Check out this prompt on Prompt Mint: Neon Poster Generator";

describe("social share intent URLs", () => {
  describe("buildTwitterShareUrl", () => {
    it("builds a twitter/x intent with encoded text and url", () => {
      const result = buildTwitterShareUrl({ url: URL, text: TEXT });
      expect(result.startsWith("https://twitter.com/intent/tweet?")).toBe(true);
      const params = new globalThis.URL(result).searchParams;
      expect(params.get("url")).toBe(URL);
      expect(params.get("text")).toBe(TEXT);
    });

    it("percent-encodes special characters", () => {
      const result = buildTwitterShareUrl({
        url: "https://x.dev/a?b=c&d=e",
        text: "hi there & friends",
      });
      expect(result).toContain("b%3Dc%26d%3De");
      expect(result).toContain("hi+there+%26+friends");
    });

    it("throws when url or text is empty", () => {
      expect(() => buildTwitterShareUrl({ url: "", text: TEXT })).toThrow(/url/);
      expect(() => buildTwitterShareUrl({ url: URL, text: "  " })).toThrow(/text/);
    });
  });

  describe("buildTelegramShareUrl", () => {
    it("builds a telegram share url with url first then text", () => {
      const result = buildTelegramShareUrl({ url: URL, text: TEXT });
      expect(result.startsWith("https://t.me/share/url?")).toBe(true);
      const params = new globalThis.URL(result).searchParams;
      expect(params.get("url")).toBe(URL);
      expect(params.get("text")).toBe(TEXT);
    });

    it("throws when url is missing", () => {
      expect(() => buildTelegramShareUrl({ url: "", text: TEXT })).toThrow(/url/);
    });
  });

  describe("buildSocialShareUrl dispatch", () => {
    it("routes to the correct builder", () => {
      expect(buildSocialShareUrl("twitter", { url: URL, text: TEXT })).toBe(
        buildTwitterShareUrl({ url: URL, text: TEXT }),
      );
      expect(buildSocialShareUrl("telegram", { url: URL, text: TEXT })).toBe(
        buildTelegramShareUrl({ url: URL, text: TEXT }),
      );
    });
  });
});
