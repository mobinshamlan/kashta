import * as SunCalc from "suncalc";

export interface MoonAboveHorizonWindow {
  start: number;
  end: number;
}

export interface SkyTimelineCalculation {
  sunset: number;
  astronomicalDusk: number;
  astronomicalDawn: number;
  moonAboveHorizon: MoonAboveHorizonWindow[];
}

const RIYADH_OFFSET = "+03:00";
const MOON_SAMPLE_MS = 5 * 60_000;
const BOUNDARY_PRECISION_MS = 30_000;

function isAboveHorizon(time: number, lat: number, lon: number) {
  return SunCalc.getMoonPosition(new Date(time), lat, lon).altitude > 0;
}

function findHorizonCrossing(
  low: number,
  high: number,
  wasAbove: boolean,
  lat: number,
  lon: number,
) {
  while (high - low > BOUNDARY_PRECISION_MS) {
    const mid = (low + high) / 2;
    if (isAboveHorizon(mid, lat, lon) === wasAbove) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Calculate astronomical twilight and the moon's above-horizon intervals for one Riyadh-local night. */
export function calculateSkyTimeline(date: string, lat: number, lon: number): SkyTimelineCalculation | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return null;
  }

  const [, year, month, day] = match;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    calendarDate.getUTCFullYear() !== Number(year) ||
    calendarDate.getUTCMonth() !== Number(month) - 1 ||
    calendarDate.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  // SunCalc consumes absolute instants; Saudi Arabia stays at UTC+3 year-round.
  const evening = new Date(`${date}T12:00:00${RIYADH_OFFSET}`);
  const morning = new Date(evening.getTime() + 24 * 60 * 60_000);
  const eveningTimes = SunCalc.getTimes(evening, lat, lon);
  const morningTimes = SunCalc.getTimes(morning, lat, lon);
  const sunsetDate = eveningTimes.sunset;
  const duskDate = eveningTimes.night;
  const dawnDate = morningTimes.nightEnd;
  if (!sunsetDate || !duskDate || !dawnDate) return null;
  const sunset = sunsetDate.getTime();
  const astronomicalDusk = duskDate.getTime();
  const astronomicalDawn = dawnDate.getTime();

  if (
    !Number.isFinite(sunset) ||
    !Number.isFinite(astronomicalDusk) ||
    !Number.isFinite(astronomicalDawn) ||
    sunset >= astronomicalDusk ||
    astronomicalDusk >= astronomicalDawn
  ) {
    return null;
  }

  const moonAboveHorizon: MoonAboveHorizonWindow[] = [];
  let cursor = sunset;
  let above = isAboveHorizon(cursor, lat, lon);
  let windowStart = above ? sunset : null;

  while (cursor < astronomicalDawn) {
    const next = Math.min(cursor + MOON_SAMPLE_MS, astronomicalDawn);
    const nextAbove = isAboveHorizon(next, lat, lon);

    if (nextAbove !== above) {
      const crossing = findHorizonCrossing(cursor, next, above, lat, lon);
      if (nextAbove) windowStart = crossing;
      else if (windowStart !== null) {
        moonAboveHorizon.push({ start: windowStart, end: crossing });
        windowStart = null;
      }
    }

    cursor = next;
    above = nextAbove;
  }

  if (windowStart !== null) moonAboveHorizon.push({ start: windowStart, end: astronomicalDawn });

  return { sunset, astronomicalDusk, astronomicalDawn, moonAboveHorizon };
}
