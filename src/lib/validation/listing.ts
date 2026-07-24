import { xlmToStroops } from "@/lib/stellar/format";

// #131 – Canonical content classification taxonomy
export const CONTENT_CLASSIFICATIONS = [
  { value: "general", label: "General", description: "General purpose content" },
  { value: "educational", label: "Educational", description: "Educational or learning content" },
  { value: "professional", label: "Professional", description: "Professional or business content" },
  { value: "creative", label: "Creative", description: "Creative, artistic, or entertainment content" },
  { value: "technical", label: "Technical", description: "Technical, programming, or engineering content" },
  { value: "sensitive", label: "Sensitive", description: "May contain sensitive topics (politics, religion, etc.)" },
  { value: "restricted", label: "Restricted", description: "Age-restricted or potentially offensive content" },
] as const;

// #131 – Standard safety disclosure flags
export const SAFETY_DISCLOSURE_FLAGS = [
  { value: "none", label: "None", description: "No specific safety concerns" },
  { value: "ai-generated", label: "AI Generated", description: "Contains AI-generated content" },
  { value: "financial-advice", label: "Financial Advice", description: "Contains financial or investment advice" },
  { value: "medical", label: "Medical", description: "Contains medical or health information" },
  { value: "legal", label: "Legal", description: "Contains legal information or advice" },
  { value: "political", label: "Political", description: "Contains political content or commentary" },
] as const;

export const LISTING_LIMITS = {
  imageUrl: 512,
  title: 120,
  category: 40,
  preview: 280,
  fullPrompt: 50_000,
} as const;

export type ListingFormInput = {
  imageUrl: string;
  title: string;
  category: string;
  previewText: string;
  fullPrompt: string;
  priceXlm: string;
  // #131 – content classification
  classification: string;
  safetyFlags: string[];
};

export type ListingValidationErrors = Partial<
  Record<keyof ListingFormInput, string>
>;

export type ChecklistStatus = "pass" | "fail" | "warn" | "info";

export interface ListingChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  hint?: string;
}

function trim(value: string) {
  return value.trim();
}

export function validateListingForm(
  input: ListingFormInput,
): ListingValidationErrors {
  const errors: ListingValidationErrors = {};
  const imageUrl = trim(input.imageUrl);
  const title = trim(input.title);
  const category = trim(input.category);
  const previewText = trim(input.previewText);
  const fullPrompt = trim(input.fullPrompt);
  const priceXlm = trim(input.priceXlm);

  if (!imageUrl) {
    errors.imageUrl = "Add an image URL so your listing has a cover on browse cards.";
  } else if (imageUrl.length > LISTING_LIMITS.imageUrl) {
    errors.imageUrl = `Shorten the image URL to ${LISTING_LIMITS.imageUrl} characters or fewer.`;
  } else if (!/^https?:\/\/.+/i.test(imageUrl)) {
    errors.imageUrl =
      "Use a full URL starting with http:// or https:// so the cover image loads correctly.";
  }

  if (!title) {
    errors.title = "Add a title that tells buyers what your prompt does.";
  } else if (title.length < 3) {
    errors.title = "Use at least 3 characters so the title is descriptive enough.";
  } else if (title.length > LISTING_LIMITS.title) {
    errors.title = `Shorten the title to ${LISTING_LIMITS.title} characters or fewer.`;
  }

  if (!category) {
    errors.category = "Select a category so buyers can filter to your listing.";
  } else if (category.length > LISTING_LIMITS.category) {
    errors.category = `Choose a shorter category (max ${LISTING_LIMITS.category} characters).`;
  }

  if (!previewText) {
    errors.previewText =
      "Add preview text — this public snippet appears on browse cards before purchase.";
  } else if (previewText.length < 10) {
    errors.previewText =
      "Write at least 10 characters of preview text so buyers know what they are getting.";
  } else if (previewText.length > LISTING_LIMITS.preview) {
    errors.previewText = `Shorten the preview to ${LISTING_LIMITS.preview} characters or fewer.`;
  }

  if (!fullPrompt) {
    errors.fullPrompt =
      "Paste the full prompt content — it is encrypted in your browser before submission.";
  } else if (fullPrompt.length < 10) {
    errors.fullPrompt =
      "Add at least 10 characters of prompt content so buyers receive meaningful value.";
  } else if (fullPrompt.length > LISTING_LIMITS.fullPrompt) {
    errors.fullPrompt = `Shorten the prompt to ${LISTING_LIMITS.fullPrompt.toLocaleString()} characters or fewer.`;
  }

  if (!priceXlm) {
    errors.priceXlm = "Enter a price in XLM — use a value greater than zero.";
  } else {
    try {
      const price = xlmToStroops(priceXlm);
      if (price <= 0n) {
        errors.priceXlm = "Set a price greater than zero XLM.";
      }
    } catch (error) {
      errors.priceXlm =
        error instanceof Error
          ? error.message
          : "Enter a valid XLM amount with up to 7 decimal places.";
    }
  }

  // #131 – classification validation
  if (!input.classification) {
    errors.classification = "Select a content classification so buyers know what to expect.";
  } else if (!CONTENT_CLASSIFICATIONS.some((c) => c.value === input.classification)) {
    errors.classification = "Selected classification is not in the recognized taxonomy.";
  }

  // Safety flags are optional — valid if provided
  if (input.safetyFlags.length > 0) {
    for (const flag of input.safetyFlags) {
      if (!SAFETY_DISCLOSURE_FLAGS.some((f) => f.value === flag)) {
        errors.safetyFlags = `"${flag}" is not a recognized safety disclosure flag.`;
        break;
      }
    }
  }

  return errors;
}

export async function validateImageMetadata(url: string): Promise<string | null> {
  if (!url) return "Image URL is required.";
  
  try {
    const res = await fetch("/api/images/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const data = await res.json();
      return data.error?.message || "Invalid image URL";
    }
    return null;
  } catch {
    return "Failed to reach the validation server.";
  }
}

export function buildListingChecklistItems(
  input: ListingFormInput,
): ListingChecklistItem[] {
  const errors = validateListingForm(input);
  const items: ListingChecklistItem[] = [];

  const fieldChecks: Array<{
    id: keyof ListingFormInput;
    label: string;
  }> = [
    { id: "title", label: "Title" },
    { id: "category", label: "Category" },
    { id: "previewText", label: "Preview text" },
    { id: "fullPrompt", label: "Full prompt content" },
    { id: "priceXlm", label: "Price" },
    { id: "imageUrl", label: "Image URL" },
    { id: "classification", label: "Content classification" },
  ];

  for (const { id, label } of fieldChecks) {
    const message = errors[id];
    items.push({
      id,
      label,
      status: message ? "fail" : "pass",
      hint: message,
    });
  }

  const titleWords = trim(input.title).split(/\s+/).filter(Boolean).length;
  if (!errors.title && titleWords < 3) {
    items.push({
      id: "title-words",
      label: "Title could be more descriptive",
      status: "warn",
      hint: "Aim for at least 3 words to help buyers find your listing",
    });
  }

  const previewLen = trim(input.previewText).length;
  if (!errors.previewText && previewLen > 0 && previewLen < 60) {
    items.push({
      id: "preview-length",
      label: "Preview text is short",
      status: "warn",
      hint: "A longer preview (60+ characters) improves buyer confidence",
    });
  }

  const promptLen = trim(input.fullPrompt).length;
  if (!errors.fullPrompt && promptLen > 0 && promptLen < 100) {
    items.push({
      id: "prompt-length",
      label: "Full prompt seems short",
      status: "warn",
      hint: "Buyers expect substantial prompt content — consider expanding it",
    });
  }

  let priceValue = Number.NaN;
  try {
    if (!errors.priceXlm && trim(input.priceXlm)) {
      priceValue = Number(trim(input.priceXlm));
    }
  } catch {
    // covered by validateListingForm
  }

  if (!errors.priceXlm && !Number.isNaN(priceValue) && priceValue > 0 && priceValue < 0.5) {
    items.push({
      id: "price-low",
      label: "Price is very low",
      status: "warn",
      hint: "Listings under 0.5 XLM may signal low quality to buyers",
    });
  }

  return items;
}
