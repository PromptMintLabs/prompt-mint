import { useMemo } from "react";
import {
  lintListing,
  getBlockingFindings,
  type LinterInput,
  type LinterFinding,
} from "@/lib/privacy/linter";

interface UsePrivacyLinterReturn {
  findings: LinterFinding[];
  blockingCount: number;
  hasBlocking: boolean;
  hasWarnings: boolean;
}

/**
 * Runs the privacy linter against the current listing form data.
 * Returns findings, blocking status, and warning counts.
 */
export function usePrivacyLinter(input: LinterInput): UsePrivacyLinterReturn {
  return useMemo(() => {
    const findings = lintListing(input);
    const blockers = getBlockingFindings(input);
    return {
      findings,
      blockingCount: blockers.length,
      hasBlocking: blockers.length > 0,
      hasWarnings: findings.some((f) => f.severity === "medium" || f.severity === "low"),
    };
  }, [input]);
}
