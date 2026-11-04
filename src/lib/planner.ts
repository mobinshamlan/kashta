import "server-only";
import { DESTINATIONS, RECOMMENDABLE, estimateDrive } from "./destinations";
import { upcomingNights } from "./nights";
import { scoreNight } from "./score";
import type { ForecastResponse, PlanResponse, NightSummary } from "./api-types";
import type { Destination, NightScore, PlanPrefs } from "./types";
import type { WeatherErrorCode } from "./weather";
import { fetchSiteForecasts } from "./site-forecasts";

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
): Promise<{ scores: NightScore[]; nights: string[]; fetchedAt: string; airError: WeatherErrorCode | null; airAvailable: boolean; forecasts: Record<string, ForecastResponse> }> {
  const nights = upcomingNights();
  const available = await fetchSiteForecasts();
  const forecasts = Object.fromEntries(destinations.map(destination => [destination.slug, available[destination.slug]]));
  const wanted = prefs.date === "flexible" ? nights : nights.filter((n) => n === prefs.date);

  const scores: NightScore[] = [];
  destinations.forEach((d) => {
    for (const date of wanted) {
      const m = forecasts[d.slug].metrics.find(metric => metric.date === date)!;
      scores.push(scoreNight(d.slug, m, prefs));
    }
  });
  scores.sort(sortScores);
  return {
    scores,
    nights,
    fetchedAt: available[DESTINATIONS[0].slug].fetchedAt,
    airError: available[DESTINATIONS[0].slug].airQuality.error,
    airAvailable: Object.values(forecasts).some(forecast => forecast.airQuality.available),
    forecasts,
  };
}

export function eligibleDestinations(prefs: PlanPrefs) {
  const considered: Destination[] = [];
  const excluded: string[] = [];
  // Unverified places stay on their own pages but never enter a recommendation.
  for (const d of RECOMMENDABLE) {
    if (!d.experiences.includes(prefs.experience)) continue;
    if (estimateDrive(d, prefs.city).hours <= prefs.maxDriveHours) considered.push(d);
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
    return { ...base, forecastFetchedAt: null, nights: upcomingNights(), airQuality: { available: false, error: null }, results: [], metrics: {}, forecasts: {} };
  }
  const { scores, nights, fetchedAt, airError, airAvailable, forecasts } = await scoreDestinations(prefs, considered);
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
    forecasts,
  };
}
