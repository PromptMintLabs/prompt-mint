import { useTransactionFeedback } from "./useTransactionFeedback";
import { translateError } from "../../lib/i18n-errors";

export const TransactionErrorBanner = ({ onRetry }: { onRetry?: () => void }) => {
  const { status, error, clear } = useTransactionFeedback();
  if (status !== "error" || !error) return null;

  const localizedError = translateError(error);

  return (
    <div className="rounded-xl bg-red-900/80 text-red-100 px-4 py-2 mb-2 flex items-center gap-4" role="alert">
      <span>{localizedError}</span>
      {onRetry && (
        <button type="button" className="retry-btn ml-auto px-3 py-1 rounded bg-red-700/80 text-white hover:bg-red-700" onClick={() => { clear(); onRetry(); }}>
          Retry
        </button>
      )}
    </div>
  );
};
