import { useCallback, useId } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isValidStellarAddress } from "@/lib/stellar/addressValidation";

export type StellarAddressValidationResult =
  | { status: "valid" }
  | { status: "invalid"; reason: string };

export interface StellarAddressInputProps {
  value: string;
  onChange: (value: string, validation: StellarAddressValidationResult) => void;
  connectedAddress?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function validate(value: string, connectedAddress?: string): StellarAddressValidationResult {
  if (!value) {
    return { status: "invalid", reason: "" };
  }
  if (value === connectedAddress) {
    return { status: "invalid", reason: "Cannot use your own wallet address" };
  }
  if (!isValidStellarAddress(value)) {
    return { status: "invalid", reason: "Invalid Stellar address format" };
  }
  return { status: "valid" };
}

export function StellarAddressInput({
  value,
  onChange,
  connectedAddress,
  label = "Recipient Stellar Address",
  placeholder = "G...",
  className,
  disabled = false,
  id: externalId,
}: StellarAddressInputProps) {
  const autoId = useId();
  const inputId = externalId ?? autoId;
  const errorId = `${inputId}-error`;

  const validation = validate(value, connectedAddress);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      const result = validate(next, connectedAddress);
      onChange(next, result);
    },
    [onChange, connectedAddress],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-slate-300"
      >
        {label}
      </label>
      <div className="relative">
        <Input
          id={inputId}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={validation.status === "invalid" && value.length > 0}
          aria-describedby={validation.status === "invalid" && value.length > 0 ? errorId : undefined}
          className={cn(
            "pr-8",
            validation.status === "valid" && "border-emerald-500/50 focus-visible:ring-emerald-500/30",
            validation.status === "invalid" && value.length > 0 && "border-rose-500/50 focus-visible:ring-rose-500/30",
          )}
        />
        {validation.status === "valid" && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <Check className="h-4 w-4 text-emerald-400" />
          </span>
        )}
      </div>
      {validation.status === "invalid" && validation.reason && value.length > 0 && (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs text-rose-400">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {validation.reason}
        </p>
      )}
    </div>
  );
}
