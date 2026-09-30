import {
  compareModerationPriority,
  getModerationPriority,
} from "../services/moderationPriority";

const now = new Date("2026-09-28T12:00:00.000Z");

describe("moderation priority scoring", () => {
  it("weights safety and rights-related reasons above quality reports", () => {
    const harmful = getModerationPriority({
      reason: "harmful-content",
      createdAt: now,
      now,
    });
    const quality = getModerationPriority({
      reason: "quality-issue",
      createdAt: now,
      now,
    });

    expect(harmful).toMatchObject({ score: 100, level: "critical", ageBonus: 0 });
    expect(quality).toMatchObject({ score: 40, level: "low", ageBonus: 0 });
    expect(harmful.score).toBeGreaterThan(quality.score);
  });

  it("adds bounded urgency as a report ages", () => {
    const priority = getModerationPriority({
      reason: "misleading-content",
      createdAt: "2026-09-18T12:00:00.000Z",
      now,
    });
    const veryOld = getModerationPriority({
      reason: "misleading-content",
      createdAt: "2025-01-01T12:00:00.000Z",
      now,
    });

    expect(priority).toMatchObject({ score: 95, level: "high", ageBonus: 30 });
    expect(veryOld.ageBonus).toBe(30);
  });

  it("uses oldest-first ordering when scores tie", () => {
    const older = {
      reason: "other",
      createdAt: "2026-09-20T12:00:00.000Z",
      now,
    };
    const newer = {
      reason: "other",
      createdAt: "2026-09-20T13:00:00.000Z",
      now,
    };

    expect(compareModerationPriority(older, newer)).toBeLessThan(0);
    expect(compareModerationPriority(newer, older)).toBeGreaterThan(0);
  });

  it("falls back to the lowest severity for unknown reasons", () => {
    expect(
      getModerationPriority({ reason: "unknown", createdAt: now, now }),
    ).toMatchObject({ score: 20, level: "low", reasonWeight: 20 });
  });
});