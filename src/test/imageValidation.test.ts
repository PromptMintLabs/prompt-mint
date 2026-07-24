import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateImageMetadata } from "../lib/validation/listing";

describe("Image Validation (validateImageMetadata)", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fail when URL is empty", async () => {
    const error = await validateImageMetadata("");
    expect(error).toBe("Image URL is required.");
  });

  it("should fail when server returns 400", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Invalid image URL" } }),
    });

    const error = await validateImageMetadata("http://example.com/not-image.txt");
    expect(error).toBe("Invalid image URL");
  });

  it("should pass when server returns 200", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, contentType: "image/jpeg", contentLength: "1024" }),
    });

    const error = await validateImageMetadata("http://example.com/image.jpg");
    expect(error).toBeNull();
  });

  it("should fail gracefully on network error", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Network Error"));

    const error = await validateImageMetadata("http://example.com/image.jpg");
    expect(error).toBe("Failed to reach the validation server.");
  });
});
