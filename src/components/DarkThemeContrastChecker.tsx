import { useState, useCallback } from "react";
import { Check, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  checkContrast,
  type ContrastResult,
} from "@/lib/contrast";

interface ContrastCheck {
  name: string;
  foreground: string;
  background: string;
  result: ContrastResult;
}

const DARK_THEME_PAIRS: Array<{ name: string; fg: string; bg: string }> = [
  { name: "Foreground / Background", fg: "210 40% 98%", bg: "222.2 84% 4.9%" },
  { name: "Card Foreground / Card", fg: "210 40% 98%", bg: "222.2 84% 4.9%" },
  { name: "Primary Foreground / Primary", fg: "222.2 47.4% 11.2%", bg: "262.1 83.3% 57.8%" },
  { name: "Secondary Foreground / Secondary", fg: "210 40% 98%", bg: "217.2 32.6% 17.5%" },
  { name: "Muted Foreground / Muted", fg: "215 20.2% 65.1%", bg: "217.2 32.6% 17.5%" },
  { name: "Accent Foreground / Accent", fg: "210 40% 98%", bg: "217.2 32.6% 17.5%" },
  { name: "Destructive Foreground / Destructive", fg: "210 40% 98%", bg: "0 62.8% 30.6%" },
];

interface DarkThemeContrastCheckerProps {
  className?: string;
}

export function DarkThemeContrastChecker({
  className,
}: DarkThemeContrastCheckerProps) {
  const [checks] = useState<ContrastCheck[]>(() =>
    DARK_THEME_PAIRS.map(({ name, fg, bg }) => ({
      name,
      foreground: fg,
      background: bg,
      result: checkContrast(fg, bg),
    })),
  );

  const failures = checks.filter((c) => !c.result.passesAA);


  const getGrade = useCallback((r: ContrastResult) => {
    if (r.passesAAA) return { label: "AAA", color: "text-emerald-400" };
    if (r.passesAA) return { label: "AA", color: "text-emerald-400" };
    if (r.passesAALarge) return { label: "AA Large", color: "text-amber-400" };
    return { label: "Fail", color: "text-red-400" };
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-5 h-5 text-slate-400" />
        <h3 className="text-lg font-semibold text-white">
          Dark Theme Contrast Check
        </h3>
        <span className="text-xs text-slate-500 ml-auto">WCAG 2.1</span>
      </div>

      {failures.length > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">
              {failures.length} token pair{failures.length > 1 ? "s" : ""} below
              AA threshold
            </span>
          </div>
          <div className="space-y-2">
            {failures.map((check) => {
              const grade = getGrade(check.result);
              return (
                <div
                  key={check.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-300">{check.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">
                      {check.result.ratio.toFixed(2)}:1
                    </span>
                    <span className={cn("text-xs font-semibold", grade.color)}>
                      {grade.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {checks.map((check) => {
          const grade = getGrade(check.result);
          return (
            <div
              key={check.name}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                check.result.passesAA
                  ? "bg-emerald-500/5 border-emerald-500/10"
                  : "bg-red-500/5 border-red-500/10",
              )}
            >
              <div className="flex items-center gap-3">
                {check.result.passesAA ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span className="text-sm text-slate-300">{check.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-4 rounded border border-white/10"
                  style={{
                    backgroundColor: `hsl(${check.background})`,
                  }}
                >
                  <div
                    className="w-full h-full rounded flex items-center justify-center text-[8px] font-bold"
                    style={{ color: `hsl(${check.foreground})` }}
                  >
                    Aa
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {check.result.ratio.toFixed(2)}:1
                </span>
                <span className={cn("text-xs font-semibold", grade.color)}>
                  {grade.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-slate-600 pt-2">
        WCAG AA requires 4.5:1 for normal text, 3:1 for large text (18pt+).
        AAA requires 7:1 for normal text, 4.5:1 for large text.
      </div>
    </div>
  );
}
