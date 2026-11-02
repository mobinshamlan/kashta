import type { ForecastResponse } from "@/lib/api-types";
import { getDestination } from "@/lib/destinations";
import { apiError, fromException } from "@/lib/http";
import { computeNight, upcomingNights } from "@/lib/nights";
import { fetchWeather } from "@/lib/weather";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) return apiError("invalid_input", "Missing destination");
  const d = getDestination(slug);
  if (!d) return apiError("not_found", "Unknown destination");

  try {
    const weather = await fetchWeather([{ lat: d.lat, lon: d.lon }]);
    const series = weather.series[0];
    const nights = upcomingNights();
    const body: ForecastResponse = {
      slug,
      fetchedAt: weather.fetchedAt,
      nights,
      airQuality: { available: series.airAvailable, error: weather.airError },
      metrics: nights.map((n) => computeNight(series.hours, n, d.lat, d.lon)),
      units: series.units,
    };
    return Response.json(body);
  } catch (err) {
    return fromException(err);
  }
}
