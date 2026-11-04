"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ORIGINS, RECOMMENDABLE, estimateDrive } from "@/lib/destinations";
import { SAUDI_FRAME as F, SAUDI_PATH, projectSA } from "@/lib/saudi-map";
import { CITY_IDS, type CityId, type Experience } from "@/lib/types";
import { useI18n } from "./locale-provider";

const SITES = RECOMMENDABLE.map((d) => ({ d, ...projectSA(d) }));
const CITY_AT = Object.fromEntries(CITY_IDS.map((c) => [c, projectSA(ORIGINS[c])])) as Record<CityId, { x: number; y: number }>;
/** The panel map is drawn about this many pixels wide; dots and the label are sized for it. */
const K = F.width / 270;

/**
 * Where the trip starts. A pill that pairs with the activity switch; it opens a small night map of
 * the kingdom and the cities, each with how many verified sites lie within the current drive limit.
 * Pointing at a city previews its reach on the map before choosing it.
 */
export function CityPicker({
  value,
  onChange,
  experience,
  maxDriveHours,
  tone = "night",
  className = "",
}: {
  value: CityId;
  onChange: (next: CityId) => void;
  experience: Experience;
  maxDriveHours: number;
  tone?: "night" | "sand";
  className?: string;
}) {
  const { dict, locale } = useI18n();
  const t = dict.plan;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CityId | null>(null);

  // The same reach rule as the planner: the app's drive estimate against the drive limit.
  const inReach = (c: CityId) => RECOMMENDABLE.filter((d) => d.experiences.includes(experience) && estimateDrive(d, c).hours <= maxDriveHours);
  const shown = preview ?? value;
  const reachSlugs = new Set(inReach(shown).map((d) => d.slug));
  // estimateDrive: straight line x 1.3 at 90 km/h, so this circle is exactly the drive limit's reach.
  const radiusKm = (maxDriveHours * 90) / 1.3;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    // Start at the current city, so Enter keeps it and Tab walks the others.
    root.current?.querySelector<HTMLButtonElement>(".city-option[aria-pressed='true']")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (c: CityId) => {
    setOpen(false);
    setPreview(null);
    trigger.current?.focus();
    if (c !== value) onChange(c);
  };

  return (
    <div ref={root} className={`city-picker ${tone === "sand" ? "on-sand" : ""} ${className}`}>
      <span id={`${id}-legend`} className="small mb-3 block font-medium">{t.cityLegend}</span>
      <button
        ref={trigger}
        type="button"
        className="city-trigger"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-labelledby={`${id}-legend ${id}-value`}
        onClick={() => setOpen((o) => !o)}
      >
        <MapPin aria-hidden size={18} />
        <span id={`${id}-value`} className="city-trigger-name">{dict.common.cities[value]}</span>
        <span className="city-trigger-meta">{t.cityReach(inReach(value).length, maxDriveHours)}</span>
        <ChevronDown aria-hidden size={16} className="city-trigger-chev" />
      </button>

      {open && (
        <div id={`${id}-panel`} className="city-panel" role="group" aria-labelledby={`${id}-legend`}>
          <p className="city-panel-note">{t.cityReachNote(maxDriveHours)}</p>
          {/* The map is the picture of the choice; the buttons beside it are the keyboard and screen-reader path. */}
          <svg className="city-map" viewBox={`${F.minX} ${F.minY} ${F.width} ${F.height}`} style={{ direction: "ltr" }} aria-hidden="true">
            <path d={SAUDI_PATH} className="cm-land" />
            <circle cx={CITY_AT[shown].x} cy={CITY_AT[shown].y} r={radiusKm} className="cm-reach" />
            {SITES.map(({ d, x, y }) => (
              <circle key={d.slug} cx={x} cy={y} r={(reachSlugs.has(d.slug) ? 2.6 : 1.8) * K} className={reachSlugs.has(d.slug) ? "cm-site cm-site--in" : "cm-site"} />
            ))}
            {CITY_IDS.map((c) => {
              const on = c === shown;
              const s = (on ? 5 : 3.5) * K;
              return (
                <g key={c} className="cm-city-hit" onClick={() => choose(c)} onPointerEnter={() => setPreview(c)} onPointerLeave={() => setPreview(null)}>
                  <circle cx={CITY_AT[c].x} cy={CITY_AT[c].y} r={13 * K} fill="transparent" />
                  <rect x={CITY_AT[c].x - s} y={CITY_AT[c].y - s} width={s * 2} height={s * 2} transform={`rotate(45 ${CITY_AT[c].x} ${CITY_AT[c].y})`} className={on ? "cm-city cm-city--on" : "cm-city"} />
                </g>
              );
            })}
            <text
              x={CITY_AT[shown].x}
              y={CITY_AT[shown].y - 11 * K}
              textAnchor="middle"
              direction={locale === "ar" ? "rtl" : "ltr"}
              fontSize={12 * K}
              fontWeight="700"
              className="cm-label"
            >
              {dict.common.cities[shown]}
            </text>
          </svg>
          <ul className="city-options">
            {CITY_IDS.map((c) => {
              const n = inReach(c).length;
              return (
                <li key={c}>
                  <button
                    type="button"
                    className="city-option"
                    aria-pressed={c === value}
                    aria-label={`${dict.common.cities[c]}، ${t.cityReach(n, maxDriveHours)}`}
                    onClick={() => choose(c)}
                    onPointerEnter={() => setPreview(c)}
                    onPointerLeave={() => setPreview(null)}
                    onFocus={() => setPreview(c)}
                    onBlur={() => setPreview(null)}
                  >
                    <span className="city-option-name">{dict.common.cities[c]}</span>
                    <span className="city-count num" data-none={n === 0 || undefined}>{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
