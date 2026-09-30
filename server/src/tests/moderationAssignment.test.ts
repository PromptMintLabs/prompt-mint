import { buildReportAssignmentUpdate } from "../services/moderationAssignment";

describe("moderation report assignment", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");

  it("normalizes reviewer and moderator addresses when assigning", () => {
    expect(
      buildReportAssignmentUpdate({
        reviewerAddress: "  GReviewer  ",
        assignedBy: " GModerator ",
        now,
      }),
    ).toEqual({
      assignedReviewer: "greviewer",
      assignedAt: now,
      assignedBy: "gmoderator",
    });
  });

  it("clears ownership when assigned reviewer is empty or null", () => {
    expect(buildReportAssignmentUpdate({ reviewerAddress: "", now })).toEqual({
      assignedReviewer: null,
      assignedAt: null,
      assignedBy: null,
    });
    expect(buildReportAssignmentUpdate({ reviewerAddress: null, now })).toEqual({
      assignedReviewer: null,
      assignedAt: null,
      assignedBy: null,
    });
  });

  it("rejects non-string reviewer values and oversized addresses", () => {
    expect(() => buildReportAssignmentUpdate({ reviewerAddress: 42, now })).toThrow(
      "reviewerAddress must be a string or null",
    );
    expect(() => buildReportAssignmentUpdate({ reviewerAddress: "a".repeat(129), now })).toThrow(
      "reviewerAddress must be 128 characters or fewer",
    );
  });
});
