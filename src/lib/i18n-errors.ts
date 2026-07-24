import i18n from "../i18n";

const TX_ERROR_MAP: Record<string, string> = {
  "user rejected": "errors.transaction.user_rejected",
  "op_underfunded": "errors.transaction.insufficient_funds",
  "insufficient funds": "errors.transaction.insufficient_funds",
  "insufficient gas": "errors.transaction.insufficient_gas",
  "invalid signature": "errors.transaction.invalid_signature",
  "network error": "errors.transaction.network_error",
  "timeout": "errors.transaction.expired",
  "expired": "errors.transaction.expired",
};

const FALLBACK_UNKNOWN = "An unexpected error occurred. Please try again.";

export function translateError(message: string): string {
  if (!message) return "";

  const lower = message.toLowerCase();

  for (const [key, tKey] of Object.entries(TX_ERROR_MAP)) {
    if (lower.includes(key)) {
      return i18n.t(tKey, { defaultValue: FALLBACK_UNKNOWN });
    }
  }

  return i18n.t("errors.transaction.unknown", { defaultValue: FALLBACK_UNKNOWN });
}

export function formatValidationError(key: string, params?: Record<string, unknown>): string {
  const fullKey = `errors.validation.${key}`;
  if (i18n.exists(fullKey)) {
    return i18n.t(fullKey, params);
  }
  return i18n.t(fullKey, { defaultValue: key, ...params });
}
