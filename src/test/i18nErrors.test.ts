import { describe, it, expect, vi, beforeEach } from "vitest";
import i18n from "../i18n";

describe("i18n Error Localization", () => {
  beforeEach(() => {
    i18n.changeLanguage("en");
  });

  describe("translation keys exist", () => {
    it("has validation error keys in English", () => {
      expect(i18n.t("errors:validation.required")).toBe("This field is required.");
      expect(i18n.t("errors:validation.min_length", { min: 10 })).toBe(
        "Must be at least 10 characters."
      );
      expect(i18n.t("errors:validation.max_length", { max: 500 })).toBe(
        "Must not exceed 500 characters."
      );
      expect(i18n.t("errors:validation.invalid_rating")).toBe(
        "Rating must be between 1 and 5."
      );
      expect(i18n.t("errors:validation.review_text_short")).toBe(
        "Review text must be at least 10 characters."
      );
    });

    it("has transaction error keys in English", () => {
      expect(i18n.t("errors:transaction.user_rejected")).toBe(
        "Transaction was rejected by the user."
      );
      expect(i18n.t("errors:transaction.insufficient_funds")).toBe(
        "Insufficient funds to complete this transaction."
      );
      expect(i18n.t("errors:transaction.insufficient_gas")).toBe(
        "Insufficient gas to complete this transaction."
      );
      expect(i18n.t("errors:transaction.invalid_signature")).toBe(
        "Transaction signature is invalid."
      );
      expect(i18n.t("errors:transaction.network_error")).toBe(
        "Network error. Please try again."
      );
      expect(i18n.t("errors:transaction.unknown")).toBe(
        "An unexpected error occurred. Please try again."
      );
    });

    it("has wallet error keys in English", () => {
      expect(i18n.t("errors:wallet.connect_required")).toBe(
        "Please connect your wallet first."
      );
      expect(i18n.t("errors:wallet.network_mismatch")).toBe(
        "Wrong network configured in your wallet."
      );
    });

    it("has review error keys in English", () => {
      expect(i18n.t("errors:review.self_vote")).toBe(
        "You cannot vote on your own review."
      );
      expect(i18n.t("errors:review.duplicate_vote")).toBe(
        "You have already voted on this review."
      );
      expect(i18n.t("errors:review.seller_only")).toBe(
        "Only the verified seller can respond to reviews."
      );
    });
  });

  describe("translateError function", () => {
    it("maps common error messages to localized strings", async () => {
      const { translateError } = await import("../lib/i18n-errors");

      expect(translateError("user rejected the transaction")).toBe(
        "Transaction was rejected by the user."
      );
      expect(translateError("Insufficient funds")).toBe(
        "Insufficient funds to complete this transaction."
      );
      expect(translateError("op_underfunded")).toBe(
        "Insufficient funds to complete this transaction."
      );
      expect(translateError("Network error occurred")).toBe(
        "Network error. Please try again."
      );
      expect(translateError("invalid signature provided")).toBe(
        "Transaction signature is invalid."
      );
    });

    it("falls back to unknown error key for unmapped messages", async () => {
      const { translateError } = await import("../lib/i18n-errors");

      expect(translateError("some random error")).toBe(
        "An unexpected error occurred. Please try again."
      );
    });
  });

  describe("formatValidationError function", () => {
    it("returns localized string for known keys", async () => {
      const { formatValidationError } = await import("../lib/i18n-errors");

      expect(formatValidationError("required")).toBe("This field is required.");
      expect(formatValidationError("invalid_rating")).toBe(
        "Rating must be between 1 and 5."
      );
    });

    it("interpolates params in validation messages", async () => {
      const { formatValidationError } = await import("../lib/i18n-errors");

      expect(formatValidationError("min_length", { min: 10 })).toBe(
        "Must be at least 10 characters."
      );
      expect(formatValidationError("max_length", { max: 500 })).toBe(
        "Must not exceed 500 characters."
      );
    });
  });

  describe("fallback locale behavior", () => {
    it("falls back to English when a key is missing in other locales", () => {
      i18n.changeLanguage("fr");
      expect(i18n.t("errors:validation.required")).toBe("Ce champ est requis.");

      i18n.changeLanguage("es");
      expect(i18n.t("errors:validation.required")).toBe(
        "Este campo es obligatorio."
      );

      i18n.changeLanguage("zh");
      expect(i18n.t("errors:validation.required")).toBe("此字段为必填项。");
    });

    it("all locales have all required keys", () => {
      const locales = ["en", "es", "fr", "zh"];
      const requiredKeys = [
        "errors:validation.required",
        "errors:validation.min_length",
        "errors:validation.max_length",
        "errors:transaction.user_rejected",
        "errors:transaction.insufficient_funds",
        "errors:transaction.unknown",
        "errors:wallet.connect_required",
        "errors:review.self_vote",
      ];

      for (const locale of locales) {
        i18n.changeLanguage(locale);
        for (const key of requiredKeys) {
          const translated = i18n.t(key);
          expect(translated).toBeTruthy();
          expect(translated).not.toBe(key);
        }
      }
    });
  });
});
