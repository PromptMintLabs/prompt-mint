import { z } from "zod";
import { Keypair } from "@stellar/stellar-sdk";

/**
 * Shared Zod request-body contracts for Prompt Mint HTTP APIs.
 *
 * The unlock/challenge handlers (`api/auth/challenge.ts`, `api/prompts/unlock.ts`)
 * and the Express listing routes import from here so the browser client and server
 * cannot drift on required fields or formats. Soroban `has_access` remains the
 * authority for purchase rights — these schemas only validate wire shape.
 *
 * See `docs/api-request-schemas.md` for behavior, edge cases, and error mapping.
 */

const CATEGORY_ALIASES: Record<string, string> = {
  marketing: "Marketing",
  "creative writing": "Creative Writing",
  programming: "Programming",
  music: "Music",
  gaming: "Gaming",
  other: "Other",
};

export const LISTING_FIELD_LIMITS = {
  image: 512,
  title: 100,
  content: 50_000,
  category: 40,
} as const;

function isStellarPublicKey(value: string): boolean {
  if (value.length !== 56 || !value.startsWith("G")) {
    return false;
  }
  try {
    Keypair.fromPublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export const stellarPublicKeySchema = z
  .string()
  .trim()
  .refine(isStellarPublicKey, {
    message: "Must be a valid Stellar public key (G…, 56 characters).",
  });

/** On-chain prompt id as a decimal string (parsed with BigInt at the API layer). */
export const promptIdSchema = z
  .string()
  .trim()
  .min(1, "promptId is required.")
  .max(64)
  .refine((value) => /^\d+$/.test(value), {
    message: "promptId must be a non-negative integer string.",
  });

export const ChallengeRequestBody = z
  .object({
    address: stellarPublicKeySchema,
    promptId: promptIdSchema,
    captchaToken: z.string().trim().optional(),
  })
  .strict();

export type ChallengeRequestBody = z.infer<typeof ChallengeRequestBody>;

export const UnlockRequestBody = z
  .object({
    token: z.string().trim().min(1, "token is required."),
    promptId: promptIdSchema,
    address: stellarPublicKeySchema,
    signedMessage: z.string().trim().min(1, "signedMessage is required."),
    captchaToken: z.string().trim().optional(),
  })
  .strict();

export type UnlockRequestBody = z.infer<typeof UnlockRequestBody>;

export const BuyerLibraryMutationBody = z
  .object({
    walletAddress: stellarPublicKeySchema,
    promptId: z.string().trim().min(1, "promptId is required.").max(128),
  })
  .strict();

export type BuyerLibraryMutationBody = z.infer<typeof BuyerLibraryMutationBody>;

const listingInputSchema = z
  .object({
    image: z.unknown().optional(),
    title: z.unknown().optional(),
    content: z.unknown().optional(),
    price: z.unknown().optional(),
    category: z.unknown().optional(),
    walletAddress: z.unknown().optional(),
  })
  .passthrough();

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

export function normalizeListingMetadata(input: unknown): NormalizedListing {
  const raw = listingInputSchema.safeParse(input ?? {});
  const fields = raw.success ? raw.data : (input as Record<string, unknown>);

  const image = asTrimmedString(fields.image);
  const title = asTrimmedString(fields.title).replace(/\s+/g, " ");
  const content = asTrimmedString(fields.content);
  const category = normalizeCategory(fields.category);
  const parsedPrice =
    typeof fields.price === "number"
      ? fields.price
      : typeof fields.price === "string"
        ? Number(fields.price.trim())
        : Number.NaN;

  return {
    image,
    title,
    content,
    price: parsedPrice,
    category,
  };
}

export function validateListingMetadata(input: unknown): {
  normalized: NormalizedListing;
  errors: ListingValidationErrors;
} {
  const normalized = normalizeListingMetadata(input);
  const errors: ListingValidationErrors = {};

  if (!normalized.image) {
    errors.image = "Image URL is required.";
  } else if (normalized.image.length > LISTING_FIELD_LIMITS.image) {
    errors.image = `Image URL must be ${LISTING_FIELD_LIMITS.image} characters or fewer.`;
  } else if (!/^https?:\/\/.+/i.test(normalized.image)) {
    errors.image = "Image URL must start with http:// or https://.";
  }

  if (!normalized.title) {
    errors.title = "Title is required.";
  } else if (normalized.title.length < 3) {
    errors.title = "Title must be at least 3 characters long.";
  } else if (normalized.title.length > LISTING_FIELD_LIMITS.title) {
    errors.title = `Title must be ${LISTING_FIELD_LIMITS.title} characters or fewer.`;
  }

  if (!normalized.content) {
    errors.content = "Content is required.";
  } else if (normalized.content.length < 10) {
    errors.content = "Content must be at least 10 characters long.";
  } else if (normalized.content.length > LISTING_FIELD_LIMITS.content) {
    errors.content = `Content must be ${LISTING_FIELD_LIMITS.content} characters or fewer.`;
  }

  if (!normalized.category) {
    errors.category = "Category is required.";
  } else if (normalized.category.length > LISTING_FIELD_LIMITS.category) {
    errors.category = `Category must be ${LISTING_FIELD_LIMITS.category} characters or fewer.`;
  }

  if (!Number.isFinite(normalized.price)) {
    errors.price = "Price must be a valid number.";
  } else if (normalized.price <= 0) {
    errors.price = "Price must be greater than zero.";
  }

  return { normalized, errors };
}

export type ParseRequestBodyResult<T> =
  | { success: true; data: T }
  | { success: false; summary: string; fields: ListingValidationErrors };

/**
 * Parse and validate a JSON request body against a strict Zod schema.
 * Returns a stable summary string for generic 400 responses.
 */
export function parseRequestBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): ParseRequestBodyResult<z.infer<T>> {
  const result = schema.safeParse(body ?? {});
  if (result.success) {
    return { success: true, data: result.data };
  }

  const fields: ListingValidationErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fields[key]) {
      fields[key] = issue.message;
    }
  }

  const summary = result.error.issues.map((issue) => issue.message).join("; ");
  return { success: false, summary, fields };
}
