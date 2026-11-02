import "server-only";
import { DESTINATIONS, estimateDrive } from "./destinations";
import { computeNight, upcomingNights } from "./nights";
import { scoreNight } from "./score";
import type { PlanResponse, NightSummary } from "./api-types";
import type { Destination, NightScore, PlanPrefs } from "./types";
import { fetchWeather, type WeatherErrorCode } from "./weather";

export function sortScores(a: NightScore, b: NightScore) {
  if (a.score === null && b.score === null) return 0;
  if (a.score === null) return 1;
  if (b.score === null) return -1;
  return b.score - a.score;
}

/** Forecast every eligible destination for the next seven nights and score each night. */
export async function scoreDestinations(
  prefs: PlanPrefs,
  destinations: Destination[] = DESTINATIONS,
): Promise<{ scores: NightScore[]; nights: string[]; fetchedAt: string; airError: WeatherErrorCode | null; airAvailable: boolean }> {
  const nights = upcomingNights();
  const weather = await fetchWeather(destinations.map((d) => ({ lat: d.lat, lon: d.lon })));
  const wanted = prefs.date === "flexible" ? nights : nights.filter((n) => n === prefs.date);

  const scores: NightScore[] = [];
  destinations.forEach((d, i) => {
    for (const date of wanted) {
      const m = computeNight(weather.series[i].hours, date, d.lat, d.lon);
      scores.push(scoreNight(d.slug, m, prefs));
    }
  });
  scores.sort(sortScores);
  return {
    scores,
    nights,
    fetchedAt: weather.fetchedAt,
    airError: weather.airError,
    airAvailable: weather.series.some((s) => s.airAvailable),
  };
}

export function eligibleDestinations(prefs: PlanPrefs) {
  const considered: Destination[] = [];
  const excluded: string[] = [];
  for (const d of DESTINATIONS) {
    if (!d.experiences.includes(prefs.experience)) continue;
    if (estimateDrive(d).hours <= prefs.maxDriveHours) considered.push(d);
    else excluded.push(d.slug);
  }
  return { considered, excluded };
}

export async function buildPlan(prefs: PlanPrefs): Promise<PlanResponse> {
  const { considered, excluded } = eligibleDestinations(prefs);
  const base = {
    generatedAt: new Date().toISOString(),
    considered: considered.map((d) => d.slug),
    excludedByDistance: excluded,
  };
  if (considered.length === 0) {
    return { ...base, forecastFetchedAt: null, nights: upcomingNights(), airQuality: { available: false, error: null }, results: [], metrics: {} };
  }
  const { scores, nights, fetchedAt, airError, airAvailable } = await scoreDestinations(prefs, considered);
  const metrics: Record<string, NightSummary> = {};
  const results = scores.map(({ metrics: m, ...rest }) => {
    const { hours: _hours, ...summary } = m;
    void _hours;
    metrics[`${rest.slug}|${rest.date}`] = summary;
    return rest;
  });
  return {
    ...base,
    forecastFetchedAt: fetchedAt,
    nights,
    airQuality: { available: airAvailable, error: airError },
    results,
    metrics,
  };
}
