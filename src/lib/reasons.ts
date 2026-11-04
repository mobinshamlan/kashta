import type { NightSummary, PlanResponse, ScoreRow } from "./api-types";
import { estimateDrive, getDestination } from "./destinations";
import type { CityId, Factor } from "./types";

export type Reason = {
  factor: Factor;
  tone: "good" | "caution";
  /** "high" when the factor scored 80+, "ok" for 60–79; cautions are always "low". */
  tier: "high" | "ok" | "low";
  /** Measured numbers behind the sentence; never invented, only copied from the forecast summary. */
  values: Record<string, number>;
};

function valuesFor(factor: Factor, m: NightSummary): Record<string, number> | null {
  switch (factor) {
    case "temp":
      return m.eveningTemp === null ? null : { evening: Math.round(m.eveningTemp), ...(m.minFeels === null ? {} : { coldest: Math.round(m.minFeels) }) };
    case "wind":
      return m.maxGust === null ? null : { gust: Math.round(m.maxGust) };
    case "rain":
      return m.maxPrecipProb === null ? null : { chance: Math.round(m.maxPrecipProb) };
    case "dust":
      return m.maxDust === null ? null : { dust: Math.round(m.maxDust) };
    case "clouds":
      return m.meanCloud === null ? null : { cloud: Math.round(m.meanCloud) };
    case "moon":
      return { free: m.moonFreeDarkHours, dark: m.darkHours, lit: Math.round(m.moonIllumination * 100) };
  }
}

/**
 * Up to `max` plain reasons for a scored night: the factors that helped most (weighted), then
 * at most one caution for the weakest weighted factor. Built only from the app's own scores.
 */
export function nightReasons(row: ScoreRow, m: NightSummary | undefined, max = 3): Reason[] {
  if (!m || row.score === null) return [];
  const scored = row.factors.filter((f) => f.score !== null && f.weight > 0.04);
  const good = [...scored]
    .filter((f) => f.score! >= 60)
    .sort((a, b) => b.score! * b.weight - a.score! * a.weight);
  const caution = [...scored]
    .filter((f) => f.score! < 50)
    .sort((a, b) => (100 - b.score!) * b.weight - (100 - a.score!) * a.weight)[0];
  const out: Reason[] = [];
  // A poor night leads with what held it back, so a "not suitable" label never sits beside praise.
  if (caution && (row.score < 50 || row.dealbreakers.length > 0)) {
    const values = valuesFor(caution.factor, m);
    if (values && max === 1) return [{ factor: caution.factor, tone: "caution", tier: "low", values }];
  }
  // A single reason is the strongest good one; a caution only takes a slot when there's room.
  const goodSlots = caution && max > 1 ? max - 1 : max;
  for (const f of good) {
    if (out.length >= goodSlots) break;
    const values = valuesFor(f.factor, m);
    if (values) out.push({ factor: f.factor, tone: "good", tier: f.score! >= 80 ? "high" : "ok", values });
  }
  if (caution && out.length < max) {
    const values = valuesFor(caution.factor, m);
    if (values) out.push({ factor: caution.factor, tone: "caution", tier: "low", values });
  }
  return out;
}

/** Scores this close to the night's top count as a tie, and the nearer place wins. */
export const NEARBY_TIE_POINTS = 5;

/**
 * The pick for each night, in night order: among places scoring within NEARBY_TIE_POINTS of the
 * night's top score, the one with the shortest estimated drive. Scores are never changed.
 */
export function bestPerNight(data: Pick<PlanResponse, "nights" | "results">, city: CityId = "riyadh") {
  return data.nights.map((night) => {
    const scored = data.results.filter((r) => r.date === night && r.score !== null);
    const top = Math.max(...scored.map((r) => r.score!));
    const close = scored.filter((r) => r.score! >= top - NEARBY_TIE_POINTS);
    const best = close.sort((a, b) => driveHours(a.slug, city) - driveHours(b.slug, city) || b.score! - a.score!)[0];
    // Unscored nights name what the forecast hasn't covered yet, so "incomplete" never reads as "poor".
    const missing = best ? [] : [...new Set(data.results.filter((r) => r.date === night).flatMap((r) => r.missing ?? []))];
    return { night, best, missing };
  });
}

export type NightPick = ReturnType<typeof bestPerNight>[number];

/**
 * Every scored place for one night, in recommendation order: the places within
 * NEARBY_TIE_POINTS of the top share first place and the nearest leads (so row 0 is always the
 * night's pick from bestPerNight); the rest follow by score. Scores are never changed.
 */
export function rankNight(data: Pick<PlanResponse, "results">, night: string, city: CityId = "riyadh"): ScoreRow[] {
  const scored = data.results.filter((r) => r.date === night && r.score !== null);
  const top = Math.max(...scored.map((r) => r.score!));
  const near = (r: ScoreRow) => r.score! >= top - NEARBY_TIE_POINTS;
  return [...scored].sort((a, b) => {
    if (near(a) && near(b)) return driveHours(a.slug, city) - driveHours(b.slug, city) || b.score! - a.score!;
    if (near(a) !== near(b)) return near(a) ? -1 : 1;
    return b.score! - a.score! || driveHours(a.slug, city) - driveHours(b.slug, city);
  });
}

function driveHours(slug: string, city: CityId) {
  const d = getDestination(slug);
  return d ? estimateDrive(d, city).hours : Infinity;
}
