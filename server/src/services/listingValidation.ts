const CATEGORY_ALIASES: Record<string, string> = {
  marketing: "Marketing",
  "creative writing": "Creative Writing",
  programming: "Programming",
  music: "Music",
  gaming: "Gaming",
  other: "Other",
};

/**
 * Off-chain listing field caps, measured in **UTF-8 bytes** so they match the
 * on-chain PromptHash contract's `MAX_*_LEN` checks in
 * `contracts/prompt-hash/src/contract.rs` (#410):
 *
 * - `image`    -> `MAX_IMAGE_URL_LEN` (512)
 * - `title`    -> `MAX_TITLE_LEN` (120)
 * - `category` -> `MAX_CATEGORY_LEN` (40)
 *
 * `content` is the pre-encryption prompt text, so it is intentionally larger
 * than the contract's `MAX_ENCRYPTED_PROMPT_LEN` (4096); it stays bounded so
 * the per-creator storage quota (Issue #198) remains meaningful.
 */
export const LISTING_LIMITS = {
  image: 512,
  title: 120,
  content: 50_000,
  category: 40,
} as const;

/**
 * UTF-8 byte length, matching `soroban_sdk::String::len()` on-chain.
 * `String.prototype.length` counts UTF-16 code units, so emoji-heavy input
 * used to pass this validator and then be rejected by `create_prompt` (#410).
 */
const utf8Length = (value: string) => Buffer.byteLength(value, "utf8");

type ListingInput = {
  image?: unknown;
  title?: unknown;
  content?: unknown;
  price?: unknown;
  category?: unknown;
};

export type ListingValidationErrors = Record<string, string>;

export type NormalizedListing = {
  image: string;
  title: string;
  content: string;
  price: number;
  category: string;
};

const asTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeCategory = (value: unknown) => {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return "Other";

  const alias = CATEGORY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

export function normalizeListingMetadata(input: ListingInput): NormalizedListing {
  const image = asTrimmedString(input.image);
  const title = asTrimmedString(input.title).replace(/\s+/g, " ");
  const content = asTrimmedString(input.content);
  const category = normalizeCategory(input.category);
  const parsedPrice =
    typeof input.price === "number"
      ? input.price
      : typeof input.price === "string"
        ? Number(input.price.trim())
        : Number.NaN;

  return {
    image,
    title,
    content,
    price: parsedPrice,
    category,
  };
}

export function validateListingMetadata(
  input: ListingInput,
): {
  normalized: NormalizedListing;
  errors: ListingValidationErrors;
} {
  const normalized = normalizeListingMetadata(input);
  const errors: ListingValidationErrors = {};

  if (!normalized.image) {
    errors.image = "Image URL is required.";
  } else if (utf8Length(normalized.image) > LISTING_LIMITS.image) {
    errors.image = `Image URL must be ${LISTING_LIMITS.image} bytes or fewer.`;
  } else if (!/^https?:\/\/.+/i.test(normalized.image)) {
    errors.image = "Image URL must start with http:// or https://.";
  }

  if (!normalized.title) {
    errors.title = "Title is required.";
  } else if (normalized.title.length < 3) {
    errors.title = "Title must be at least 3 characters long.";
  } else if (utf8Length(normalized.title) > LISTING_LIMITS.title) {
    errors.title = `Title must be ${LISTING_LIMITS.title} bytes or fewer.`;
  }

  if (!normalized.content) {
    errors.content = "Content is required.";
  } else if (normalized.content.length < 10) {
    errors.content = "Content must be at least 10 characters long.";
  } else if (utf8Length(normalized.content) > LISTING_LIMITS.content) {
    errors.content = `Content must be ${LISTING_LIMITS.content} bytes or fewer.`;
  }

  if (!normalized.category) {
    errors.category = "Category is required.";
  } else if (utf8Length(normalized.category) > LISTING_LIMITS.category) {
    errors.category = `Category must be ${LISTING_LIMITS.category} bytes or fewer.`;
  }

  if (!Number.isFinite(normalized.price)) {
    errors.price = "Price must be a valid number.";
  } else if (normalized.price <= 0) {
    errors.price = "Price must be greater than zero.";
  } else {
    const priceStr = typeof input.price === "string" ? input.price.trim() : "";
    if (priceStr && /[eE]/.test(priceStr)) {
      errors.price = "Scientific notation is not allowed. Use a decimal format.";
    } else if (priceStr) {
      const parts = priceStr.split(".");
      if (parts.length === 2 && parts[1].length > 7) {
        errors.price = "Price precision exceeds 7 decimal places (maximum: 0.0000001 XLM per stoop).";
      }
    }
  }

  return { normalized, errors };
}
