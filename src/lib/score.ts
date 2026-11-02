import type {
  Experience,
  Factor,
  FactorScore,
  NightMetrics,
  NightScore,
  PlanPrefs,
  TempPref,
  WindTolerance,
} from "./types";

/**
 * The Kashta Score. Pure, deterministic code: Llama never produces or changes these numbers.
 * Each factor maps one forecast measurement onto 0–100 with straight-line ramps, then a
 * weighted average gives the night's score. Thresholds are deliberately simple so they can be
 * explained on the methodology page.
 */

export const BASE_WEIGHTS: Record<Experience, Partial<Record<Factor, number>>> = {
  kashta: { temp: 0.3, wind: 0.3, rain: 0.2, dust: 0.15, clouds: 0.05 },
  stars: { clouds: 0.3, moon: 0.2, dust: 0.15, wind: 0.15, temp: 0.1, rain: 0.1 },
};

/** A priority picked by the user (or understood from their description) counts 1.6x. */
export const PRIORITY_BOOST = 1.6;

/** Evening feels-like comfort band, °C. */
export const TEMP_BANDS: Record<TempPref, [number, number]> = {
  cool: [8, 16],
  mild: [14, 22],
  warm: [18, 27],
};

/** Gusts (km/h): full marks at or below `good`, zero at or above `bad`. */
export const GUST_LIMITS: Record<WindTolerance, { good: number; bad: number }> = {
  low: { good: 20, bad: 40 },
  medium: { good: 30, bad: 55 },
  high: { good: 40, bad: 70 },
};

export const RAIN_LIMITS = { good: 10, bad: 70 }; // max precipitation probability, %
export const DUST_LIMITS = { good: 60, bad: 400 }; // max surface dust, μg/m³
export const CLOUD_LIMITS = { good: 10, bad: 80 }; // mean cloud cover 20:00–04:00, %

/** 100 at or below `good`, 0 at or above `bad`, linear between. */
export function ramp(value: number, good: number, bad: number): number {
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return Math.round(100 * (1 - (value - good) / (bad - good)));
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function tempScore(m: NightMetrics, pref: TempPref): number | null {
  if (m.eveningTemp === null || m.minFeels === null) return null;
  const [lo, hi] = TEMP_BANDS[pref];
  const evening = m.eveningTemp;
  let s = 100;
  if (evening < lo) s -= (lo - evening) * 8;
  if (evening > hi) s -= (evening - hi) * 8;
  // A very cold small hours costs points whatever the preference.
  if (m.minFeels < 4) s -= (4 - m.minFeels) * 5;
  return clamp(s);
}

export function windScore(m: NightMetrics, tol: WindTolerance): number | null {
  if (m.maxGust === null) return null;
  const { good, bad } = GUST_LIMITS[tol];
  return ramp(m.maxGust, good, bad);
}

export function rainScore(m: NightMetrics): number | null {
  if (m.maxPrecipProb === null) return null;
  let s = ramp(m.maxPrecipProb, RAIN_LIMITS.good, RAIN_LIMITS.bad);
  if (m.totalPrecip !== null && m.totalPrecip >= 1) s = Math.min(s, 25);
  return s;
}

export function dustScore(m: NightMetrics): number | null {
  if (m.maxDust === null) return null;
  return ramp(m.maxDust, DUST_LIMITS.good, DUST_LIMITS.bad);
}

export function cloudScore(m: NightMetrics): number | null {
  if (m.meanCloud === null) return null;
  return ramp(m.meanCloud, CLOUD_LIMITS.good, CLOUD_LIMITS.bad);
}

/** Share of truly dark hours with the moon below the horizon, plus how dim the moon is. */
export function moonScore(m: NightMetrics): number | null {
  if (m.darkHours <= 0) return null;
  const ratio = m.moonFreeDarkHours / m.darkHours;
  return clamp(100 * (0.6 * ratio + 0.4 * (1 - m.moonIllumination)));
}

export function weightsFor(experience: Experience, priorities: Factor[]): Partial<Record<Factor, number>> {
  const base = { ...BASE_WEIGHTS[experience] };
  for (const p of priorities) {
    if (base[p] !== undefined) base[p] = base[p]! * PRIORITY_BOOST;
  }
  const total = Object.values(base).reduce((a, b) => a + (b ?? 0), 0);
  const out: Partial<Record<Factor, number>> = {};
  for (const [k, v] of Object.entries(base)) out[k as Factor] = (v ?? 0) / total;
  return out;
}

function valueLabel(f: Factor, m: NightMetrics): string | null {
  switch (f) {
    case "temp":
      return m.eveningTemp === null ? null : `${m.eveningTemp}°C / ${m.minFeels}°C`;
    case "wind":
      return m.maxGust === null ? null : `${m.maxGust} km/h`;
    case "rain":
      return m.maxPrecipProb === null ? null : `${m.maxPrecipProb}%`;
    case "dust":
      return m.maxDust === null ? null : `${m.maxDust} μg/m³`;
    case "clouds":
      return m.meanCloud === null ? null : `${m.meanCloud}%`;
    case "moon":
      return `${Math.round(m.moonIllumination * 100)}%`;
  }
}

export function scoreNight(
  slug: string,
  m: NightMetrics,
  prefs: Pick<PlanPrefs, "experience" | "tempPref" | "windTolerance" | "priorities">,
): NightScore {
  const weights = weightsFor(prefs.experience, prefs.priorities);
  const raw: Record<Factor, number | null> = {
    temp: tempScore(m, prefs.tempPref),
    wind: windScore(m, prefs.windTolerance),
    rain: rainScore(m),
    dust: dustScore(m),
    clouds: cloudScore(m),
    moon: moonScore(m),
  };

  const factors: FactorScore[] = (Object.keys(weights) as Factor[]).map((factor) => ({
    factor,
    score: raw[factor],
    weight: Math.round((weights[factor] ?? 0) * 1000) / 1000,
    value: valueLabel(factor, m),
  }));

  const missing = factors.filter((f) => f.score === null).map((f) => f.factor);

  const dealbreakers: Factor[] = [];
  if (m.maxGust !== null && m.maxGust >= GUST_LIMITS[prefs.windTolerance].bad) dealbreakers.push("wind");
  if (m.maxPrecipProb !== null && m.maxPrecipProb >= RAIN_LIMITS.bad) dealbreakers.push("rain");
  if (m.maxDust !== null && m.maxDust >= DUST_LIMITS.bad) dealbreakers.push("dust");

  let score: number | null = null;
  if (missing.length === 0) {
    score = clamp(factors.reduce((acc, f) => acc + (f.score ?? 0) * f.weight, 0));
    // A single dangerous condition caps the night, however good the rest looks.
    if (dealbreakers.length) score = Math.min(score, 35);
  }

  return {
    slug,
    date: m.date,
    score,
    assessment: missing.length ? "incomplete" : "complete",
    missing,
    dealbreakers,
    factors,
    metrics: m,
  };
}

export type Rating = "excellent" | "good" | "fair" | "poor" | "unknown";

export function rating(score: number | null): Rating {
  if (score === null) return "unknown";
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  return "poor";
}
