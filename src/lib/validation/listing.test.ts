import { describe, expect, it } from "vitest";
import {
  buildListingChecklistItems,
  validateListingForm,
  validateListingField,
  LISTING_LIMITS,
  type ListingFormInput,
} from "./listing";
import { estimateEncryptedPayloadSize } from "@/lib/crypto/promptCrypto";

const validForm = {
  imageUrl: "https://example.com/cover.png",
  title: "Campaign launch pack",
  category: "Marketing",
  previewText: "Public preview text for buyers browsing the marketplace.",
  fullPrompt: "Private prompt body with enough content for validation.",
  priceXlm: "2.5",
  classification: "general",
};

describe("validateListingForm", () => {
  it("accepts a complete valid listing", () => {
    expect(validateListingForm(validForm)).toEqual({});
  });

  it("blocks zero and invalid XLM prices", () => {
    expect(validateListingForm({ ...validForm, priceXlm: "0" }).priceXlm).toMatch(
      /greater than 0/i,
    );
    expect(validateListingForm({ ...validForm, priceXlm: "2e3" }).priceXlm).toMatch(
      /scientific notation/i,
    );
  });

  it("enforces maximum 7 decimal places for price precision", () => {
    expect(validateListingForm({ ...validForm, priceXlm: "1.12345678" }).priceXlm).toMatch(
      /decimal places/i,
    );
    expect(validateListingForm({ ...validForm, priceXlm: "0.0000001" }).priceXlm).toBeUndefined();
    expect(validateListingForm({ ...validForm, priceXlm: "0.00000001" }).priceXlm).toMatch(
      /decimal places/i,
    );
  });

  it("rejects scientific notation and other invalid price formats", () => {
    expect(validateListingForm({ ...validForm, priceXlm: "1e10" }).priceXlm).toMatch(
      /scientific notation/i,
    );
    expect(validateListingForm({ ...validForm, priceXlm: "5.5E2" }).priceXlm).toMatch(
      /scientific notation/i,
    );
    expect(validateListingForm({ ...validForm, priceXlm: "1.2.3" }).priceXlm).toBeDefined();
    expect(validateListingForm({ ...validForm, priceXlm: "abc" }).priceXlm).toBeDefined();
  });

  it("accepts valid decimal price formats with varying precision", () => {
    expect(validateListingForm({ ...validForm, priceXlm: "1" }).priceXlm).toBeUndefined();
    expect(validateListingForm({ ...validForm, priceXlm: "1.5" }).priceXlm).toBeUndefined();
    expect(validateListingForm({ ...validForm, priceXlm: "0.1234567" }).priceXlm).toBeUndefined();
    expect(validateListingForm({ ...validForm, priceXlm: ".5" }).priceXlm).toBeUndefined();
  });

  it("requires http(s) image URLs", () => {
    expect(
      validateListingForm({ ...validForm, imageUrl: "not-a-url" }).imageUrl,
    ).toMatch(/http/i);
  });

  it("enforces minimum title and content lengths", () => {
    expect(validateListingForm({ ...validForm, title: "AB" }).title).toMatch(
      /at least 3 characters/i,
    );
    expect(
      validateListingForm({ ...validForm, previewText: "short" }).previewText,
    ).toMatch(/at least 10 characters/i);
    expect(
      validateListingForm({ ...validForm, fullPrompt: "tiny" }).fullPrompt,
    ).toMatch(/at least 10 characters/i);
  });

  it("returns field-specific required messages", () => {
    const result = validateListingForm({ ...validForm, title: "" });
    expect(result.title).toBe("Title is required.");
    expect(validateListingForm({ ...validForm, imageUrl: "" }).imageUrl).toBe(
      "Image URL is required.",
    );
    expect(
      validateListingForm({ ...validForm, priceXlm: "" }).priceXlm,
    ).toBe("Price is required.");
  });

  it("returns specific messages for common validation failures", () => {
    expect(
      validateListingForm({ ...validForm, priceXlm: "0" }).priceXlm,
    ).toBe("Price must be greater than 0.");
    expect(
      validateListingForm({ ...validForm, imageUrl: "not-a-url" }).imageUrl,
    ).toBe("Image URL must start with http:// or https://.");
  });

  // #61 – the encrypted+base64 ciphertext is what MAX_ENCRYPTED_PROMPT_LEN
  // actually gates on-chain, and is larger than the raw plaintext character
  // count validated above. A prompt well under the 50,000-char plaintext cap
  // can still be rejected once the encrypted-size check kicks in.
  it("rejects a prompt whose encrypted payload would exceed the on-chain limit", () => {
    // Comfortably below LISTING_LIMITS.fullPrompt (50,000 chars), but ASCII
    // chars roughly 1:1 with plaintext bytes, so ~3,200 chars already pushes
    // the base64 ciphertext (plaintext + 16-byte GCM tag, base64-expanded)
    // past LISTING_LIMITS.encryptedPrompt.
    const oversizedPrompt = "a".repeat(3_200);
    expect(estimateEncryptedPayloadSize(oversizedPrompt)).toBeGreaterThan(
      LISTING_LIMITS.encryptedPrompt,
    );
    expect(
      validateListingForm({ ...validForm, fullPrompt: oversizedPrompt }).fullPrompt,
    ).toMatch(/too large/i);
  });

  it("accepts a prompt whose encrypted payload fits within the on-chain limit", () => {
    const fittingPrompt = "a".repeat(2_000);
    expect(estimateEncryptedPayloadSize(fittingPrompt)).toBeLessThanOrEqual(
      LISTING_LIMITS.encryptedPrompt,
    );
    expect(
      validateListingForm({ ...validForm, fullPrompt: fittingPrompt }).fullPrompt,
    ).toBeUndefined();
  });
});

// #269 – field-level (on-blur) validation
const validFieldInput: ListingFormInput = {
  imageUrl: "https://example.com/cover.png",
  title: "Campaign launch pack",
  category: "Marketing",
  previewText: "Public preview text for buyers browsing the marketplace.",
  fullPrompt: "Private prompt body with enough content for validation.",
  priceXlm: "2.5",
  classification: "professional",
  safetyFlags: [],
};

describe("validateListingField", () => {
  it("returns a message for an invalid field", () => {
    expect(
      validateListingField("title", { ...validFieldInput, title: "" }),
    ).toBeDefined();
  });

  it("returns undefined for a valid field", () => {
    expect(validateListingField("title", validFieldInput)).toBeUndefined();
  });

  it("reports only the requested field, not its siblings", () => {
    const input = { ...validFieldInput, title: "" };
    expect(validateListingField("priceXlm", input)).toBeUndefined();
    expect(validateListingField("title", input)).toBeDefined();
  });
});

describe("buildListingChecklistItems", () => {
  it("marks required fields as fail with actionable hints", () => {
    const items = buildListingChecklistItems({
      imageUrl: "",
      title: "",
      category: "",
      previewText: "",
      fullPrompt: "",
      priceXlm: "",
    });

    const failures = items.filter((item) => item.status === "fail");
    expect(failures.length).toBeGreaterThanOrEqual(6);
    expect(failures.every((item) => Boolean(item.hint))).toBe(true);
  });

  it("adds non-blocking warnings for low-quality but valid listings", () => {
    const items = buildListingChecklistItems({
      ...validForm,
      title: "Short",
      previewText: "Still long enough for required validation here.",
      priceXlm: "0.25",
    });

    expect(items.some((item) => item.status === "warn")).toBe(true);
  });

  it("provides inline hints for each checklist item", () => {
    const items = buildListingChecklistItems({
      ...validForm,
      title: "",
      priceXlm: "0",
      imageUrl: "",
    });

    const titleItem = items.find((i) => i.id === "title");
    expect(titleItem?.hint).toBe("Title is required.");

    const priceItem = items.find((i) => i.id === "priceXlm");
    expect(priceItem?.hint).toBe("Price must be greater than 0.");

    const imageItem = items.find((i) => i.id === "imageUrl");
    expect(imageItem?.hint).toBe("Image URL is required.");
  });

  it("classifies empty classification as required", () => {
    const result = validateListingForm({ ...validForm, classification: "" });
    expect(result.classification).toBe("Content classification is required.");
  });

  it("returns the specific field message from validateListingField", () => {
    expect(
      validateListingField("title", { ...validFieldInput, title: "" }),
    ).toBe("Title is required.");
    expect(
      validateListingField("priceXlm", { ...validFieldInput, priceXlm: "0" }),
    ).toBe("Price must be greater than 0.");
  });
});
