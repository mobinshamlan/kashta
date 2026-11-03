"use client";

import { useMemo, type CSSProperties } from "react";
import { axisPos, darkWindow, FIRE_GUST_MAX, fireWindows } from "@/lib/night-window";
import type { Experience, HourPoint } from "@/lib/types";
import { useI18n } from "./locale-provider";

// 05:00 is the axis end; its label would collide with 03:00 on phones.
const TICKS = ["18:00", "21:00", "00:00", "03:00"];
const FIRE = "var(--color-ember)";
const DARK = "var(--color-starlight)";
const MOON = "repeating-linear-gradient(135deg, rgb(255 255 255 / 75%) 0 2px, rgb(255 255 255 / 15%) 2px 5px)";

function arCount(n: number) {
  if (n === 1) return "ساعة وحدة";
  if (n === 2) return "ساعتين";
  if (n <= 10) return `${n} ساعات`;
  return `${n} ساعة`;
}

/** A span on the shared 18:00→05:00 axis, positioned in reading direction. */
function span(start: string, end: string): CSSProperties {
  const a = axisPos(start);
  const b = axisPos(end);
  return { position: "absolute", insetBlock: 0, insetInlineStart: `${a * 100}%`, width: `${Math.max(0, b - a) * 100}%` };
}

/** Fire-friendly hours against the dark stargazing window for one night. The mode's row leads. */
export function NightWindow({
  date,
  lat,
  lon,
  hours,
  mode,
  className = "",
}: {
  date: string;
  lat: number;
  lon: number;
  hours: HourPoint[];
  mode: Experience;
  className?: string;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const fire = useMemo(() => fireWindows(hours), [hours]);
  const dark = useMemo(() => darkWindow(date, lat, lon), [date, lat, lon]);

  const range = (s: string, e: string) => `${s}–${e}`;
  const fireText =
    fire.knownHours === 0
      ? ar ? "ما توفرت قراءات الرياح لهالليلة" : "No hourly wind readings for this night"
      : ar
        ? `${arCount(fire.okHours)} مناسبة للنار`
        : `${fire.okHours} ${fire.okHours === 1 ? "hour" : "hours"} good for a fire`;
  const fireFirst = fire.windows[0];
  const fireRule = ar ? `هبات أقل من ${FIRE_GUST_MAX} كم/س وبدون مطر متوقع` : `gusts under ${FIRE_GUST_MAX} km/h, no rain expected`;
  const darkText = dark
    ? ar
      ? `ظلام تام ${range(dark.dusk, dark.dawn)}`
      : `Full darkness ${range(dark.dusk, dark.dawn)}`
    : ar ? "ما قدرنا نحسب وقت الظلام" : "Dark window unavailable";
  const moonText = dark
    ? dark.moonUp.length
      ? `${ar ? "القمر طالع" : "Moon up"} ${dark.moonUp.map((w) => range(w.start, w.end)).join(ar ? "، " : ", ")}`
      : ar ? "بدون قمر" : "No moon"
    : "";

  const label = [
    `${fireText}${fire.windows.length ? `: ${fire.windows.map((w) => range(w.start, w.end)).join(ar ? "، " : ", ")}` : ""}`,
    `${darkText}${moonText ? `، ${moonText}` : ""}`,
  ];
  const ariaLabel = mode === "kashta" ? label[0] : label[1];

  const fireRow = (primary: boolean) => (
    <div key="fire" className="relative overflow-hidden rounded-full" style={{ height: primary ? 14 : 8, opacity: primary ? 1 : 0.6, background: "rgb(255 255 255 / 8%)" }}>
      {fire.slots.map((s) =>
        s.state === "no" ? null : (
          <span
            key={s.time}
            style={{
              ...span(s.time, s.time.startsWith("04") ? "05:00" : `${String((Number(s.time.slice(0, 2)) + 1) % 24).padStart(2, "0")}:00`),
              ...(s.state === "ok" ? { background: FIRE } : { border: "1px dashed rgb(255 255 255 / 35%)" }),
            }}
          />
        ),
      )}
    </div>
  );

  const darkRow = (primary: boolean) => (
    <div key="dark" className="relative overflow-hidden rounded-full" style={{ height: primary ? 14 : 8, opacity: primary ? 1 : 0.6, background: "rgb(255 255 255 / 8%)" }}>
      {dark && <span style={{ ...span(dark.dusk, dark.dawn), background: DARK }} />}
      {dark?.moonUp.map((w) => <span key={w.start} style={{ ...span(w.start, w.end), background: MOON }} />)}
    </div>
  );

  const swatch = (bg: string, word: string) => (
    <span key={word} className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-2 w-3.5 rounded-sm" style={{ background: bg }} />
      {word}
    </span>
  );

  return (
    <div className={`text-star ${className}`}>
      <div role="img" aria-label={ariaLabel} className="grid gap-1.5">
        {/* One mode, one row: fire hours for a kashta, the dark window for stargazing. */}
        {(mode === "kashta" ? [["fire", true]] as const : [["dark", true]] as const).map(([row, primary]) => (
          <div key={row} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2">
            <span aria-hidden className={`text-[0.78rem] ${primary ? "font-medium" : "muted"}`}>{row === "fire" ? (ar ? "النار" : "Fire") : ar ? "الظلام" : "Dark"}</span>
            {row === "fire" ? fireRow(primary) : darkRow(primary)}
          </div>
        ))}
      </div>
      <div aria-hidden className="relative mt-1 h-4 text-[0.75rem] muted" style={{ marginInlineStart: "calc(3.25rem + 0.5rem)" }}>
        {TICKS.map((t, i) => (
          // The positioned span inherits the page direction so inline-start follows the bars;
          // only the time text inside is isolated left-to-right.
          <span
            key={t}
            className="num absolute whitespace-nowrap"
            style={{ insetInlineStart: `${axisPos(t) * 100}%`, transform: i === 0 ? undefined : `translateX(${50 * (ar ? 1 : -1)}%)` }}
          >
            <bdi dir="ltr">{t}</bdi>
          </span>
        ))}
      </div>
      <p className="small mt-2">
        {mode === "kashta" ? (
          <>
            <span className="font-medium">{fireText}</span>
            {fireFirst && (
              <>
                {" "}
                {ar ? "من" : "from"} <bdi dir="ltr" className="num">{fireFirst.start}</bdi> {ar ? "إلى" : "to"} <bdi dir="ltr" className="num">{fireFirst.end}</bdi>
              </>
            )}
            {fire.knownHours > 0 && <span className="muted"> ({fireRule})</span>}
          </>
        ) : (
          <>
            <span className="font-medium">
              {dark ? (
                <>
                  {ar ? "ظلام تام" : "Full darkness"} <bdi dir="ltr" className="num">{range(dark.dusk, dark.dawn)}</bdi>
                </>
              ) : (
                darkText
              )}
            </span>
            {dark && (
              <span className="muted">
                {" · "}
                {dark.moonUp.length ? (
                  <>
                    {ar ? "القمر طالع" : "Moon up"} <bdi dir="ltr" className="num">{range(dark.moonUp[0].start, dark.moonUp[dark.moonUp.length - 1].end)}</bdi>
                  </>
                ) : (
                  moonText
                )}
              </span>
            )}
          </>
        )}
      </p>
      <p aria-hidden className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] muted">
        {/* Rows carry their own labels; only the moon hatching needs a key. */}
        {mode === "stars" && swatch(MOON, ar ? "القمر طالع" : "Moon up")}
      </p>
    </div>
  );
}
