"use client";

import { DESTINATIONS, RIYADH, estimateDrive } from "@/lib/destinations";
import { approxHours } from "@/lib/i18n";
import { rating, type Rating } from "@/lib/score";
import { project, spread } from "./coverage-map";
import { useI18n } from "./locale-provider";
import { useRef } from "react";
import type { Experience } from "@/lib/types";

/** Map tones for a night surface: the same four ratings, lifted so they read on dark navy. */
const TONE: Record<Rating, string> = {
  excellent: "var(--map-good)",
  good: "var(--map-good)",
  fair: "var(--map-fair)",
  poor: "var(--map-poor)",
  unknown: "transparent",
};

const MARGIN = 46;
const points = DESTINATIONS.map((d) => ({ d, ...project(d) }));
// Real degree lines every half degree: they show the map is to scale without drawing roads.
const LON_X = Array.from({ length: 12 }, (_, i) => 43.5 + i * 0.5).map((lon) => project({ lat: RIYADH.lat, lon }).x);
const LAT_Y = Array.from({ length: 12 }, (_, i) => 22.5 + i * 0.5).map((lat) => project({ lat, lon: RIYADH.lon }).y);

/** A box around the given points and Riyadh; with `aspect`, widened or heightened to that w/h. */
function frame(pts: { x: number; y: number }[], margin: number, aspect?: number) {
  let minX = Math.min(0, ...pts.map((p) => p.x)) - margin;
  let maxX = Math.max(0, ...pts.map((p) => p.x)) + margin;
  let minY = Math.min(0, ...pts.map((p) => p.y)) - margin;
  let maxY = Math.max(0, ...pts.map((p) => p.y)) + margin;
  if (aspect) {
    const w = maxX - minX, h = maxY - minY;
    if (w / h < aspect) { const grow = (h * aspect - w) / 2; minX -= grow; maxX += grow; }
    else { const grow = (w / aspect - h) / 2; minY -= grow; maxY += grow; }
  }
  return { minX, maxX, minY, maxY };
}
const FULL = frame(points, MARGIN);

// Faint, fixed stars for the stargazing ground (deterministic, so server and client agree).
const SPECKS = (() => {
  let s = 4242;
  const r = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: 90 }, () => ({ x: FULL.minX + r() * (FULL.maxX - FULL.minX), y: FULL.minY + r() * (FULL.maxY - FULL.minY), r: 0.6 + r() * 1.1, o: 0.15 + r() * 0.35 }));
})();

/**
 * The Places map: real entry-point coordinates around Riyadh on the night surface, numbered like
 * the list beside it. Selecting a dot selects the same place in the list and the other way round.
 * No roads, routes or drive rings are drawn.
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
  fit = false,
  note,
  ranks,
}: {
  /** Slug → best score this week (null: no complete score). */
  scores?: Record<string, number | null>;
  /** Slugs in list order; only these carry numbers and respond to taps. */
  numbered: string[];
  selected: string | null;
  hovered: string | null;
  onSelect: (slug: string) => void;
  onHover: (slug: string | null) => void;
  /** Kashta warms the ground; stargazing fills it with faint stars. */
  mode?: Experience;
  className?: string;
  /** Accessible name for the marker group; defaults to the map title. */
  label?: string;
  /** Crop to the listed places and Riyadh (4:3), so the dots and labels stay large on phones. */
  fit?: boolean;
  /** A line under the key (for example the coverage note). */
  note?: string;
  /** Slug → the number shown in the list, when it isn't simply the position in `numbered`. */
  ranks?: Record<string, number>;
}) {
  const { locale, dict } = useI18n();
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
  const placed = spread(points, 40);
  const listed = placed.filter((p) => numbered.includes(p.d.slug));
  const box = fit && listed.length ? frame(listed.flatMap((p) => [{ x: p.dx, y: p.dy }, { x: p.x, y: p.y }]), 48, 4 / 3) : FULL;
  // Headroom above the top dot, so the selected place's name can sit above it, clear of Riyadh.
  const headroom = fit ? (box.maxY - box.minY) * 0.08 : 0;
  const { minX, maxX, maxY } = box;
  const minY = box.minY - headroom;
  // Text and dots keep their on-screen size whatever the crop: scale them with the box.
  const k = (maxX - minX) / (FULL.maxX - FULL.minX);
  const u = Math.max(0.55, Math.min(1, k));
  const numberOf = (slug: string) => (numbered.includes(slug) ? ranks?.[slug] ?? numbered.indexOf(slug) + 1 : 0);
  // Listed places draw on top of the rest, and the selected one on top of everything.
  const order = [...placed].sort((a, b) => {
    const rank = (slug: string) => (slug === selected ? 3 : slug === hovered ? 2 : numberOf(slug) ? 1 : 0);
    return rank(a.d.slug) - rank(b.d.slug);
  });
  const sel = placed.find((p) => p.d.slug === selected);
  const selName = sel?.d.name[locale];
  const labelW = selName ? Math.max(70, selName.length * (ar ? 8.6 : 7.6) + 22) * u : 0;
  // Above the dot unless it would leave the map or cover a neighbouring numbered dot.
  // Obstacles: the other numbered dots and Riyadh's label. The pill goes on the clearer side.
  const obstacles = [...listed.filter((p) => p.d.slug !== sel?.d.slug).map((p) => ({ x: p.dx, y: p.dy })), { x: 30 * u, y: 14 * u }];
  const crowded = (dir: -1 | 1) => (sel ? obstacles.filter((o) => Math.abs(o.x - sel.dx) < labelW / 2 + 16 * u && (o.y - sel.dy) * dir > 0 && Math.abs(o.y - sel.dy) < 60 * u).length : 0);
  const labelAbove = sel ? sel.dy - 54 * u > minY && (crowded(-1) <= crowded(1) || sel.dy + 54 * u > maxY) : true;

  return (
    <figure className={`places-map ${className}`} data-mode={mode}>
      <svg
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        style={{ direction: "ltr" }}
        role="group"
        aria-label={label ?? dict.map.title}
      >
        <defs>
          <radialGradient id="pm-glow" r="0.6">
            <stop offset="0" stopColor="var(--accent, var(--color-ember))" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--accent, var(--color-ember))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} className="pm-bg" />
        {mode === "stars" && (
          <g className="pm-specks" aria-hidden="true">
            {SPECKS.map((p, i) => <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={(p.r * u).toFixed(2)} opacity={p.o.toFixed(2)} />)}
          </g>
        )}
        <g className="pm-grid" aria-hidden="true" strokeWidth={u}>
          {LON_X.filter((x) => x > minX && x < maxX).map((x) => <line key={`x${x}`} x1={x} x2={x} y1={minY} y2={maxY} />)}
          {LAT_Y.filter((y) => y > minY && y < maxY).map((y) => <line key={`y${y}`} y1={y} y2={y} x1={minX} x2={maxX} />)}
        </g>
        <circle cx="0" cy="0" r={120 * Math.max(u, 0.8)} fill="url(#pm-glow)" aria-hidden="true" className="pm-glow" />

        {/* Scale: the map is drawn in km. */}
        <g transform={`translate(${minX + 22 * u} ${maxY - 24 * u})`} aria-hidden="true" className="pm-ink">
          <path d={`M0 -${6 * u} V0 H${fit ? 25 : 50} V-${6 * u}`} fill="none" stroke="currentColor" strokeWidth={2 * u} />
          <text x={fit ? 12.5 : 25} y={17 * u} textAnchor="middle" fontSize={12 * u} fill="currentColor">{fit ? (ar ? "25 كم" : "25 km") : ar ? "50 كم" : "50 km"}</text>
        </g>
        <g transform={`translate(${maxX - 24 * u} ${minY + 30 * u}) scale(${u})`} aria-hidden="true" className="pm-ink">
          <path d="M0 -15 L 6 5 L 0 2 L -6 5 Z" fill="currentColor" />
          <text y="20" textAnchor="middle" fontSize="12" fill="currentColor">{dict.map.north}</text>
        </g>

        <g aria-hidden="true" className="pm-ink" transform={`scale(${u})`}>
          <rect x="-6" y="-6" width="12" height="12" fill="currentColor" transform="rotate(45)" />
          <text direction={ar ? "rtl" : "ltr"} x="13" y="20" fontSize="14" fontWeight="600" fill="currentColor" className="pm-halo">{dict.map.riyadh}</text>
        </g>

        <g>
          {order.map(({ d, x: tx, y: ty, dx: x, dy: y }) => {
            const n = numberOf(d.slug);
            const unverified = d.permit.status === "unverified";
            const score = unverified ? null : scores?.[d.slug] ?? null;
            const rt = rating(score);
            const isSel = d.slug === selected;
            const isHover = d.slug === hovered;
            const moved = Math.abs(x - tx) > 1 || Math.abs(y - ty) > 1;
            if (!n) {
              // Not in the list right now (farther, or beyond the short list): a quiet true position.
              return (
                <g key={d.slug} className="pm-quiet" aria-hidden="true">
                  <title>{`${d.name[locale]} — ${approxHours(estimateDrive(d).hours, locale)}${unverified ? ` — ${dict.map.excluded}` : ""}`}</title>
                  <circle cx={tx} cy={ty} r={4.5 * u} strokeDasharray={unverified ? "2 2" : undefined} />
                </g>
              );
            }
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
                onFocus={() => onHover(d.slug)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(d.slug)}
                onMouseEnter={() => onHover(d.slug)}
                onMouseLeave={() => onHover(null)}
              >
                {moved && (
                  <>
                    <line x1={tx} y1={ty} x2={x} y2={y} className="pm-leader" strokeWidth={1.2 * u} />
                    <circle cx={tx} cy={ty} r={2.5 * u} className="pm-true" />
                  </>
                )}
                <g transform={`translate(${x} ${y}) scale(${u})`}>
                  {/* A wide invisible target so a fingertip hits the dot. */}
                  <circle r="29" fill="transparent" />
                  <circle r="23" className="pm-focus" />
                  {isSel && <circle r="22" className="pm-halo-ring" />}
                  <circle
                    r={isSel ? 16 : 13}
                    className={score === null ? "pm-dot pm-dot--none" : "pm-dot"}
                    style={score === null ? undefined : { fill: TONE[rt] }}
                  />
                  {rt === "poor" && <line x1={-8} y1={8} x2={8} y2={-8} className="pm-slash" />}
                  <text y={4.5} textAnchor="middle" fontSize={isSel ? 14 : 12.5} fontWeight="700" className={score === null ? "pm-num pm-num--none" : "pm-num"}>{n}</text>
                </g>
              </g>
            );
          })}
        </g>

        {/* The selected place carries its name, so the map reads without the list. */}
        {sel && selName && (
          <g aria-hidden="true" transform={`translate(${Math.min(maxX - labelW / 2 - 6 * u, Math.max(minX + labelW / 2 + 6 * u, sel.dx))} ${sel.dy + (labelAbove ? -40 : 40) * u}) scale(${u})`} className="pm-label">
            <rect x={-labelW / u / 2} y="-14" width={labelW / u} height="26" rx="13" />
            <text direction={ar ? "rtl" : "ltr"} textAnchor="middle" y="4.5" fontSize="13" fontWeight="600">{selName}</text>
          </g>
        )}
      </svg>
      <figcaption className="pm-key small">
        <span><i style={{ background: "var(--map-good)" }} />{dict.rating.excellent} / {dict.rating.good}</span>
        <span><i style={{ background: "var(--map-fair)" }} />{dict.rating.fair}</span>
        <span><i style={{ background: "var(--map-poor)" }} />{dict.rating.poor}</span>
        <span><i className="pm-key-none" />{ar ? "بدون تقييم" : "No score"}</span>
        <span className="pm-key-note">{note ? `${note} ` : ""}{ar ? "نقاط الدخول المنشورة، بدون طرق مرسومة." : "Published entry points; no roads drawn."}</span>
      </figcaption>
    </figure>
  );
}
