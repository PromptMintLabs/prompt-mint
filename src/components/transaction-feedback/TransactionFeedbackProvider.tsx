import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type TransactionStatus = "idle" | "pending" | "success" | "error";

interface TransactionFeedbackContextType {
  status: TransactionStatus;
  error: string | null;
  setStatus: (_status: TransactionStatus) => void;
  setError: (_error: string | null) => void;
  clear: () => void;
  retry?: () => void;
}

const TransactionFeedbackContext = createContext<TransactionFeedbackContextType | undefined>(undefined);

export const TransactionFeedbackProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [status, setRawStatus] = useState<TransactionStatus>("idle");
  const [error, setRawError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | undefined>(undefined);
  const [announcementId, setAnnouncementId] = useState(0);

  const setStatus = useCallback((newStatus: TransactionStatus) => {
    setRawStatus(newStatus);
    setAnnouncementId((prev) => prev + 1);
  }, []);

  const setError = useCallback((newError: string | null) => {
    setRawError(newError);
    setAnnouncementId((prev) => prev + 1);
  }, []);

  const clear = useCallback(() => {
    setRawStatus("idle");
    setRawError(null);
    setRetry(undefined);
    setAnnouncementId((prev) => prev + 1);
  }, []);

  const contextValue = useMemo(() => ({
    status,
    error,
    setStatus,
    setError,
    clear,
    retry,
  }), [status, error, setStatus, setError, clear, retry]);

  return (
    <TransactionFeedbackContext.Provider value={contextValue}>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={announcementId}>
          {status === "pending" && t("errors.transaction.pending", "Processing transaction on the Stellar network...")}
          {status === "success" && "Transaction successful."}
          {status === "error" && error}
        </span>
      </div>
      {children}
    </TransactionFeedbackContext.Provider>
  );
};

export function useTransactionFeedbackContext() {
  const ctx = useContext(TransactionFeedbackContext);
  if (!ctx) throw new Error("useTransactionFeedbackContext must be used within TransactionFeedbackProvider");
  return ctx;
}
