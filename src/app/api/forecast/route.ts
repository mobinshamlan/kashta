import type { ForecastResponse } from "@/lib/api-types";
import { getDestination } from "@/lib/destinations";
import { apiError, fromException, privateJson } from "@/lib/http";
import { fetchSiteForecasts } from "@/lib/site-forecasts";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) return apiError("invalid_input", "Missing destination");
  const d = getDestination(slug);
  if (!d) return apiError("not_found", "Unknown destination");

  try {
    const forecasts = await fetchSiteForecasts();
    const body: ForecastResponse = forecasts[slug];
    return privateJson(body);
  } catch (err) {
    return fromException(err);
  }
}
