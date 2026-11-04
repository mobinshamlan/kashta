import { calculateSkyTimeline } from "./sky-timeline";
import { GUST_LIMITS, RAIN_LIMITS } from "./score";
import type { HourPoint } from "./types";

/**
 * Fire-friendly hours reuse the score's own full-marks thresholds (default wind tolerance and
 * the rain ramp), so this view invents no new rule: gusts ≤ 30 km/h and rain chance ≤ 10 %.
 */
export const FIRE_GUST_MAX = GUST_LIMITS.medium.good;
export const FIRE_RAIN_MAX = RAIN_LIMITS.good;

export type FireState = "ok" | "no" | "unknown";

const AXIS_START = 18 * 60;
const AXIS_HOURS = 11; // 18:00 → 05:00

/** Position of a local "HH:mm" on the 18:00→05:00 axis, 0..1. Times before noon are next morning. */
export function axisPos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  let minutes = h * 60 + m;
  if (h < 12) minutes += 24 * 60;
  return Math.min(1, Math.max(0, (minutes - AXIS_START) / (AXIS_HOURS * 60)));
}

const hhmm = (time: string) => time.slice(11, 16);

function plusHour(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Hour-by-hour fire suitability for 18:00–04:00 (each slot covers one hour, ending by 05:00). */
export function fireWindows(hours: HourPoint[]) {
  const slots = hours
    .filter((p) => {
      const h = Number(p.time.slice(11, 13));
      return h >= 18 || h < 5;
    })
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((p) => {
      const state: FireState =
        p.gust === null || p.precipProb === null
          ? "unknown"
          : p.gust <= FIRE_GUST_MAX && p.precipProb <= FIRE_RAIN_MAX
            ? "ok"
            : "no";
      return { time: hhmm(p.time), state };
    });

  const windows: { start: string; end: string }[] = [];
  for (const s of slots) {
    if (s.state !== "ok") continue;
    const last = windows[windows.length - 1];
    if (last && last.end === s.time) last.end = plusHour(s.time);
    else windows.push({ start: s.time, end: plusHour(s.time) });
  }

  return {
    slots,
    windows,
    okHours: slots.filter((s) => s.state === "ok").length,
    knownHours: slots.filter((s) => s.state !== "unknown").length,
  };
}

const clock = (epoch: number) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Riyadh" }).format(new Date(epoch));

/** Astronomical dark window and moon-above-horizon spans, as Riyadh "HH:mm". Calculated, not forecast. */
export function darkWindow(date: string, lat: number, lon: number) {
  const sky = calculateSkyTimeline(date, lat, lon);
  if (!sky) return null;
  return {
    dusk: clock(sky.astronomicalDusk),
    dawn: clock(sky.astronomicalDawn),
    moonUp: sky.moonAboveHorizon.map((w) => ({ start: clock(w.start), end: clock(w.end) })),
  };
}
