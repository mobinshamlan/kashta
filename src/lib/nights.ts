import * as SunCalc from "suncalc";
import type { HourPoint, NightMetrics } from "./types";

/** Riyadh has no daylight saving: local time is always UTC+3. */
const RIYADH_OFFSET_H = 3;

export function riyadhToday(now = new Date()): string {
  return new Date(now.getTime() + RIYADH_OFFSET_H * 3600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven evenings starting tonight (Riyadh time). */
export function upcomingNights(now = new Date()): string[] {
  const today = riyadhToday(now);
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

function localHHMM(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + RIYADH_OFFSET_H * 3600_000).toISOString().slice(11, 16);
}

/** A "night" runs from 18:00 on its date to 05:00 the next morning (12 hourly samples). */
export function nightHours(hours: HourPoint[], date: string): HourPoint[] {
  const start = `${date}T18:00`;
  const end = `${addDays(date, 1)}T05:00`;
  return hours.filter((h) => h.time >= start && h.time <= end);
}

const NIGHT_SAMPLES = 12;
/** A measurement is trusted only when at least half the night's hours have it. */
const MIN_COVERAGE = 0.5;

function values(hours: HourPoint[], key: keyof HourPoint): number[] | null {
  const vals = hours.map((h) => h[key]).filter((v): v is number => typeof v === "number");
  if (vals.length / NIGHT_SAMPLES < MIN_COVERAGE) return null;
  return vals;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const max = (v: number[] | null) => (v ? round1(Math.max(...v)) : null);
const min = (v: number[] | null) => (v ? round1(Math.min(...v)) : null);
const mean = (v: number[] | null) => (v ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null);
const sum = (v: number[] | null) => (v ? round1(v.reduce((a, b) => a + b, 0)) : null);

export function moonForNight(date: string, lat: number, lon: number) {
  const evening = new Date(`${date}T09:00:00Z`); // noon in Riyadh
  const morning = new Date(`${addDays(date, 1)}T09:00:00Z`);
  const t1 = SunCalc.getTimes(evening, lat, lon);
  const t2 = SunCalc.getTimes(morning, lat, lon);
  const dusk = t1.night; // end of astronomical twilight
  const dawn = t2.nightEnd;

  const midnight = new Date(`${addDays(date, 1)}T00:00:00+03:00`);
  const illum = SunCalc.getMoonIllumination(midnight);

  let darkHours = 0;
  let moonFree = 0;
  if (dusk && dawn && !Number.isNaN(dusk.getTime()) && !Number.isNaN(dawn.getTime())) {
    const step = 15 * 60_000;
    for (let t = dusk.getTime(); t < dawn.getTime(); t += step) {
      darkHours += 0.25;
      if (SunCalc.getMoonPosition(new Date(t), lat, lon).altitude < 0) moonFree += 0.25;
    }
  }

  return {
    sunset: localHHMM(t1.sunset),
    duskAstro: localHHMM(dusk),
    dawnAstro: localHHMM(dawn),
    moonIllumination: Math.round(illum.fraction * 100) / 100,
    moonWaxing: illum.phase < 0.5,
    darkHours: round1(darkHours),
    moonFreeDarkHours: round1(moonFree),
  };
}

export function computeNight(
  hoursAll: HourPoint[],
  date: string,
  lat: number,
  lon: number,
): NightMetrics {
  const hours = nightHours(hoursAll, date);
  const evening = hours.filter((h) => h.time.startsWith(date)); // 18:00–23:00
  const eveningVals = evening.map((h) => h.temp).filter((v): v is number => v !== null);
  // Stargazing hours: 20:00–04:00.
  const dark = hours.filter((h) => {
    const hh = h.time.slice(11, 13);
    return hh >= "20" || hh <= "04"; // taste-skill-ignore (an hour, not numbering)
  });
  const cloudVals = dark.map((h) => h.cloud).filter((v): v is number => v !== null);

  return {
    date,
    eveningTemp: eveningVals.length >= 3 ? mean(eveningVals) : null,
    minTemp: min(values(hours, "temp")),
    minFeels: min(values(hours, "feels")),
    maxWind: max(values(hours, "wind")),
    maxGust: max(values(hours, "gust")),
    maxPrecipProb: max(values(hours, "precipProb")),
    totalPrecip: sum(values(hours, "precip")),
    meanCloud: cloudVals.length >= dark.length * MIN_COVERAGE && dark.length > 0 ? mean(cloudVals) : null,
    maxDust: max(values(hours, "dust")),
    meanDust: mean(values(hours, "dust")),
    maxPm10: max(values(hours, "pm10")),
    ...moonForNight(date, lat, lon),
    hours,
  };
}
