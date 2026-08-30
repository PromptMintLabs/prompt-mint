import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { SEOHead } from "../../components/seo/SEOHead";

/**
 * Helper to clean up meta/link tags from document head.
 * Used between tests to ensure isolation.
 */
function cleanupHead() {
  const selectors = [
    "meta[name='robots']",
    "meta[name='googlebot']",
    "link[rel='canonical']",
    "meta[property='og:url']",
    "meta[property='og:title']",
    "meta[property='og:description']",
    "meta[property='og:image']",
    "meta[property='og:type']",
    "meta[name='twitter:card']",
    "meta[name='twitter:title']",
    "meta[name='twitter:description']",
    "meta[name='twitter:image']",
  ];
  selectors.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.remove();
  });
}

describe("SEOHead Component", () => {
  beforeEach(() => {
    cleanupHead();
  });

  describe("Robots and Canonical Tags", () => {
    it("injects default robots meta tag and canonical link into document head", () => {
      render(<SEOHead promptId={99} origin="https://promptmint.io" />);

      const robotsMeta = document.querySelector("meta[name='robots']");
      expect(robotsMeta).not.toBeNull();
      expect(robotsMeta?.getAttribute("content")).toBe("index, follow");

      const canonicalLink = document.querySelector("link[rel='canonical']");
      expect(canonicalLink).not.toBeNull();
      expect(canonicalLink?.getAttribute("href")).toBe(
        "https://promptmint.io/prompts/99"
      );
    });

    it("updates meta tags when custom noindex/nofollow config is provided", () => {
      render(
        <SEOHead
          promptId={99}
          origin="https://promptmint.io"
          config={{
            index: false,
            follow: false,
            noarchive: true,
            canonicalUrl: "https://custom.org/p/99",
          }}
        />
      );

      const robotsMeta = document.querySelector("meta[name='robots']");
      expect(robotsMeta?.getAttribute("content")).toBe("noindex, nofollow, noarchive");

      const canonicalLink = document.querySelector("link[rel='canonical']");
      expect(canonicalLink?.getAttribute("href")).toBe("https://custom.org/p/99");
    });
  });

  describe("Dynamic OG Metadata (Success Case)", () => {
    it("generates og:title, og:description, og:image, og:type from listing metadata", () => {
      const metadata = {
        title: "Advanced ChatGPT Prompt Engineering Guide",
        description: "Learn how to write effective prompts for ChatGPT and other LLMs",
        imageUrl: "https://cdn.example.com/prompts/123/cover.jpg",
        creator: "GA1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
        category: "AI & ML",
      };

      render(
        <SEOHead
          promptId={123}
          origin="https://promptmint.io"
          listingMetadata={metadata}
        />
      );

      const ogTitle = document.querySelector("meta[property='og:title']");
      expect(ogTitle?.getAttribute("content")).toBe(
        "Advanced ChatGPT Prompt Engineering Guide"
      );

      const ogDescription = document.querySelector("meta[property='og:description']");
      expect(ogDescription?.getAttribute("content")).toBe(
        "Learn how to write effective prompts for ChatGPT and other LLMs"
      );

      const ogImage = document.querySelector("meta[property='og:image']");
      expect(ogImage?.getAttribute("content")).toBe(
        "https://cdn.example.com/prompts/123/cover.jpg"
      );

      const ogType = document.querySelector("meta[property='og:type']");
      expect(ogType?.getAttribute("content")).toBe("product");
    });

    it("generates twitter card tags from listing metadata", () => {
      const metadata = {
        title: "Social Media Caption Generator",
        description: "Generate engaging captions for Instagram, Twitter, and LinkedIn posts",
        imageUrl: "https://cdn.example.com/prompts/456/thumb.png",
      };

      render(
        <SEOHead
          promptId={456}
          origin="https://promptmint.io"
          listingMetadata={metadata}
        />
      );

      const twitterCard = document.querySelector("meta[name='twitter:card']");
      expect(twitterCard?.getAttribute("content")).toBe("summary_large_image");

      const twitterTitle = document.querySelector("meta[name='twitter:title']");
      expect(twitterTitle?.getAttribute("content")).toBe(
        "Social Media Caption Generator"
      );

      const twitterDescription = document.querySelector("meta[name='twitter:description']");
      expect(twitterDescription?.getAttribute("content")).toBe(
        "Generate engaging captions for Instagram, Twitter, and LinkedIn posts"
      );

      const twitterImage = document.querySelector("meta[name='twitter:image']");
      expect(twitterImage?.getAttribute("content")).toBe(
        "https://cdn.example.com/prompts/456/thumb.png"
      );
    });

    it("includes og:url and canonical URL even with listing metadata", () => {
      const metadata = {
        title: "Test Prompt",
        description: "Test description",
      };

      render(
        <SEOHead
          promptId={789}
          origin="https://promptmint.io"
          listingMetadata={metadata}
        />
      );

      const ogUrl = document.querySelector("meta[property='og:url']");
      expect(ogUrl?.getAttribute("content")).toBe("https://promptmint.io/prompts/789");

      const canonical = document.querySelector("link[rel='canonical']");
      expect(canonical?.getAttribute("href")).toBe("https://promptmint.io/prompts/789");
    });
  });

  describe("Fallback to Generic Metadata (No Listing Data)", () => {
    it("uses default OG title and description when no listing metadata provided", () => {
      render(
        <SEOHead promptId={999} origin="https://promptmint.io" listingMetadata={null} />
      );

      const ogTitle = document.querySelector("meta[property='og:title']");
      expect(ogTitle?.getAttribute("content")).toBe("Prompt Mint");

      const ogDescription = document.querySelector("meta[property='og:description']");
      expect(ogDescription?.getAttribute("content")).toBe(
        "Discover and buy AI prompts on the Stellar blockchain"
      );

      // og:type should be "product" even for fallback
      const ogType = document.querySelector("meta[property='og:type']");
      expect(ogType?.getAttribute("content")).toBe("product");
    });

    it("does not set og:image tag when no image is provided", () => {
      render(
        <SEOHead
          promptId={555}
          origin="https://promptmint.io"
          listingMetadata={{ title: "Test", description: "Test desc" }}
        />
      );

      const ogImage = document.querySelector("meta[property='og:image']");
      expect(ogImage).toBeNull();

      const twitterImage = document.querySelector("meta[name='twitter:image']");
      expect(twitterImage).toBeNull();
    });

    it("uses fallback metadata when listing metadata is provided but missing optional fields", () => {
      const partialMetadata = {
        title: "Only Title Provided",
        // description and imageUrl intentionally omitted
      };

      render(
        <SEOHead
          promptId={111}
          origin="https://promptmint.io"
          listingMetadata={partialMetadata}
        />
      );

      const ogTitle = document.querySelector("meta[property='og:title']");
      expect(ogTitle?.getAttribute("content")).toBe("Only Title Provided");

      // description should use listing metadata (undefined) which defaults to generic fallback
      const ogDescription = document.querySelector("meta[property='og:description']");
      expect(ogDescription?.getAttribute("content")).toBe(
        "Discover and buy AI prompts on the Stellar blockchain"
      );
    });
  });

  describe("Inactive/Unavailable Listing Handling", () => {
    it("falls back to generic OG tags when listing is inactive (passes null metadata)", () => {
      // Simulate a scenario where listing data exists but is not active
      render(
        <SEOHead
          promptId={222}
          origin="https://promptmint.io"
          listingMetadata={null} // inactive listings should not pass metadata
        />
      );

      const ogTitle = document.querySelector("meta[property='og:title']");
      expect(ogTitle?.getAttribute("content")).toBe("Prompt Mint");

      const ogUrl = document.querySelector("meta[property='og:url']");
      expect(ogUrl?.getAttribute("content")).toBe("https://promptmint.io/prompts/222");

      // Canonical should still be set so the listing URL is known
      const canonical = document.querySelector("link[rel='canonical']");
      expect(canonical?.getAttribute("href")).toBe("https://promptmint.io/prompts/222");
    });
  });

  describe("Data Leakage Prevention", () => {
    it("only uses public preview fields, not gated content", () => {
      // This test ensures the component interface only accepts public-safe fields
      const metadata = {
        title: "Public Title",
        description: "Public preview text only",
        imageUrl: "https://cdn.example.com/public-thumb.jpg",
      };

      render(
        <SEOHead
          promptId={333}
          origin="https://promptmint.io"
          listingMetadata={metadata}
        />
      );

      const ogTitle = document.querySelector("meta[property='og:title']");
      expect(ogTitle?.getAttribute("content")).toBe("Public Title");

      // Verify the description is only the preview, not full content
      const ogDescription = document.querySelector("meta[property='og:description']");
      expect(ogDescription?.getAttribute("content")).toBe("Public preview text only");

      // No tags that would indicate gated fields are set
      const content = document.documentElement.outerHTML;
      expect(content).not.toMatch(/encryptedPrompt/);
      expect(content).not.toMatch(/wrappedKey/);
    });
  });

  describe("Edge Cases", () => {
    it("handles listing metadata with empty optional fields gracefully", () => {
      const metadata = {
        title: "Valid Title",
        description: "", // empty string
        imageUrl: "", // empty string
      };

      render(
        <SEOHead
          promptId={444}
          origin="https://promptmint.io"
          listingMetadata={metadata}
        />
      );

      const ogTitle = document.querySelector("meta[property='og:title']");
      expect(ogTitle?.getAttribute("content")).toBe("Valid Title");

      // Empty description should use fallback
      const ogDescription = document.querySelector("meta[property='og:description']");
      expect(ogDescription?.getAttribute("content")).toBe(
        "Discover and buy AI prompts on the Stellar blockchain"
      );

      // Empty imageUrl should not create og:image tag
      const ogImage = document.querySelector("meta[property='og:image']");
      expect(ogImage).toBeNull();
    });

    it("handles very long titles and descriptions without breaking", () => {
      const longTitle =
        "A".repeat(200) +
        " - The Ultimate Guide to Everything You Need to Know About This Topic";
      const longDescription =
        "B".repeat(300) +
        " This is a very detailed description that goes on and on...";

      const metadata = {
        title: longTitle,
        description: longDescription,
      };

      render(
        <SEOHead
          promptId={555}
          origin="https://promptmint.io"
          listingMetadata={metadata}
        />
      );

      const ogTitle = document.querySelector("meta[property='og:title']");
      expect(ogTitle?.getAttribute("content")).toBe(longTitle);

      const ogDescription = document.querySelector("meta[property='og:description']");
      expect(ogDescription?.getAttribute("content")).toBe(longDescription);
    });

    it("updates og:url correctly when promptId changes", () => {
      const { rerender } = render(
        <SEOHead promptId={666} origin="https://promptmint.io" />
      );

      let ogUrl = document.querySelector("meta[property='og:url']");
      expect(ogUrl?.getAttribute("content")).toBe("https://promptmint.io/prompts/666");

      rerender(<SEOHead promptId={777} origin="https://promptmint.io" />);

      ogUrl = document.querySelector("meta[property='og:url']");
      expect(ogUrl?.getAttribute("content")).toBe("https://promptmint.io/prompts/777");
    });
  });
});
