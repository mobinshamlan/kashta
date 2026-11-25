"use client";

import { DESTINATIONS, ORIGINS, estimateDrive } from "@/lib/destinations";
import { approxHours } from "@/lib/i18n";
import { rating, type Rating } from "@/lib/score";
import { SAUDI_FRAME, SAUDI_PATH, SEAS, projectSA } from "@/lib/saudi-map";
import { useI18n } from "./locale-provider";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CityId, Experience } from "@/lib/types";

/** Map tones for a night surface: the same four ratings, lifted so they read on dark navy. */
const TONE: Record<Rating, string> = {
  excellent: "var(--map-good)",
  good: "var(--map-good)",
  fair: "var(--map-fair)",
  poor: "var(--map-poor)",
  unknown: "transparent",
};

/**
 * Pushes dots apart so none overlap; each keeps a leader line to its true position,
 * so the map never misplaces a place, it only makes crowded ones readable.
 */
function spread<T extends { x: number; y: number }>(points: T[], min: number, fixed: { x: number; y: number }[] = []) {
  const out = points.map((p) => ({ ...p, dx: p.x, dy: p.y }));
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    // Fixed marks (the start city and its name) never move; dots step off them.
    for (const a of out) {
      for (const f of fixed) {
        let vx = a.dx - f.x, vy = a.dy - f.y;
        let dist = Math.hypot(vx, vy);
        if (dist >= min) continue;
        if (dist < 0.01) { vx = 0; vy = -1; dist = 1; }
        a.dx += (vx / dist) * (min - dist); a.dy += (vy / dist) * (min - dist);
        moved = true;
      }
    }
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

const F = SAUDI_FRAME;
const POINTS = DESTINATIONS.map((d) => ({ d, ...projectSA(d) }));
/** Width the map is drawn for before it has been measured (server render, first paint). */
const ASSUMED_PX = 640;
const SCALE_KM = 200;

// Faint, fixed stars in the sky around the country (deterministic, so server and client agree).
const SPECKS = (() => {
  let s = 4242;
  const r = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: 140 }, () => ({ x: F.minX + r() * F.width, y: F.minY + r() * F.height, r: 0.5 + r() * 1.1, o: 0.2 + r() * 0.45 }));
})();

/** Rendered width of the map in CSS pixels, so dots and text keep one on-screen size on every screen. */
function useRenderedWidth() {
  const ref = useRef<SVGSVGElement>(null);
  const [px, setPx] = useState(ASSUMED_PX);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A height cap letterboxes the drawing inside the svg box, so the drawn width is the smaller fit.
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setPx(Math.min(width, (height * SAUDI_FRAME.width) / SAUDI_FRAME.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, px] as const;
}

/**
 * The Places map: all of Saudi Arabia on the night surface, every verified site as a small light,
 * and the listed places numbered like the list beside it. Selecting a dot selects the same place in
 * the list and the other way round. Positions are real entry points; no roads or routes are drawn.
 */
export function PlacesMap({
  scores,
  numbered,
  selected,
  hovered,
  onSelect,
  onHover,
  mode,
  className = "",
  label,
  note,
  ranks,
  city = "riyadh",
}: {
  /** The starting city: marked on the map; drive times are measured from it. */
  city?: CityId;
  /** Slug → best score this week (null: no complete score). */
  scores?: Record<string, number | null>;
  /** Slugs in list order; only these carry numbers and respond to taps. */
  numbered: string[];
  selected: string | null;
  hovered: string | null;
  onSelect: (slug: string) => void;
  onHover: (slug: string | null) => void;
  /** Kashta warms the start city's glow; stargazing fills the sky with faint stars. */
  mode?: Experience;
  className?: string;
  /** Accessible name for the marker group; defaults to the map title. */
  label?: string;
  /** Kept for callers that used to crop the map; the whole country is always shown now. */
  fit?: boolean;
  /** A line under the key (for example the coverage note). */
  note?: string;
  /** Slug → the number shown in the list, when it isn't simply the position in `numbered`. */
  ranks?: Record<string, number>;
}) {
  const { locale, dict } = useI18n();
  const [svgRef, px] = useRenderedWidth();
  // Map km per screen pixel: everything sized "in pixels" is multiplied by this.
  const k = F.width / px;
  const origin = useMemo(() => projectSA(ORIGINS[city]), [city]);
  const listedKey = numbered.join(",");
  // Numbered dots are pushed apart (in screen pixels) where they crowd; leader lines keep their true spots.
  const placed = useMemo(
    () => spread(
      POINTS.filter((p) => listedKey.split(",").includes(p.d.slug)),
      24 * k,
      [origin, { x: origin.x - 14 * k, y: origin.y + 20 * k }, { x: origin.x + 14 * k, y: origin.y + 20 * k }],
    ),
    [listedKey, k, origin],
  );
  const pinRefs = useRef(new Map<string, SVGGElement>());
  // Roving focus: one tab stop (the selected place); arrows move along the list order.
  const onPinKey = (e: React.KeyboardEvent, slug: string) => {
    const i = numbered.indexOf(slug);
    let next: string | undefined;
    // "Forward" follows the reading direction: left in Arabic, right in English.
    const fwd = locale === "ar" ? "ArrowLeft" : "ArrowRight";
    const back = locale === "ar" ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd || e.key === "ArrowDown") next = numbered[(i + 1) % numbered.length];
    else if (e.key === back || e.key === "ArrowUp") next = numbered[(i - 1 + numbered.length) % numbered.length];
    else if (e.key === "Home") next = numbered[0];
    else if (e.key === "End") next = numbered[numbered.length - 1];
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(slug);
      return;
    }
    if (!next) return;
    e.preventDefault();
    onSelect(next);
    requestAnimationFrame(() => pinRefs.current.get(next!)?.focus());
  };
  const ar = locale === "ar";
  const numberOf = (slug: string) => (numbered.includes(slug) ? ranks?.[slug] ?? numbered.indexOf(slug) + 1 : 0);
  // The selected one draws on top of everything, the hovered one next.
  const order = [...placed].sort((a, b) => {
    const rank = (slug: string) => (slug === selected ? 2 : slug === hovered ? 1 : 0);
    return rank(a.d.slug) - rank(b.d.slug);
  });
  const sel = placed.find((p) => p.d.slug === selected);
  const selName = sel?.d.name[locale];
  const labelW = selName ? Math.max(70, selName.length * (ar ? 7.8 : 7) + 22) : 0;
  // The name pill goes above or below the dot, near or a step farther, centred or slid to one side:
  // whichever spot covers fewest numbered dots and the start city, preferring near, above and centred.
  const pill = (() => {
    if (!sel) return { x: 0, y: 0 };
    const clampX = (x: number) => Math.min(F.minX + F.width - (labelW / 2 + 6) * k, Math.max(F.minX + (labelW / 2 + 6) * k, x));
    const slide = (labelW / 2 - 14) * k;
    let best = { x: 0, y: 0, hits: Infinity };
    for (const gap of [28, 54]) for (const dir of [-1, 1]) {
      for (const dx of [0, -slide, slide]) {
        const x = clampX(sel.dx + dx), y = sel.dy + dir * gap * k;
        const off = y - 12 * k < F.minY || y + 12 * k > F.minY + F.height;
        const near = (px: number, py: number, rx: number, ry: number) => Math.abs(px - x) < (labelW / 2 + rx) * k && Math.abs(py - y) < (12 + ry) * k;
        const hits = off ? 99 : placed.filter((p) => p !== sel && near(p.dx, p.dy, 10, 10)).length * 2 + (near(origin.x, origin.y + 18 * k, 30, 10) || near(origin.x, origin.y, 6, 6) ? 2 : 0) + (dx ? 0.5 : 0) + (dir > 0 ? 0.25 : 0) + (gap > 28 ? 0.75 : 0);
        if (hits < best.hits) best = { x, y, hits };
      }
    }
    return best;
  })();
  const cityName = dict.common.cities[city];

  return (
    <figure className={`places-map ${className}`} data-mode={mode}>
      <svg
        ref={svgRef}
        viewBox={`${F.minX} ${F.minY} ${F.width} ${F.height}`}
        style={{ direction: "ltr" }}
        role="group"
        aria-label={label ?? dict.map.title}
      >
        <defs>
          <radialGradient id="pm-glow" r="0.5">
            <stop offset="0" stopColor="var(--accent, var(--color-ember))" stopOpacity="0.38" />
            <stop offset="1" stopColor="var(--accent, var(--color-ember))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pm-land" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" className="pm-land-top" />
            <stop offset="1" className="pm-land-bottom" />
          </linearGradient>
        </defs>
        <rect x={F.minX} y={F.minY} width={F.width} height={F.height} className="pm-bg" />
        {mode === "stars" && (
          <g className="pm-specks" aria-hidden="true">
            {SPECKS.map((p, i) => <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={(p.r * k).toFixed(2)} opacity={p.o.toFixed(2)} />)}
          </g>
        )}

        {/* The country: the shape is the orientation, so no grid is drawn. */}
        <path d={SAUDI_PATH} className="pm-land" fill="url(#pm-land)" aria-hidden="true" />
        {/* On phones the country is small; the seas would crowd the coast. */}
        {px >= 480 && <g aria-hidden="true" className="pm-sea">
          {SEAS.map((s) => (
            <text key={s.name.en} transform={`translate(${s.at.x} ${s.at.y}) rotate(${s.rotate}) scale(${k})`} direction={ar ? "rtl" : "ltr"} textAnchor="middle" fontSize="11" letterSpacing={ar ? 0 : 1.5}>
              {s.name[locale]}
            </text>
          ))}
        </g>}

        {/* Every verified site, as a small light: the reach of the data across the country. */}
        <g aria-hidden="true" className="pm-quiet">
          {POINTS.filter((p) => !numbered.includes(p.d.slug)).map(({ d, x, y }) => (
            <circle key={d.slug} cx={x} cy={y} r={2.4 * k} className={d.permit.status === "unverified" ? "pm-quiet--unverified" : undefined}>
              <title>{`${d.name[locale]} — ${approxHours(estimateDrive(d, city).hours, locale)}${d.permit.status === "unverified" ? ` — ${dict.map.excluded}` : ""}`}</title>
            </circle>
          ))}
        </g>

        {/* The chosen start city: the warm glow every drive time is measured from. */}
        <g aria-hidden="true">
          <circle cx={origin.x} cy={origin.y} r={150} fill="url(#pm-glow)" className="pm-glow" />
          <g transform={`translate(${origin.x} ${origin.y}) scale(${k})`} className="pm-ink">
            <rect x="-5" y="-5" width="10" height="10" fill="currentColor" transform="rotate(45)" />
            <text direction={ar ? "rtl" : "ltr"} x="0" y="22" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="pm-halo">{cityName}</text>
          </g>
        </g>

        {/* Scale: the map is drawn in km. */}
        <g transform={`translate(${F.minX + 22 * k} ${F.minY + F.height - 26 * k})`} aria-hidden="true" className="pm-ink">
          <path d={`M0 ${-5 * k} V0 H${SCALE_KM} V${-5 * k}`} fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text transform={`translate(${SCALE_KM / 2} ${15 * k}) scale(${k})`} textAnchor="middle" fontSize="11" fill="currentColor">{ar ? `${SCALE_KM} كم` : `${SCALE_KM} km`}</text>
        </g>

        <g>
          {order.map(({ d, x: tx, y: ty, dx: x, dy: y }) => {
            const n = numberOf(d.slug);
            const unverified = d.permit.status === "unverified";
            const score = unverified ? null : scores?.[d.slug] ?? null;
            const rt = rating(score);
            const isSel = d.slug === selected;
            const isHover = d.slug === hovered;
            const moved = Math.abs(x - tx) > k || Math.abs(y - ty) > k;
            return (
              <g
                key={d.slug}
                ref={(el) => { if (el) pinRefs.current.set(d.slug, el); else pinRefs.current.delete(d.slug); }}
                className="pm-pin"
                data-selected={isSel}
                data-hover={isHover}
                role="button"
                tabIndex={isSel || (!selected && n === 1) ? 0 : -1}
                aria-pressed={isSel}
                aria-label={`${n}. ${d.name[locale]} — ${score === null ? dict.rating.unknown : dict.rating[rt]}`}
                onKeyDown={(e) => onPinKey(e, d.slug)}
                onFocus={(e) => { onHover(d.slug); e.currentTarget.scrollIntoView({ block: "center", inline: "nearest" }); }}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(d.slug)}
                onMouseEnter={() => onHover(d.slug)}
                onMouseLeave={() => onHover(null)}
              >
                {moved && (
                  <>
                    <line x1={tx} y1={ty} x2={x} y2={y} className="pm-leader" />
                    <circle cx={tx} cy={ty} r={2 * k} className="pm-true" />
                  </>
                )}
                <g transform={`translate(${x} ${y}) scale(${k})`}>
                  {/* A wide invisible target so a fingertip hits the dot. */}
                  <circle r="18" fill="transparent" />
                  <circle r="15" className="pm-focus" />
                  {isSel && <circle r="15" className="pm-halo-ring" />}
                  <circle
                    r={isSel ? 12 : 10}
                    className={score === null ? "pm-dot pm-dot--none" : "pm-dot"}
                    style={score === null ? undefined : { fill: TONE[rt] }}
                  />
                  {rt === "poor" && <line x1={-6} y1={6} x2={6} y2={-6} className="pm-slash" />}
                  <text y={isSel ? 4 : 3.6} textAnchor="middle" fontSize={isSel ? 12 : 10.5} fontWeight="700" className={score === null ? "pm-num pm-num--none" : "pm-num"}>{n}</text>
                </g>
              </g>
            );
          })}
        </g>

        {/* The selected place carries its name, so the map reads without the list. */}
        {sel && selName && (
          <g aria-hidden="true" transform={`translate(${pill.x} ${pill.y}) scale(${k})`} className="pm-label">
            <rect x={-labelW / 2} y="-12" width={labelW} height="23" rx="11.5" />
            <text direction={ar ? "rtl" : "ltr"} textAnchor="middle" y="4" fontSize="12" fontWeight="600">{selName}</text>
          </g>
        )}
      </svg>
      <figcaption className="pm-key small">
        <span><i style={{ background: "var(--map-good)" }} />{dict.rating.excellent} / {dict.rating.good}</span>
        <span><i style={{ background: "var(--map-fair)" }} />{dict.rating.fair}</span>
        <span><i style={{ background: "var(--map-poor)" }} />{dict.rating.poor}</span>
        <span><i className="pm-key-none" />{ar ? "بدون تقييم" : "No score"}</span>
        <span><i className="pm-key-site" />{ar ? "مواقع أخرى" : "Other sites"}</span>
        <details className="pm-key-details">
          <summary>{dict.map.details}</summary>
          <p>{note ?? dict.map.note}</p>
        </details>
      </figcaption>
    </figure>
  );
}
