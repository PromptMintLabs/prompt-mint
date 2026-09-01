import React, { useEffect } from "react";
import {
  SEOConfig,
  formatRobotsMeta,
  resolveCanonicalUrl,
} from "../../lib/seo/robotsCanonical";
import {
  generateProductLD,
  injectStructuredData,
  clearStructuredData,
} from "../../lib/seo/structuredData";

/**
 * Represents public listing metadata suitable for Open Graph and Twitter Card tags.
 * This interface strictly contains only fields intended for public discovery—
 * no gated/paid content fields.
 */
export interface PublicListingMetadata {
  title: string;
  description?: string; // public teaser/preview, NOT the full/gated prompt body
  imageUrl?: string; // listing thumbnail/cover image
  creator?: string; // creator wallet address (already public in marketplace)
  category?: string;
}

export interface SEOHeadProps {
  promptId?: string | number;
  config?: Partial<SEOConfig> | null;
  origin?: string;
  /** Optional public listing metadata for dynamic OG tags. If not provided, fallback to generic tags. */
  listingMetadata?: PublicListingMetadata | null;
}

/**
 * Creates a meta tag element and appends it to the document head if it doesn't exist.
 */
function getOrCreateMetaTag(
  property: string,
  attribute: "property" | "name" = "property"
): HTMLMetaElement {
  const selector =
    attribute === "property"
      ? `meta[property='${property}']`
      : `meta[name='${property}']`;
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, property);
    document.head.appendChild(meta);
  }
  return meta;
}

/**
 * Updates or creates an Open Graph meta tag.
 */
function updateOGTag(property: string, content: string): void {
  const meta = getOrCreateMetaTag(property);
  meta.setAttribute("content", content);
}

/**
 * Updates or creates a Twitter Card meta tag.
 */
function updateTwitterTag(name: string, content: string): void {
  const meta = getOrCreateMetaTag(name, "name");
  meta.setAttribute("content", content);
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  promptId,
  config,
  origin,
  listingMetadata,
}) => {
  const robotsContent = formatRobotsMeta(config);

  const effectiveOrigin =
    origin ||
    (typeof window !== "undefined" && window.location ? window.location.origin : "");

  const canonicalUrl = promptId
    ? resolveCanonicalUrl(promptId, config?.canonicalUrl, effectiveOrigin)
    : config?.canonicalUrl
    ? resolveCanonicalUrl("", config.canonicalUrl, effectiveOrigin)
    : effectiveOrigin;

  // Default OG tags when no listing metadata is provided
  const defaultOGTitle = "Prompt Mint";
  const defaultOGDescription = "Discover and buy AI prompts on the Stellar blockchain";
  const defaultOGImage = ""; // Site-wide default if any; can be empty

  // Determine effective metadata: use listing metadata if available, otherwise fallback to defaults
  const ogTitle = listingMetadata?.title || defaultOGTitle;
  const ogDescription =
    listingMetadata?.description || defaultOGDescription;
  const ogImage = listingMetadata?.imageUrl || defaultOGImage;
  const ogType = "product"; // Listings are products

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Update <meta name="robots">
    let robotsMeta = document.querySelector<HTMLMetaElement>("meta[name='robots']");
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.setAttribute("name", "robots");
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute("content", robotsContent);

    // Update <meta name="googlebot">
    let googlebotMeta = document.querySelector<HTMLMetaElement>("meta[name='googlebot']");
    if (!googlebotMeta) {
      googlebotMeta = document.createElement("meta");
      googlebotMeta.setAttribute("name", "googlebot");
      document.head.appendChild(googlebotMeta);
    }
    googlebotMeta.setAttribute("content", robotsContent);

    // Update <link rel="canonical">
    let canonicalLink = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);

    // Update Open Graph tags
    updateOGTag("og:url", canonicalUrl);
    updateOGTag("og:title", ogTitle);
    updateOGTag("og:description", ogDescription);
    updateOGTag("og:type", ogType);
    
    // Update og:image only if one is provided to avoid invalid/empty image meta tags
    if (ogImage) {
      updateOGTag("og:image", ogImage);
    }

    // Update Twitter Card tags
    updateTwitterTag("twitter:card", "summary_large_image");
    updateTwitterTag("twitter:title", ogTitle);
    updateTwitterTag("twitter:description", ogDescription);
    
    // Update twitter:image only if one is provided
    if (ogImage) {
      updateTwitterTag("twitter:image", ogImage);
    }

    // Inject JSON-LD structured data for search engines (#76)
    if (listingMetadata) {
      const productLD = generateProductLD(
        {
          title: listingMetadata.title,
          description: listingMetadata.description,
          imageUrl: listingMetadata.imageUrl,
          creator: listingMetadata.creator,
          category: listingMetadata.category,
        },
      );
      injectStructuredData(productLD);
    } else {
      clearStructuredData();
    }
  }, [robotsContent, canonicalUrl, ogTitle, ogDescription, ogImage, ogType, listingMetadata, effectiveOrigin]);

  return null;
};
