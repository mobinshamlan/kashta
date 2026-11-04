"use client";

import Link from "next/link";
import { Car, ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { estimateDrive, getDestination } from "@/lib/destinations";
import { approxHours, formatNight } from "@/lib/i18n";
import { nightReasons } from "@/lib/reasons";
import { rating } from "@/lib/score";
import type { CityId, Experience } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { PlacesMap } from "./places-map";
import { ReasonList } from "./recommendation-card";
import { RATING_COLOR } from "./ui";

const SHORT = 4;

/**
 * Step 3 on the homepage: the chosen night's places on the night map, ranked the same way as the
 * answer above (rankNight). The map and the list share one selected place; its essentials sit in
 * a compact panel on the map, with one action that carries it into the plan.
 */
export function HomePlaces({ mode, data, night, ranked, selected, onSelect, onPlan, carry = "", city = "riyadh" }: {
  city?: CityId;
  mode: Experience;
  data: PlanResponse;
  night: string;
  ranked: ScoreRow[];
  selected: string;
  onSelect: (slug: string) => void;
  onPlan: () => void;
  /** Plan settings (group, tuned preferences, step) carried to the place page and back. */
  carry?: string;
}) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const Forward = locale === "ar" ? ChevronLeft : ChevronRight;
  const [all, setAll] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  // The selected place always stays listed, even when it ranks below the short list.
  const selIndex = Math.max(0, ranked.findIndex((r) => r.slug === selected));
  const rows = all || selIndex < SHORT ? ranked.slice(0, all ? undefined : SHORT) : [...ranked.slice(0, SHORT - 1), ranked[selIndex]];
  const row = ranked[selIndex];
  const d = getDestination(row.slug)!;
  const PermitIcon = d.permit.status === "permit_required" || d.permit.status === "verified_permitted" ? ShieldCheck : ShieldAlert;

  const pickFromMap = (slug: string) => {
    onSelect(slug);
    if (ranked.findIndex((r) => r.slug === slug) >= SHORT) setAll(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Only scroll on phones, where the row sits below the map; keep keyboard focus on the map.
    if (window.matchMedia("(max-width: 1023px)").matches)
      requestAnimationFrame(() => document.getElementById("place-panel")?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }));
  };

  return (
    <div className="home-places">
      <h2 id="places-title" className="home-h2" tabIndex={-1} data-step-focus>{t.placesHeading}</h2>

      <div className="home-places-grid mt-5">
        <div className="home-places-map min-w-0">
          <PlacesMap
            key={`${mode}-${night}`}
            city={city}
            mode={mode}
            scores={Object.fromEntries(ranked.map((r) => [r.slug, r.score]))}
            numbered={rows.map((r) => r.slug)}
            ranks={Object.fromEntries(ranked.map((r, i) => [r.slug, i + 1]))}
            selected={row.slug}
            hovered={hovered}
            onSelect={pickFromMap}
            onHover={setHovered}
            label={t.placesHeading}
          />
        </div>

        <ol className="home-places-list grid gap-2" aria-label={t.placesBasis(formatNight(night, locale))}>
          {rows.map((r) => {
            const dd = getDestination(r.slug)!;
            const rr = rating(r.score);
            const isSel = r.slug === row.slug;
            return (
              <li key={r.slug} className="night-place" data-selected={isSel} data-hover={hovered === r.slug} onMouseEnter={() => setHovered(r.slug)} onMouseLeave={() => setHovered(null)}>
                <button type="button" className="night-place-pick" aria-expanded={isSel} aria-controls={isSel ? "place-panel" : undefined} onClick={() => onSelect(r.slug)}>
                  <span className="night-place-num num" aria-hidden data-rating={rr}>{ranked.indexOf(r) + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold" id={isSel ? "place-panel-name" : undefined}>{dd.name[locale]}</span>
                  </span>
                  <span className="rec-rating shrink-0" style={{ ["--rating" as string]: RATING_COLOR[rr] }}>{dict.rating[rr]}</span>
                </button>
                {/* The selected place: only what this decision needs, inline, with one action. */}
                {isSel && (
                  <div className="place-panel" id="place-panel">
                        <ReasonList className="small" reasons={nightReasons(row, data.metrics[`${row.slug}|${row.date}`], 1)} />
                        <p className="place-panel-facts small mt-2">
                          <span><Car aria-hidden size={15} /><bdi className="num">{approxHours(estimateDrive(d, city).hours, locale)}</bdi></span>
                          <span><PermitIcon aria-hidden size={15} />{dict.permit.short[d.permit.status]}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <button type="button" className="btn btn-accent" onClick={onPlan}>
                            {t.usePlace}
                            <Forward aria-hidden size={18} />
                          </button>
                          <Link href={`/destinations/${d.slug}?night=${row.date}&exp=${mode}${carry ? `&${carry}` : ""}`} className="rec-link small inline-flex min-h-11 items-center">{t.placeDetails}</Link>
                        </div>
                  </div>
                )}
              </li>
            );
          })}
          {ranked.length > SHORT && (
            <li>
              <button type="button" className="btn-ghost-night" aria-expanded={all} onClick={() => setAll((v) => !v)}>
                {all ? t.fewerPlaces : t.morePlaces(ranked.length)}
              </button>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
