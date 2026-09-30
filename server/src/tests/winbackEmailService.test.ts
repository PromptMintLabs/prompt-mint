import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildWinbackEmail } from "../services/winbackEmailService.js";

describe("winbackEmailService", () => {
  describe("buildWinbackEmail", () => {
    it("should build a valid winback email with all required fields", () => {
      const payload = {
        buyerWallet: "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G",
        lastPurchaseDate: new Date("2026-08-28"),
        daysSinceActivity: 30,
        topCategoryViewed: "Programming",
      };

      const email = buildWinbackEmail(payload, payload.buyerWallet);

      expect(email).toHaveProperty("subject");
      expect(email).toHaveProperty("html");
      expect(email).toHaveProperty("unsubscribeUrl");
      expect(email.subject).toContain("We miss you");
      expect(email.html).toContain("30");
      expect(email.html).toContain("Programming");
    });

    it("should handle missing category", () => {
      const payload = {
        buyerWallet: "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G",
        lastPurchaseDate: new Date("2026-08-28"),
        daysSinceActivity: 60,
      };

      const email = buildWinbackEmail(payload, payload.buyerWallet);

      expect(email.html).toContain("new prompts");
      expect(email.html).not.toContain("undefined");
    });

    it("should include unsubscribe URL", () => {
      const payload = {
        buyerWallet: "GBUQWP3BOUZX34LOCALHLXXI7KE2N35A76YFMZ6T63H3NH2PL5F57Y2G",
        lastPurchaseDate: new Date(),
        daysSinceActivity: 45,
      };

      const email = buildWinbackEmail(payload, payload.buyerWallet);

      expect(email.unsubscribeUrl).toContain("unsubscribe");
      expect(email.unsubscribeUrl).toContain("WinbackCampaign");
      expect(email.html).toContain(email.unsubscribeUrl);
    });
  });
});
