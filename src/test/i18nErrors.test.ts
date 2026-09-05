import { describe, it, expect, beforeEach } from "vitest";
import i18n from "../i18n";

describe("i18n Error Localization", () => {
  beforeEach(() => {
    i18n.changeLanguage("en");
  });

  describe("translation keys exist", () => {
    it("has validation error keys in English", () => {
      expect(i18n.t("errors.validation.required")).toBe("This field is required.");
      expect(i18n.t("errors.validation.min_length", { min: 10 })).toBe(
        "Must be at least 10 characters."
      );
      expect(i18n.t("errors.validation.max_length", { max: 500 })).toBe(
        "Must not exceed 500 characters."
      );
      expect(i18n.t("errors.validation.invalid_rating")).toBe(
        "Rating must be between 1 and 5."
      );
      expect(i18n.t("errors.validation.review_text_short")).toBe(
        "Review text must be at least 10 characters."
      );
      expect(i18n.t("errors.validation.title_required")).toBe(
        "Title is required."
      );
      expect(i18n.t("errors.validation.title_min_length")).toBe(
        "Title must be at least 3 characters."
      );
      expect(i18n.t("errors.validation.price_must_be_positive")).toBe(
        "Price must be greater than 0."
      );
      expect(i18n.t("errors.validation.price_required")).toBe(
        "Price is required."
      );
      expect(i18n.t("errors.validation.image_url_invalid")).toBe(
        "Image URL must start with http:// or https://."
      );
      expect(i18n.t("errors.validation.image_url_required")).toBe(
        "Image URL is required."
      );
    });

    it("has transaction error keys in English", () => {
      expect(i18n.t("errors.transaction.user_rejected")).toBe(
        "Transaction was rejected by the user."
      );
      expect(i18n.t("errors.transaction.insufficient_funds")).toBe(
        "Insufficient funds to complete this transaction. Add more funds to your wallet and try again."
      );
      expect(i18n.t("errors.transaction.insufficient_gas")).toBe(
        "Insufficient gas to complete this transaction. Top up your wallet's XLM balance to cover network fees, then try again."
      );
      expect(i18n.t("errors.transaction.invalid_signature")).toBe(
        "Transaction signature is invalid. Reconnect your wallet and try signing the transaction again."
      );
      expect(i18n.t("errors.transaction.network_error")).toBe(
        "Network error. Please check your internet connection and try again."
      );
      expect(i18n.t("errors.transaction.unknown")).toBe(
        "An unexpected error occurred. Please try again. If this keeps happening, please contact support with the time this occurred."
      );
    });

    it("has wallet error keys in English", () => {
      expect(i18n.t("errors.wallet.connect_required")).toBe(
        "Please connect your wallet first."
      );
      expect(i18n.t("errors.wallet.network_mismatch")).toBe(
        "Your wallet is connected to the wrong network. Switch your wallet to the correct network and try again."
      );
    });

    it("has review error keys in English", () => {
      expect(i18n.t("errors.review.self_vote")).toBe(
        "You cannot vote on your own review."
      );
      expect(i18n.t("errors.review.duplicate_vote")).toBe(
        "You have already voted on this review."
      );
      expect(i18n.t("errors.review.seller_only")).toBe(
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
        "Insufficient funds to complete this transaction. Add more funds to your wallet and try again."
      );
      expect(translateError("op_underfunded")).toBe(
        "Insufficient funds to complete this transaction. Add more funds to your wallet and try again."
      );
      expect(translateError("Network error occurred")).toBe(
        "Network error. Please check your internet connection and try again."
      );
      expect(translateError("invalid signature provided")).toBe(
        "Transaction signature is invalid. Reconnect your wallet and try signing the transaction again."
      );
    });

    it("falls back to unknown error key for unmapped messages", async () => {
      const { translateError } = await import("../lib/i18n-errors");

      expect(translateError("some random error")).toBe(
        "An unexpected error occurred. Please try again. If this keeps happening, please contact support with the time this occurred."
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
      expect(i18n.t("errors.validation.required")).toBe("Ce champ est requis.");

      i18n.changeLanguage("es");
      expect(i18n.t("errors.validation.required")).toBe(
        "Este campo es obligatorio."
      );

      i18n.changeLanguage("zh");
      expect(i18n.t("errors.validation.required")).toBe("此字段为必填项。");

      i18n.changeLanguage("ja");
      expect(i18n.t("errors.validation.required")).toBe("この項目は必須です。");
    });

    it("all locales have all required keys", () => {
      const locales = ["en", "es", "fr", "zh", "ja"];
      const requiredKeys = [
        "errors.validation.required",
        "errors.validation.min_length",
        "errors.validation.max_length",
        "errors.transaction.user_rejected",
        "errors.transaction.insufficient_funds",
        "errors.transaction.unknown",
        "errors.wallet.connect_required",
        "errors.review.self_vote",
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
