import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "../services/unsubscribeToken";
import {
  buildPurchaseEmail,
  buildUpdateEmail,
} from "../services/emailNotifications";

describe("Unsubscribe Token and Email Notifications (Issue #748)", () => {
  const testWallet = "GAB7XYZ1234567890ABCDEF";

  it("generates and verifies a valid unsubscribe token", () => {
    const token = createUnsubscribeToken(testWallet, "PromptPurchased");
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const result = verifyUnsubscribeToken(token);
    expect(result.valid).toBe(true);
    expect(result.wallet).toBe(testWallet.toLowerCase());
    expect(result.event).toBe("PromptPurchased");
  });

  it("generates and verifies a global unsubscribe token (no specific event)", () => {
    const token = createUnsubscribeToken(testWallet);
    const result = verifyUnsubscribeToken(token);
    expect(result.valid).toBe(true);
    expect(result.wallet).toBe(testWallet.toLowerCase());
    expect(result.event).toBeUndefined();
  });

  it("rejects a token with invalid signature or tampered payload", () => {
    const token = createUnsubscribeToken(testWallet, "PromptPurchased");
    const [payloadB64] = token.split(".");
    const tamperedToken = `${payloadB64}.tampered_signature_xyz`;

    const result = verifyUnsubscribeToken(tamperedToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });

  it("rejects an expired unsubscribe token", () => {
    // TTL -10s so it is already expired
    const token = createUnsubscribeToken(testWallet, "PromptPurchased", -10);
    const result = verifyUnsubscribeToken(token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("token_expired");
  });

  it("rejects malformed or empty token strings", () => {
    expect(verifyUnsubscribeToken("").valid).toBe(false);
    expect(verifyUnsubscribeToken("not-a-token").valid).toBe(false);
  });

  it("includes valid unsubscribe links and footers in purchase email templates", () => {
    const email = buildPurchaseEmail(
      {
        buyerWallet: "GBUYER123",
        promptTitle: "Cyberpunk City Generator",
        promptId: "prompt-1",
        txHash: "tx-abc",
      },
      testWallet
    );

    expect(email.unsubscribeUrl).toBeDefined();
    expect(email.unsubscribeUrl).toContain("/unsubscribe?token=");
    expect(email.unsubscribeUrl).toContain("event=PromptPurchased");
    expect(email.html).toContain(email.unsubscribeUrl);
    expect(email.html).toContain("unsubscribe with one click");
  });

  it("includes valid unsubscribe links and footers in update email templates", () => {
    const email = buildUpdateEmail(
      {
        ownerWallet: "GOWNER123",
        promptTitle: "Cyberpunk City Generator",
        promptId: "prompt-1",
        versionIndex: 2,
      },
      testWallet
    );

    expect(email.unsubscribeUrl).toBeDefined();
    expect(email.unsubscribeUrl).toContain("/unsubscribe?token=");
    expect(email.unsubscribeUrl).toContain("event=PromptUpdated");
    expect(email.html).toContain(email.unsubscribeUrl);
    expect(email.html).toContain("unsubscribe with one click");
  });
});
