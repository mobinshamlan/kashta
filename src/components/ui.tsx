"use client";

import { RotateCcw } from "lucide-react";
import type { CSSProperties } from "react";
import type { ClientErrorCode } from "@/lib/client-api";
import { rating, type Rating } from "@/lib/score";
import type { Factor, FactorScore } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { formatDayMonth } from "@/lib/i18n";

export function CoverageNotice({ nights }: { nights: string[] }) {
  const { locale, dict } = useI18n();
  const dates = [...new Set(nights)];
  if (!dates.length) return null;
  return <p className="coverage-notice small my-4 border-s-2 border-olive ps-3 text-ink-2">{dict.plan.coverageNotice(dates.map(date => formatDayMonth(date, locale)).join(locale === "ar" ? "، " : ", "))}</p>;
}

export const RATING_COLOR: Record<Rating, string> = {
  excellent: "var(--color-good)",
  good: "var(--color-good)",
  fair: "var(--color-fair)",
  poor: "var(--color-poor)",
  unknown: "var(--color-ink-2)",
};

export function ErrorState({
  code,
  onRetry,
  className = "",
}: {
  code: ClientErrorCode;
  onRetry?: () => void;
  className?: string;
}) {
  const { dict } = useI18n();
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-4 bg-sand-2 p-5 ${className}`}>
      <p className="flex-1 basis-60">{dict.errors[code] ?? dict.errors.internal}</p>
      {onRetry && (
        <button type="button" className="btn-quiet" onClick={onRetry}>
          <RotateCcw aria-hidden size={18} />
          {dict.common.retry}
        </button>
      )}
    </div>
  );
}

/** The score as a large figure with its rating word; never colour alone. */
export function ScoreFigure({ score, size = "md", dark = false }: { score: number | null; size?: "sm" | "md" | "lg"; dark?: boolean }) {
  const { dict } = useI18n();
  const r = rating(score);
  const sizes = { sm: "lead", md: "sub", lg: "display" };
  return (
    <div className={`flex gap-3 ${size === "sm" ? "items-baseline" : "items-center"}`}>
      <span className={size === "sm" ? "" : `score-orbit ${size === "lg" ? "score-orbit-lg" : ""}`}>
        {size !== "sm" && (
          <svg viewBox="0 0 88 88" aria-hidden="true" style={{ color: dark ? "var(--color-star)" : RATING_COLOR[r] }}>
            <circle className="score-track" cx="44" cy="44" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
            {score !== null && <circle key={score} className="score-progress" cx="44" cy="44" r="40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ "--score-offset": 251.33 * (1 - score / 100) } as CSSProperties} />}
          </svg>
        )}
        <span className={`num font-light leading-none ${size === "lg" ? "text-[3.5rem]" : sizes[size]}`}>{score ?? "—"}</span>
      </span>
      <span className="small font-medium" style={{ color: dark ? undefined : RATING_COLOR[r] }}>
        {dict.rating[r]}
      </span>
    </div>
  );
}

/** Horizontal bar per factor: value, weight and score, readable without colour. */
export function FactorBars({
  factors,
  dealbreakers = [],
  dark = false,
}: {
  factors: FactorScore[];
  dealbreakers?: Factor[];
  dark?: boolean;
}) {
  const { dict } = useI18n();
  const track = dark ? "bg-night-3" : "bg-sand-3";
  const fill = dark ? "bg-star" : "bg-ink";
  return (
    <div>
    <ul className="flex flex-col gap-4">
      {factors.map((f) => (
        <li key={f.factor}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">
              {dict.factor[f.factor]}
              {dealbreakers.includes(f.factor) && (
                <span className="ms-2 small font-medium text-poor" style={dark ? { color: "#f0a08a" } : undefined}>
                  {dict.plan.dealbreaker}
                </span>
              )}
            </span>
            <span className={`small num ${dark ? "text-star-2" : "text-ink-2"}`} dir="ltr">
              {f.value ?? "—"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className={`h-2 flex-1 ${track}`} aria-hidden>
              {f.score !== null && <div key={f.score} className={`factor-fill h-full ${fill}`} style={{ width: `${f.score}%` }} />}
            </div>
            <span className="small num min-w-16 whitespace-nowrap text-end">
              {f.score === null ? dict.plan.missing : `${f.score}/100`}
            </span>
          </div>
        </li>
      ))}
    </ul>
    <details className="small mt-5 border-t border-current/20 pt-3">
      <summary className="min-h-11 py-2 font-medium">{dict.plan.weightDetails}</summary>
      <ul className={`mt-3 space-y-3 ${dark ? "text-star-2" : "text-ink-2"}`}>
        {factors.map(factor => <li key={factor.factor}><span className="font-medium">{dict.factor[factor.factor]} · {Math.round(factor.weight * 100)}%</span><p>{dict.factorHint[factor.factor]}</p></li>)}
      </ul>
    </details>
    </div>
  );
}

/** Moon drawn from its illuminated fraction; waxing is lit on the right as seen from the north. */
export function MoonGlyph({ illumination, waxing, size = 40 }: { illumination: number; waxing: boolean; size?: number }) {
  const r = 20;
  // Terminator ellipse x-radius: 1 at new/full, 0 at quarter.
  const k = Math.abs(1 - 2 * illumination) * r;
  const litRight = waxing;
  const sweepOuter = litRight ? 1 : 0;
  // Gibbous (>50%) bulges the terminator into the dark side.
  const sweepInner = illumination > 0.5 ? sweepOuter : 1 - sweepOuter;
  const d = `M ${r} 0 A ${r} ${r} 0 0 ${sweepOuter} ${r} ${2 * r} A ${k} ${r} 0 0 ${sweepInner} ${r} 0 Z`;
  return (
    <svg width={size} height={size} viewBox="-2 -2 44 44" aria-hidden className="shrink-0">
      <circle cx={r} cy={r} r={r} fill="#3a3f48" />
      {illumination > 0.02 && <path d={d} fill="#e8e7e4" />}
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
