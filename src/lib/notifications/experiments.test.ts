import { describe, it, expect } from "vitest";
import {
  hashToBucket,
  assignVariant,
  NOTIFICATION_EXPERIMENTS,
} from "./experiments";

describe("Notification Preference Experiment Framework (Issue #745)", () => {
  it("computes deterministic hash buckets for a given subject and experiment", () => {
    const bucket1 = hashToBucket("GUSER12345", "notification_grouping");
    const bucket2 = hashToBucket("GUSER12345", "notification_grouping");
    expect(bucket1).toBe(bucket2);
    expect(bucket1).toBeGreaterThanOrEqual(0);
    expect(bucket1).toBeLessThan(100);
  });

  it("assigns different variants depending on subject hash bucket", () => {
    const exp = NOTIFICATION_EXPERIMENTS["notification_grouping"];
    const variantA = assignVariant(exp, "wallet_alpha_user");
    const variantB = assignVariant(exp, "wallet_beta_user");

    expect(variantA).toBeDefined();
    expect(variantB).toBeDefined();
    expect(["control", "collapsed_by_prompt"]).toContain(variantA.id);
    expect(["control", "collapsed_by_prompt"]).toContain(variantB.id);
  });

  it("falls back to default variant when experiment is disabled", () => {
    const disabledExp = {
      key: "test_disabled",
      name: "Disabled Test",
      description: "Test",
      enabled: false,
      variants: [
        { id: "control", weight: 50, config: { enabled: false } },
        { id: "treatment", weight: 50, config: { enabled: true } },
      ],
    };

    const variant = assignVariant(disabledExp, "any_user");
    expect(variant.id).toBe("control");
  });
});
