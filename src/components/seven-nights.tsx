"use client";

import { Check, Cloud, CloudFog, CloudRain, Moon, Thermometer, Wind } from "lucide-react";
import type { NightSummary, ScoreRow } from "@/lib/api-types";
import { getDestination } from "@/lib/destinations";
import { formatDayMonth, formatNight, formatWeekday } from "@/lib/i18n";
import { useI18n } from "./locale-provider";
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
  nights: { night: string; best: ScoreRow | undefined }[];
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
      {nights.map(({ night, best }, i) => {
        const m = metricsFor(night);
        const place = best ? getDestination(best.slug)?.name[locale] : undefined;
        const isBest = night === bestNight;
        const sep = locale === "ar" ? "، " : ", ";
        const limit = best ? limitingFactor(best) : null;
        const LimitIcon = limit ? FACTOR_ICON[limit] : Check;
        const limitText = limit
          ? (locale === "ar" ? `يحدّ منها: ${dict.factor[limit]}` : `Held back by: ${dict.factor[limit]}`)
          : (locale === "ar" ? "ما فيه شي يحد منها" : "Nothing holding it back");
        const parts = best && place
          ? [place, `${dict.common.score} ${best.score}`, limitText, ...(m ? [`${dict.detail.moon} ${dict.detail.moonLit(Math.round(m.moonIllumination * 100))}`] : []), ...(isBest ? [dict.home.sevenBest] : [])]
          : [dict.home.weekEmpty];
        const label = `${formatNight(night, locale)}: ${parts.join(sep)}`;
        return (
          <li key={night} className="min-w-0">
            <button
              type="button"
              className="seven-night w-full"
              data-best={isBest}
              aria-pressed={selected === night}
              aria-label={label}
              disabled={!best}
              onClick={() => onSelect(night)}
            >
              {isBest && <span className="seven-best-tag" aria-hidden>{dict.home.sevenBest}</span>}
              <span className="seven-day" aria-hidden>
                <span className="seven-weekday font-medium">{i === 0 ? dict.common.tonight : formatWeekday(night, locale)}</span>
                <span className="block muted num whitespace-nowrap sm:hidden">{Number(night.slice(8))}</span>
                <span className="hidden muted num whitespace-nowrap sm:block">{formatDayMonth(night, locale)}</span>
              </span>
              <span className="seven-bar-track" aria-hidden>
                {best && <span className="seven-bar" style={{ height: `${Math.max(6, best.score ?? 0)}%` }} />}
                {/* Guide at 80: the "excellent" threshold. */}
                <span className="absolute inset-x-0 h-px bg-white/35" style={{ bottom: "80%" }} />
              </span>
              {(!compact || !best) && <span className={best ? "seven-score" : "seven-day muted"} aria-hidden>{best?.score ?? (locale === "ar" ? "ناقصة" : "n/a")}</span>}
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
