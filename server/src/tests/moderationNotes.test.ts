import { buildCollaborationNotesUpdate } from "../services/moderationNotes";

describe("moderation collaboration notes", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");

  it("preserves multiline notes and records the editor", () => {
    expect(
      buildCollaborationNotesUpdate({
        notes: "  Check the source.\nFollow up with the reporter.  ",
        updatedBy: " GModerator ",
        now,
      }),
    ).toEqual({
      collaborationNotes: "Check the source.\nFollow up with the reporter.",
      collaborationNotesUpdatedAt: now,
      collaborationNotesUpdatedBy: "gmoderator",
    });
  });

  it("allows notes to be cleared with an empty string", () => {
    expect(buildCollaborationNotesUpdate({ notes: "   ", now })).toEqual({
      collaborationNotes: "",
      collaborationNotesUpdatedAt: now,
      collaborationNotesUpdatedBy: null,
    });
  });

  it("rejects non-string and oversized note values", () => {
    expect(() => buildCollaborationNotesUpdate({ notes: null, now })).toThrow(
      "notes must be a string",
    );
    expect(() => buildCollaborationNotesUpdate({ notes: "a".repeat(5001), now })).toThrow(
      "notes must be 5000 characters or fewer",
    );
  });
});