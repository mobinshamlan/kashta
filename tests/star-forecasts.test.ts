import assert from "node:assert/strict";
import { test } from "node:test";
import type { ForecastResponse } from "../src/lib/api-types";
import { DESTINATIONS, estimateDrive, isRecommendable } from "../src/lib/destinations";
import { rememberForecast } from "../src/lib/forecast-storage";
import { computeNight, upcomingNights } from "../src/lib/nights";
import { DEFAULT_PREFS } from "../src/lib/prefs-storage";
import { scoreNight } from "../src/lib/score";
import { loadStarForecasts, rankStarForecasts } from "../src/lib/star-forecasts";

function forecasts(): Record<string, ForecastResponse> {
  const nights = upcomingNights();
  return Object.fromEntries(DESTINATIONS.map(site => [site.slug, {
    slug: site.slug, fetchedAt: new Date().toISOString(), nights,
    airQuality: { available: true, error: null }, units: {},
    metrics: nights.map((night, index) => ({
      ...computeNight([], night, site.lat, site.lon),
      eveningTemp: 22, minTemp: 18, minFeels: 18, maxWind: 10, maxGust: 15,
      maxPrecipProb: 0, totalPrecip: 0, meanCloud: 10,
      maxDust: index === 6 ? null : 30, meanDust: index === 6 ? null : 20, maxPm10: 40,
    })),
  }]));
}

test("stars filters preserve the existing score and leave missing measurements unscored", () => {
  const pool = forecasts();
  const prefs = { ...DEFAULT_PREFS, experience: "stars" as const, priorities: [] };
  for (const hours of [2, 3, 5]) {
    const ranked = rankStarForecasts(pool, prefs, hours);
    assert.deepEqual(ranked.considered, DESTINATIONS.filter(site => isRecommendable(site) && site.experiences.includes("stars") && estimateDrive(site).hours <= hours).map(site => site.slug));
    assert.ok(ranked.results.some(row => row.score !== null));
    assert.ok(ranked.results.filter(row => row.date === ranked.nights[6]).every(row => row.score === null && row.assessment === "incomplete"));
    for (const row of ranked.results) {
      const metric = pool[row.slug].metrics.find(metric => metric.date === row.date)!;
      assert.equal(row.score, scoreNight(row.slug, metric, prefs).score);
    }
  }
  Object.values(pool).forEach(forecast => { forecast.metrics = []; });
  assert.deepEqual(rankStarForecasts(pool, prefs, 3).results, []);
});

test("stars restores only a complete, recent shared forecast pool", () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: { setItem: (key: string, value: string) => storage.set(key, value), getItem: (key: string) => storage.get(key) ?? null },
  } });
  try {
    assert.equal(loadStarForecasts(), null);
    const pool = forecasts();
    Object.values(pool).forEach(forecast => rememberForecast(forecast, DEFAULT_PREFS));
    assert.ok(loadStarForecasts());
    const stale = pool[DESTINATIONS[0].slug];
    rememberForecast({ ...stale, fetchedAt: new Date(Date.now() - 7 * 3600_000).toISOString() }, DEFAULT_PREFS);
    assert.equal(loadStarForecasts(), null, "saving an old provider response again must not extend its lifetime");
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
