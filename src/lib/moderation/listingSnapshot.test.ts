import { describe, expect, it } from "vitest";
import {
  buildListingSnapshot,
  cloneListingSnapshot,
  LISTING_SNAPSHOT_LIMITS,
  type ReportedListingSnapshot,
} from "./listingSnapshot";

const NOW = 1_700_000_000_000;

describe("buildListingSnapshot", () => {
  it("captures the public listing metadata at report time", () => {
    const snapshot = buildListingSnapshot(
      {
        promptId: "42",
        title: "  Architecture Review  ",
        category: "Programming",
        creator: "GCREATOR",
        imageUrl: "https://example.test/a.png",
        previewText: "A short public teaser",
        price: 50_000_000n,
        tags: ["arch", "review"],
      },
      NOW,
    );

    expect(snapshot).toEqual({
      promptId: "42",
      capturedAt: NOW,
      title: "Architecture Review",
      category: "Programming",
      creator: "GCREATOR",
      imageUrl: "https://example.test/a.png",
      previewText: "A short public teaser",
      price: "50000000",
      tags: ["arch", "review"],
    });
  });

  it("never captures gated prompt content", () => {
    const snapshot = buildListingSnapshot(
      {
        promptId: "42",
        title: "Public title",
        content: "the paid prompt body",
        encryptedPrompt: "ciphertext",
        wrappedKey: "key",
      },
      NOW,
    );

    expect(snapshot).toBeDefined();
    expect(JSON.stringify(snapshot)).not.toContain("paid prompt body");
    expect(snapshot).not.toHaveProperty("content");
    expect(snapshot).not.toHaveProperty("encryptedPrompt");
    expect(snapshot).not.toHaveProperty("wrappedKey");
  });

  it("returns undefined when the listing id is missing or unusable", () => {
    expect(buildListingSnapshot(undefined, NOW)).toBeUndefined();
    expect(buildListingSnapshot(null, NOW)).toBeUndefined();
    expect(buildListingSnapshot("42", NOW)).toBeUndefined();
    expect(buildListingSnapshot({ title: "no id" }, NOW)).toBeUndefined();
    expect(buildListingSnapshot({ promptId: "   " }, NOW)).toBeUndefined();
  });

  it("uses the server clock and ignores a client-supplied capturedAt", () => {
    const snapshot = buildListingSnapshot({ promptId: "42", capturedAt: 1 }, NOW);
    expect(snapshot?.capturedAt).toBe(NOW);
  });

  it("truncates over-long fields and caps the tag list", () => {
    const snapshot = buildListingSnapshot(
      {
        promptId: "42",
        title: "x".repeat(LISTING_SNAPSHOT_LIMITS.title + 50),
        previewText: "y".repeat(LISTING_SNAPSHOT_LIMITS.previewText + 50),
        tags: Array.from({ length: 25 }, (_, index) => `tag-${index}`),
      },
      NOW,
    );

    expect(snapshot?.title).toHaveLength(LISTING_SNAPSHOT_LIMITS.title);
    expect(snapshot?.previewText).toHaveLength(LISTING_SNAPSHOT_LIMITS.previewText);
    expect(snapshot?.tags).toHaveLength(LISTING_SNAPSHOT_LIMITS.tags);
  });

  it("drops empty and duplicate tags", () => {
    const snapshot = buildListingSnapshot(
      { promptId: "42", tags: ["spam", " spam ", "", "   ", "scam"] },
      NOW,
    );
    expect(snapshot?.tags).toEqual(["spam", "scam"]);
  });

  it("returns a frozen snapshot that later listing edits cannot change", () => {
    const listing = {
      promptId: "42",
      title: "Original title",
      tags: ["original"],
    };
    const snapshot = buildListingSnapshot(listing, NOW)!;

    listing.title = "Edited title";
    listing.tags.push("added-later");

    expect(snapshot.title).toBe("Original title");
    expect(snapshot.tags).toEqual(["original"]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.tags)).toBe(true);
  });
});

describe("cloneListingSnapshot", () => {
  it("persists an independent deep copy of a snapshot", () => {
    const source: ReportedListingSnapshot = {
      promptId: "42",
      capturedAt: NOW,
      title: "Original",
      tags: ["a", "b"],
    };

    const stored = cloneListingSnapshot(source);
    source.title = "mutated";
    source.tags!.push("c");

    expect(stored).not.toBe(source);
    expect(stored.tags).not.toBe(source.tags);
    expect(stored.title).toBe("Original");
    expect(stored.tags).toEqual(["a", "b"]);
    expect(Object.isFrozen(stored)).toBe(true);
  });
});
