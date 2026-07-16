import { stroopsToXlmString } from "@/lib/stellar/format";
import { useCurrency } from "@/providers/CurrencyProvider";

export function CurrencyPrice({ stroops }: { stroops: bigint }) {
  const { currency, xlmUsdRate } = useCurrency();
  const xlm = Number(stroopsToXlmString(stroops));
  if (currency === "USD" && xlmUsdRate) {
    return <>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(xlm * xlmUsdRate)}</>;
  }
  return <>{stroopsToXlmString(stroops)} XLM</>;
}
