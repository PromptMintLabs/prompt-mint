import { describe, it, expect } from "vitest";
import { buildReactivationEmail } from "../services/reactivationEmailService.js";

describe("reactivationEmailService", () => {
  describe("buildReactivationEmail", () => {
    it("should build a valid reactivation email", () => {
      const payload = {
        creatorWallet: "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G",
        delistedPromptCount: 2,
      };

      const email = buildReactivationEmail(payload, payload.creatorWallet);

      expect(email).toHaveProperty("subject");
      expect(email).toHaveProperty("html");
      expect(email).toHaveProperty("unsubscribeUrl");
      expect(email.subject).toContain("delisted");
      expect(email.html).toContain("2");
    });

    it("should handle single delisted prompt", () => {
      const payload = {
        creatorWallet: "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G",
        delistedPromptCount: 1,
      };

      const email = buildReactivationEmail(payload, payload.creatorWallet);

      expect(email.html).toContain("Your prompt has been delisted");
    });

    it("should include delist reason when provided", () => {
      const payload = {
        creatorWallet: "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G",
        delistedPromptCount: 1,
        delistReason: "Violation of content policy",
      };

      const email = buildReactivationEmail(payload, payload.creatorWallet);

      expect(email.html).toContain("Violation of content policy");
    });

    it("should include unsubscribe URL", () => {
      const payload = {
        creatorWallet: "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G",
        delistedPromptCount: 1,
      };

      const email = buildReactivationEmail(payload, payload.creatorWallet);

      expect(email.unsubscribeUrl).toContain("unsubscribe");
      expect(email.unsubscribeUrl).toContain("ReactivationCampaign");
    });
  });
});
