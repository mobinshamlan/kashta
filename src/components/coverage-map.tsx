"use client";

import Link from "next/link";
import { DESTINATIONS, RIYADH, estimateDrive } from "@/lib/destinations";
import { approxHours } from "@/lib/i18n";
import { rating } from "@/lib/score";
import type { Experience } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { RATING_COLOR } from "./ui";

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LON = Math.cos((24.7 * Math.PI) / 180) * 111.32;
/** Length of the scale bar, in km (the map's units are km, so this is also its drawn length). */
const SCALE_KM = 50;

/**
 * Pushes scored dots apart so none overlap; each keeps a leader line to its true position,
 * so the map never misplaces a place, it only makes crowded ones readable.
 */
export function spread<T extends { x: number; y: number }>(points: T[], min: number) {
  const out = points.map((p) => ({ ...p, dx: p.x, dy: p.y }));
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        let vx = b.dx - a.dx, vy = b.dy - a.dy;
        let dist = Math.hypot(vx, vy);
        if (dist >= min) continue;
        if (dist < 0.01) { vx = 1; vy = 0; dist = 1; }
        const push = (min - dist) / 2;
        a.dx -= (vx / dist) * push; a.dy -= (vy / dist) * push;
        b.dx += (vx / dist) * push; b.dy += (vy / dist) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

export function project(p: { lat: number; lon: number }) {
  return { x: (p.lon - RIYADH.lon) * KM_PER_DEG_LON, y: -(p.lat - RIYADH.lat) * KM_PER_DEG_LAT };
}

// Fit the view to the real places (plus a margin for dots and labels), centred on Riyadh.
const EXTENT = Math.ceil(Math.max(...DESTINATIONS.map((d) => { const q = project(d); return Math.max(Math.abs(q.x), Math.abs(q.y)); })) + 45);

/** Real entry-point coordinates around Riyadh, north up, with a km scale. No roads or drive rings are drawn. */
export function CoverageMap({
  className = "",
  compact = false,
  legend = true,
  scores,
  pick,
  mode,
  legendText,
  numbered,
}: {
  className?: string;
  compact?: boolean;
  /** Overrides the score legend line when the scores mean something other than the selected night. */
  legendText?: string;
  /** False hides the numbered place list (the note stays). */
  legend?: boolean;
  /** Slug → score for the selected night; colours each dot by its rating. */
  scores?: Record<string, number | null>;
  /** Slug of the recommended place, ringed on the map. */
  pick?: string;
  mode?: Experience;
  /** Slugs in list order: each dot shows its number, matching the numbered cards beside the map. */
  numbered?: string[];
}) {
  const { locale, dict } = useI18n();
  const scored = scores !== undefined;
  const places = spread(
    [...DESTINATIONS].map((d) => ({ d, hours: estimateDrive(d).hours, ...project(d) })).sort((a, b) => a.hours - b.hours),
    scored ? 28 : 0,
  );
  const textDir = locale === "ar" ? "rtl" : "ltr";
  const href = (slug: string) => `/destinations/${slug}${mode ? `?exp=${mode}` : ""}`;
  // Higher scores and the pick are drawn last so they sit on top where dots overlap.
  const drawOrder = scored
    ? [...places].sort((a, b) => (a.d.slug === pick ? 1 : b.d.slug === pick ? -1 : (scores[a.d.slug] ?? -1) - (scores[b.d.slug] ?? -1)))
    : places;
  const showList = legend && !compact;
  // Names for the pick and the next three scored places, so the map reads on its own.
  const labelled = new Set<string>(
    scored
      ? [...places].filter((p) => scores[p.d.slug] != null && p.d.permit.status !== "unverified").sort((a, b) => (scores[b.d.slug] ?? -1) - (scores[a.d.slug] ?? -1)).slice(0, 4).map((p) => p.d.slug)
      : [],
  );
  if (pick && !numbered) labelled.add(pick);
  // With numbers, the list beside the map carries the names; the dots carry the numbers.
  if (numbered) labelled.clear();
  const numberOf = (slug: string) => (numbered ? numbered.indexOf(slug) + 1 : 0);
  // When two labelled dots sit within a label's height, the later one goes above its dot.
  const labelBelow = (slug: string) => {
    const me = places.find((p) => p.d.slug === slug);
    if (!me) return true;
    return !places.some((o) => o.d.slug !== slug && labelled.has(o.d.slug) && o.d.slug < slug && Math.abs(o.dx - me.dx) < 90 && Math.abs(o.dy - me.dy) < 34);
  };

  return (
    <figure className={`grid ${showList ? "gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start" : "gap-3"} ${className}`}>
      {scored && !showList && (
        <div className="map-key small" aria-label={legendText ?? dict.map.legendScore}>
          <span className="map-key-title">{legendText ?? dict.map.legendScore}</span>
          {([["excellent", `${dict.rating.excellent} / ${dict.rating.good}`], ["fair", dict.rating.fair]] as const).map(([r, word]) => (
            <span key={r} className="map-key-item"><span aria-hidden className="map-key-dot" style={{ background: RATING_COLOR[r] }} />{word}</span>
          ))}
          <span className="map-key-item"><span aria-hidden className="map-key-dot map-key-dot--poor" />{dict.rating.poor}</span>
          <span className="map-key-item"><span aria-hidden className="map-key-dot map-key-dot--none" />{dict.map.noScore}</span>
          <span className="map-key-item"><span aria-hidden className="map-key-dot map-key-dot--excluded" />{dict.map.excluded}</span>
        </div>
      )}
      <svg
        className="coverage-map rounded-[14px] bg-sand-2"
        viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`}
        style={{ direction: "ltr" }}
        role="group"
        aria-label={dict.map.title}
      >
        {/* Scale bar: the map is drawn in km, so 50 units = 50 km. */}
        <g transform={`translate(${-EXTENT + 24} ${EXTENT - 30})`} aria-hidden="true">
          <path d={`M0 -6 V0 H${SCALE_KM} V-6`} fill="none" stroke="var(--color-ink)" strokeWidth="2" />
          <text x={SCALE_KM / 2} y="18" textAnchor="middle" fontSize="13" fill="var(--color-ink)">{locale === "ar" ? `${SCALE_KM} كم` : `${SCALE_KM} km`}</text>
        </g>

        {/* North indicator. */}
        <g transform={`translate(${EXTENT - 30} ${-EXTENT + 34})`} aria-hidden="true">
          <path d="M0 -16 L 7 6 L 0 2 L -7 6 Z" fill="var(--color-ink)" />
          <text y="22" textAnchor="middle" fontSize="13" fill="var(--color-ink)">{dict.map.north}</text>
        </g>

        {/* Riyadh: the only starting point. */}
        <g aria-hidden="true">
          <rect x="-8" y="-8" width="16" height="16" fill="var(--color-ink)" stroke="var(--color-sand)" strokeWidth="2" transform="rotate(45)" />
          <text direction={locale === "ar" ? "rtl" : "ltr"} className="map-label" x="14" y="22" fontSize="15" fontWeight="700" fill="var(--color-ink)">{dict.map.riyadh}</text>
        </g>

        {drawOrder.map(({ d, hours, x: tx, y: ty, dx: x, dy: y }) => {
          const i = places.findIndex((p) => p.d.slug === d.slug);
          const unverified = d.permit.status === "unverified";
          if (!scored) {
            return (
              <a key={d.slug} href={href(d.slug)}>
                <title>{`${d.name[locale]} — ${approxHours(hours, locale)}${unverified ? ` (${dict.map.unverified})` : ""}`}</title>
                <circle className={unverified ? "site-unverified" : "site"} cx={x} cy={y} r="10" />
                <text className="site-num" x={x} y={y + 3.5} textAnchor="middle">{i + 1}</text>
              </a>
            );
          }
          const score = unverified ? null : scores[d.slug] ?? null;
          const isPick = d.slug === pick;
          const status = unverified ? dict.map.excluded : score === null ? dict.map.noScore : dict.rating[rating(score)];
          return (
            // Scored maps sit beside a list of the same places, so their dots stay out of the tab order.
            <a key={d.slug} href={href(d.slug)} tabIndex={-1}>
              {(Math.abs(x - tx) > 1 || Math.abs(y - ty) > 1) && (
                <g aria-hidden="true">
                  <line x1={tx} y1={ty} x2={x} y2={y} stroke="var(--color-ink-2)" strokeWidth="1.2" />
                  <circle cx={tx} cy={ty} r="2.5" fill="var(--color-ink)" />
                </g>
              )}
              <title>{`${d.name[locale]} — ${approxHours(hours, locale)} — ${status}${isPick ? ` — ${dict.map.pick}` : ""}`}</title>
              {isPick && (
                <>
                  <circle cx={x} cy={y} r="20" fill="none" stroke="var(--accent, var(--color-ember))" strokeWidth="5" />
                  <circle cx={x} cy={y} r="16" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
                  <text direction={textDir} x={x} y={y - 26} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--color-ink)">
                    {dict.map.pick}
                  </text>
                </>
              )}
              {/* The best few carry their names; the rest stay dots so clusters don't pile labels. */}
              {score !== null && labelled.has(d.slug) && (
                <text direction={textDir} className="map-label" x={x} y={labelBelow(d.slug) ? y + 26 : y - 18} textAnchor="middle" fontSize="12" fill="var(--color-ink)">
                  {d.name[locale]}
                </text>
              )}
              {score === null ? (
                <circle
                  cx={x}
                  cy={y}
                  r={numberOf(d.slug) ? 13 : 11}
                  fill="var(--color-sand)"
                  stroke="var(--color-ink-2)"
                  strokeWidth="2"
                  strokeDasharray={unverified ? "4 3" : undefined}
                />
              ) : (
                <circle cx={x} cy={y} r={numberOf(d.slug) ? 14 : 12} fill={rating(score) === "poor" ? "var(--color-ink-2)" : RATING_COLOR[rating(score)]} stroke="var(--color-sand)" strokeWidth="2.5" />
              )}
              {score !== null && rating(score) === "poor" && (
                <line x1={x - 9} y1={y + 9} x2={x + 9} y2={y - 9} stroke="var(--color-sand)" strokeWidth="2.5" opacity="0.9" />
              )}
              {numberOf(d.slug) > 0 && (
                <text x={x} y={y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill={score === null ? "var(--color-ink)" : "#fff"} style={{ pointerEvents: "none" }}>
                  {numberOf(d.slug)}
                </text>
              )}
            </a>
          );
        })}
      </svg>

      {showList && (
        <figcaption className="min-w-0">
          <ol className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-1">
            {places.map(({ d, hours }, i) => {
              const unverified = d.permit.status === "unverified";
              return (
                <li key={d.slug}>
                  <Link href={href(d.slug)} className="group grid min-h-11 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 py-1 transition-colors hover:text-clay">
                    <span
                      aria-hidden
                      className={`small num grid size-6 place-items-center rounded-full ${unverified ? "border-2 border-ink-2 text-ink" : "bg-clay text-sand"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block">{d.name[locale]}</span>
                      {unverified && <span className="small block text-ink-2">{dict.map.unverified}</span>}
                    </span>
                    <span className="small num shrink-0 text-ink-2">{approxHours(hours, locale)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="small mt-4 max-w-[52ch] text-ink-2">{locale === "ar" ? "النقاط من إحداثيات نقاط الدخول المنشورة، وما فيه طرق مرسومة." : "Dots are published entry points; no roads are drawn."}</p>
        </figcaption>
      )}
      {!showList && (
        <figcaption className="small max-w-[52ch] text-ink-2">
          <span className="block">{locale === "ar" ? "النقاط من إحداثيات نقاط الدخول المنشورة، وما فيه طرق مرسومة." : "Dots are published entry points; no roads are drawn."}</span>
        </figcaption>
      )}
    </figure>
  );
}
