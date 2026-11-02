import assert from "node:assert/strict";
import { test } from "node:test";
import type { ForecastResponse } from "../src/lib/api-types";
import { DESTINATIONS } from "../src/lib/destinations";
import { loadForecast, rememberForecast } from "../src/lib/forecast-storage";
import { computeNight, upcomingNights } from "../src/lib/nights";
import { DEFAULT_PREFS } from "../src/lib/prefs-storage";
import { incompleteForecastDates, recommendationHighlights } from "../src/lib/recommendation-summary";
import { scoreNight } from "../src/lib/score";
import type { FactorScore } from "../src/lib/types";

test("summary uses active measured factors and the largest weighted trade-off", () => {
  const factors: FactorScore[] = [
    { factor: "wind", score: 100, weight: 0.3, value: "15 km/h" },
    { factor: "temp", score: 80, weight: 0.5, value: "25°C / 20°C" },
    { factor: "clouds", score: 50, weight: 0.05, value: "50%" },
    { factor: "moon", score: 10, weight: 0, value: "90%" },
  ];
  assert.equal(recommendationHighlights(factors).strongest?.factor, "wind");
  assert.equal(recommendationHighlights(factors).tradeoff?.factor, "temp");
  assert.deepEqual(recommendationHighlights([{ factor: "dust", score: null, weight: 0.2, value: null }]), { strongest: undefined, tradeoff: undefined });
});

test("forecast snapshot preserves the exact night, preferences and incomplete assessment", () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: { setItem: (key: string, value: string) => storage.set(key, value), getItem: (key: string) => storage.get(key) ?? null },
  } });
  try {
    const destination = DESTINATIONS[0];
    const nights = upcomingNights();
    const data: ForecastResponse = {
      slug: destination.slug,
      fetchedAt: new Date().toISOString(),
      nights,
      airQuality: { available: false, error: "upstream" },
      metrics: nights.map(night => computeNight([], night, destination.lat, destination.lon)),
      units: {},
    };
    const prefs = { ...DEFAULT_PREFS, date: nights[2], experience: "stars" as const, priorities: ["clouds" as const] };
    rememberForecast(data, prefs);
    const restored = loadForecast(destination.slug)!;
    assert.deepEqual(restored.prefs, prefs);
    assert.equal(restored.data.metrics[2].date, nights[2]);
    assert.deepEqual(scoreNight(destination.slug, restored.data.metrics[2], prefs), scoreNight(destination.slug, data.metrics[2], prefs));
    assert.equal(scoreNight(destination.slug, restored.data.metrics[2], prefs).score, null);
    assert.deepEqual(incompleteForecastDates({ [destination.slug]: data }, prefs), nights);
    storage.set(`kashta:forecast:v1:${DESTINATIONS[1].slug}`, JSON.stringify({ data, prefs, savedAt: Date.now() - 7 * 60 * 60 * 1000 }));
    assert.equal(loadForecast(DESTINATIONS[1].slug), null);
    assert.equal(loadForecast("nonexistent-site"), null);
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
});
