import { buildListingSnapshotFromPrompt } from "../services/listingSnapshot";

const capturedAt = new Date("2026-09-28T12:00:00.000Z");

describe("reported listing snapshot", () => {
  it("captures the public listing fields and excludes gated content", () => {
    const snapshot = buildListingSnapshotFromPrompt(
      {
        _id: "665f1c2a9b1e4d0012a34567",
        onChainId: "42",
        title: "  Architecture Review  ",
        category: "Programming",
        image: "https://example.test/a.png",
        price: 5,
        salesCount: 17,
        listingStatus: "published",
        tags: ["arch", "review"],
        content: "the paid prompt body",
      },
      capturedAt,
    );

    expect(snapshot).toEqual({
      promptId: "42",
      capturedAt,
      title: "Architecture Review",
      category: "Programming",
      image: "https://example.test/a.png",
      price: 5,
      salesCount: 17,
      listingStatus: "published",
      onChainId: "42",
      tags: ["arch", "review"],
    });
    expect(JSON.stringify(snapshot)).not.toContain("paid prompt body");
    expect(snapshot).not.toHaveProperty("content");
  });

  it("falls back to the document id when there is no on-chain id", () => {
    const snapshot = buildListingSnapshotFromPrompt(
      { _id: "665f1c2a9b1e4d0012a34567", title: "Draft listing" },
      capturedAt,
    );
    expect(snapshot?.promptId).toBe("665f1c2a9b1e4d0012a34567");
  });

  it("returns undefined when the listing has no identifier", () => {
    expect(buildListingSnapshotFromPrompt(null, capturedAt)).toBeUndefined();
    expect(buildListingSnapshotFromPrompt(undefined, capturedAt)).toBeUndefined();
    expect(buildListingSnapshotFromPrompt({ title: "no id" }, capturedAt)).toBeUndefined();
  });

  it("returns a frozen snapshot that later listing edits cannot change", () => {
    const listing = {
      onChainId: "42",
      title: "Original title",
      tags: ["original"],
    };
    const snapshot = buildListingSnapshotFromPrompt(listing, capturedAt)!;

    listing.title = "Edited title";
    listing.tags.push("added-later");

    expect(snapshot.title).toBe("Original title");
    expect(snapshot.tags).toEqual(["original"]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.tags)).toBe(true);
  });
});
