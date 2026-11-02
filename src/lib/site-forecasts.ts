import "server-only";
import type { ForecastResponse } from "./api-types";
import { DESTINATIONS } from "./destinations";
import { computeNight, upcomingNights } from "./nights";
import { fetchWeather } from "./weather";

export async function fetchSiteForecasts(): Promise<Record<string, ForecastResponse>> {
  const weather = await fetchWeather(DESTINATIONS.map(({ lat, lon }) => ({ lat, lon })));
  const nights = upcomingNights();
  return Object.fromEntries(DESTINATIONS.map((destination, index) => {
    const series = weather.series[index];
    return [destination.slug, {
      slug: destination.slug,
      fetchedAt: weather.fetchedAt,
      nights,
      airQuality: { available: series.airAvailable, error: weather.airError },
      metrics: nights.map(night => computeNight(series.hours, night, destination.lat, destination.lon)),
      units: series.units,
    }];
  }));
}
