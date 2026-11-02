import type { ForecastResponse } from "./api-types";
import { scoreNight } from "./score";
import type { FactorScore, PlanPrefs } from "./types";

export function incompleteForecastDates(forecasts: Record<string, ForecastResponse>, prefs: PlanPrefs) {
  return [...new Set(Object.values(forecasts).flatMap(forecast => forecast.metrics
    .filter(metric => scoreNight(forecast.slug, metric, prefs).assessment === "incomplete")
    .map(metric => metric.date)))].sort();
}

export function recommendationHighlights(factors: FactorScore[]) {
  const available = factors.filter(factor => factor.score !== null && factor.weight > 0 && factor.value !== null);
  const strongest = [...available].sort((first, second) => second.score! - first.score! || second.weight - first.weight)[0];
  const tradeoff = available.filter(factor => factor.factor !== strongest?.factor && factor.score! < 100)
    .sort((first, second) => (100 - second.score!) * second.weight - (100 - first.score!) * first.weight)[0];
  return { strongest, tradeoff };
}
