"use client";

import { Check, Cloud, CloudFog, CloudRain, Moon, Thermometer, Wind } from "lucide-react";
import type { NightSummary } from "@/lib/api-types";
import type { NightPick } from "@/lib/reasons";
import { getDestination } from "@/lib/destinations";
import { formatDayMonth, formatNight, formatWeekday } from "@/lib/i18n";
import { useI18n } from "./locale-provider";
import type { ScoreRow } from "@/lib/api-types";
import type { Experience } from "@/lib/types";
import { MoonGlyph } from "./ui";
import type { Factor } from "@/lib/types";

const FACTOR_ICON: Record<Factor, typeof Wind> = { temp: Thermometer, wind: Wind, rain: CloudRain, dust: CloudFog, clouds: Cloud, moon: Moon };

/** The weighted factor that cost the night the most, if any scored under 70. */
function limitingFactor(row: ScoreRow): Factor | null {
  let worst: { factor: Factor; cost: number } | null = null;
  for (const f of row.factors) {
    if (f.score === null || f.weight <= 0.04 || f.score >= 70) continue;
    const cost = (100 - f.score) * f.weight;
    if (!worst || cost > worst.cost) worst = { factor: f.factor, cost };
  }
  return worst?.factor ?? null;
}

/** Seven columns, one per night: bar height is the night's best score; the best night is tagged. */
export function SevenNights({
  nights,
  metricsFor,
  selected,
  bestNight,
  onSelect,
  compact = false,
}: {
  nights: NightPick[];
  metricsFor: (night: string) => NightSummary | undefined;
  selected: string | null;
  bestNight: string | null;
  onSelect: (night: string) => void;
  /** Bars only: no numbers or limiting icons, for the homepage glance. */
  compact?: boolean;
}) {
  const { locale, dict } = useI18n();
  return (
    <ol className={`seven ${compact ? "seven--compact" : ""}`} aria-label={dict.home.sevenTitle}>
      {nights.map(({ night, best, missing }, i) => {
        const m = metricsFor(night);
        const place = best ? getDestination(best.slug)?.name[locale] : undefined;
        const isBest = night === bestNight;
        const sep = locale === "ar" ? "، " : ", ";
        const limit = best ? limitingFactor(best) : null;
        const LimitIcon = limit ? FACTOR_ICON[limit] : Check;
        const limitText = limit
          ? (locale === "ar" ? `يحدّ منها: ${dict.factor[limit]}` : `Held back by: ${dict.factor[limit]}`)
          : (locale === "ar" ? "ما فيه شي يحد منها" : "Nothing holding it back");
        const MissingIcon = missing[0] ? FACTOR_ICON[missing[0]] : null;
        const poor = (best?.score ?? 100) < 50;
        const parts = best && place
          ? [place, `${dict.common.score} ${best.score}`, ...(poor ? [dict.rating.poor] : []), limitText, ...(m ? [`${dict.detail.moon} ${dict.detail.moonLit(Math.round(m.moonIllumination * 100))}`] : []), ...(isBest ? [dict.home.sevenBest] : [])]
          : [missing.length ? dict.home.weekNoFactor(factorList(missing, locale, dict.factor)) : dict.home.weekEmpty];
        const label = `${formatNight(night, locale)}: ${parts.join(sep)}`;
        return (
          <li key={night} className="min-w-0">
            <button
              type="button"
              className="seven-night w-full"
              data-best={isBest}
              data-state={!best ? "incomplete" : poor ? "poor" : "scored"}
              aria-pressed={selected === night}
              aria-label={label}
              // Unscored nights stay focusable so their label (what's missing) can be read.
              aria-disabled={!best || undefined}
              onClick={() => best && onSelect(night)}
            >
              {isBest && <span className="seven-best-tag" aria-hidden>{dict.home.sevenBest}</span>}
              <span className="seven-day" aria-hidden>
                <span className="seven-weekday font-medium">{i === 0 ? dict.common.tonight : formatWeekday(night, locale)}</span>
                <span className="block muted num whitespace-nowrap sm:hidden">{Number(night.slice(8))}</span>
                <span className="hidden muted num whitespace-nowrap sm:block">{formatDayMonth(night, locale)}</span>
              </span>
              <span className="seven-bar-track" aria-hidden>
                {best && <span className="seven-bar" style={{ height: `${Math.max(6, best.score ?? 0)}%` }} />}
                {/* No fake bar for an unscored night: an empty, dashed track reads as "not known yet". */}
                {/* Guide at 80: the "excellent" threshold. */}
                <span className="absolute inset-x-0 h-px bg-white/35" style={{ bottom: "80%" }} />
              </span>
              {!best && (
                <span className="seven-na" aria-hidden>
                  {MissingIcon && <MissingIcon size={15} />}
                  <span>{dict.home.weekNa}</span>
                </span>
              )}
              {!compact && best && <span className="seven-score" aria-hidden>{best.score}</span>}
              <span aria-hidden className="flex items-center gap-1.5 opacity-90">
                {m ? <MoonGlyph illumination={m.moonIllumination} waxing={m.moonWaxing} size={18} /> : <span className="block h-[18px] w-[18px]" />}
                {best && !compact && <LimitIcon size={15} className={limit ? "text-[#f2b8a4]" : "muted"} />}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function factorList(factors: Factor[], locale: "ar" | "en", names: Record<Factor, string>) {
  const words = factors.map((f) => (locale === "ar" ? names[f] : names[f].toLowerCase()));
  return new Intl.ListFormat(locale === "ar" ? "ar" : "en", { type: "conjunction" }).format(words);
}

/**
 * What the bars mean for this week, under the chart. Unscored nights are named with the factor
 * the forecast doesn't reach yet, so missing data is never mistaken for poor conditions.
 */
export function WeekLegend({ nights, mode, tap = false, className = "" }: { nights: NightPick[]; mode: Experience; tap?: boolean; className?: string }) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const incomplete = nights.filter((n) => !n.best);
  const missing = [...new Set(incomplete.flatMap((n) => n.missing))];
  const anyPoor = nights.some((n) => n.best && (n.best.score ?? 100) < 50);
  const days = new Intl.ListFormat(locale === "ar" ? "ar" : "en", { type: "conjunction" }).format(incomplete.map((n) => formatWeekday(n.night, locale)));
  return (
    <ul className={`week-legend small ${className}`} data-mode={mode}>
      <li><span className="week-legend-bar" aria-hidden />{t.weekBars[mode]}{tap ? ` ${t.weekTap}` : ""}</li>
      {anyPoor && <li><span className="week-legend-bar week-legend-bar--poor" aria-hidden />{t.weekPoor}</li>}
      {incomplete.length > 0 && (
        <li>
          <span className="week-legend-na" aria-hidden />
          <span>{missing.length ? t.weekMissing(days, factorList(missing, locale, dict.factor)) : t.weekIncomplete}</span>
        </li>
      )}
    </ul>
  );
}
