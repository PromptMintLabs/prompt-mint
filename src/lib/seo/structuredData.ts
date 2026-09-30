export interface ListingMetadata {
  title: string;
  description?: string;
  imageUrl?: string;
  creator?: string;
  category?: string;
  priceStroops?: string;
  active?: boolean;
  salesCount?: number;
}

const SITE_ORIGIN = "https://promptmint.com";

/**
 * Generate schema.org Product JSON-LD for a single listing.
 */
export function generateProductLD(
  listing: ListingMetadata,
): Record<string, unknown> {
  const price = listing.priceStroops
    ? Number(listing.priceStroops) / 10_000_000
    : undefined;

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    ...(listing.description && { description: listing.description }),
    ...(listing.imageUrl && { image: listing.imageUrl }),
    ...(listing.category && { category: listing.category }),
    offers: {
      "@type": "Offer",
      price: price ?? 0,
      priceCurrency: "XLM",
      availability: listing.active !== false
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  if (listing.creator) {
    product.creator = {
      "@type": "Person",
      identifier: listing.creator,
    };
  }

  return product;
}

/**
 * Generate schema.org ItemList JSON-LD for the browse page.
 * Includes up to `maxItems` listings.
 */
export function generateItemListLD(
  listings: ListingMetadata[],
  origin: string = SITE_ORIGIN,
  maxItems = 10,
): Record<string, unknown> {
  const items = listings.slice(0, maxItems).map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.title,
    ...(item.imageUrl && { image: item.imageUrl }),
    url: `${origin}/prompts/${encodeURIComponent(item.title)}`,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items,
    numberOfItems: items.length,
  };
}

/**
 * Inject a JSON-LD script into the document head.
 * Replaces any existing script with the same id.
 */
export function injectStructuredData(
  jsonLd: Record<string, unknown>,
  id = "prompt-mint-structured-data",
): void {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);
}

/**
 * Remove injected structured data from the document head.
 */
export function clearStructuredData(id = "prompt-mint-structured-data"): void {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(id);
  if (existing) existing.remove();
}
