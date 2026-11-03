"use client";

import type { ReactNode } from "react";
import type { NightSummary as NightFacts } from "@/lib/api-types";
import { ltr, arHoursOf } from "@/lib/i18n";
import type { Experience } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { MoonGlyph } from "./ui";

/** The selected night's measured facts, chosen for the activity. Nothing here is estimated by the app. */
export function NightSummary({ metrics, experience, className = "" }: { metrics: NightFacts | undefined; experience: Experience; className?: string }) {
  const { locale, dict } = useI18n();
  const ar = locale === "ar";
  const deg = (v: number | null) => (v === null ? "—" : ltr(`${Math.round(v)}°`));
  const pct = (v: number | null) => (v === null ? "—" : ltr(`${Math.round(v)}%`));
  const gust = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ${ar ? "كم/س" : "km/h"}`);
  const dust = (v: number | null) => (v === null ? "—" : `${Math.round(v)} ${ar ? "ميكروغرام/م³" : "µg/m³"}`);

  if (!metrics) return null;
  const m = metrics;

  const items: { label: string; value: ReactNode }[] =
    experience === "kashta"
      ? [
          { label: ar ? "أول الليل" : "Evening", value: deg(m.eveningTemp) },
          { label: ar ? "أبرد إحساس" : "Coldest feel", value: deg(m.minFeels) },
          { label: ar ? "أقوى هبة" : "Strongest gust", value: gust(m.maxGust) },
          { label: ar ? "احتمال المطر" : "Rain chance", value: pct(m.maxPrecipProb) },
          { label: ar ? "أعلى تركيز غبار" : "Dust peak", value: dust(m.maxDust) },
        ]
      : [
          {
            label: ar ? "الظلام التام" : "Full darkness",
            value: m.duskAstro && m.dawnAstro ? <bdi dir="ltr">{m.duskAstro} → {m.dawnAstro}</bdi> : "—",
          },
          {
            label: dict.detail.moon,
            value: (
              <span className="inline-flex items-center gap-2">
                <MoonGlyph illumination={m.moonIllumination} waxing={m.moonWaxing} size={18} />
                {dict.detail.moonLit(Math.round(m.moonIllumination * 100))}
              </span>
            ),
          },
          { label: ar ? "ظلام بلا قمر" : "Moonless dark", value: ar ? arHoursOf(m.moonFreeDarkHours, m.darkHours) : `${Math.round(m.moonFreeDarkHours)} of ${Math.round(m.darkHours)} h` },
          { label: ar ? "متوسط الغيم" : "Mean cloud", value: pct(m.meanCloud) },
          { label: ar ? "أعلى تركيز غبار" : "Dust peak", value: dust(m.maxDust) },
        ];

  return (
    <div className={className}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-5">
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <dt className="small muted">{it.label}</dt>
            <dd className="num mt-1 font-medium text-star">{it.value}</dd>
          </div>
        ))}
      </dl>
      <p className="small muted mt-4">
        {ar ? "الأوقات حساب فلكي، والباقي من توقعات Open-Meteo." : "Times are astronomical calculations; the rest is the Open-Meteo forecast."}
      </p>
    </div>
  );
}
