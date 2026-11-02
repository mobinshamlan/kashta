import type { ForecastResponse, PlanResponse } from "./api-types";
import { getDestination } from "./destinations";
import { upcomingNights } from "./nights";
import { planPrefsSchema } from "./schemas";
import type { PlanPrefs } from "./types";

type Snapshot = { data: ForecastResponse; prefs: PlanPrefs; savedAt: number };
const snapshots = new Map<string, Snapshot>();
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const keyFor = (slug: string) => `kashta:forecast:v1:${slug}`;

export function rememberForecast(data: ForecastResponse, prefs: PlanPrefs) {
  const snapshot: Snapshot = { data, prefs, savedAt: Date.now() };
  snapshots.set(data.slug, snapshot);
  try {
    window.sessionStorage.setItem(keyFor(data.slug), JSON.stringify(snapshot));
  } catch {}
}

export function rememberPlanForecasts(plan: PlanResponse, prefs: PlanPrefs) {
  Object.values(plan.forecasts).forEach(forecast => rememberForecast(forecast, prefs));
}

export function loadForecast(slug: string): Snapshot | null {
  if (!getDestination(slug)) return null;
  try {
    const snapshot: Snapshot = snapshots.get(slug) ?? JSON.parse(window.sessionStorage.getItem(keyFor(slug)) ?? "null");
    if (!snapshot || !Number.isFinite(snapshot.savedAt) || Date.now() - snapshot.savedAt > MAX_AGE_MS) return null;
    const { data } = snapshot;
    const fetchedAt = Date.parse(data.fetchedAt);
    if (data.slug !== slug || !Number.isFinite(fetchedAt) || Date.now() - fetchedAt > MAX_AGE_MS || fetchedAt > Date.now() + 60_000 || !planPrefsSchema.safeParse(snapshot.prefs).success) return null;
    if (!Array.isArray(data.nights) || !Array.isArray(data.metrics) || data.nights.length !== data.metrics.length) return null;
    if (!data.metrics.every((metric, index) => metric.date === data.nights[index] && Array.isArray(metric.hours))) return null;
    const upcoming = new Set(upcomingNights());
    const metrics = data.metrics.filter(metric => upcoming.has(metric.date));
    if (!metrics.length) return null;
    return { ...snapshot, data: { ...data, metrics, nights: metrics.map(metric => metric.date) } };
  } catch {
    return null;
  }
}
