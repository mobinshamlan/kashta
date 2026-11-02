import "server-only";
import type { HourPoint } from "./types";

/**
 * Open-Meteo clients (https://open-meteo.com). Free tier for non-commercial use, CC BY 4.0
 * attribution required. Responses are cached for 30 minutes through Next's fetch cache so
 * repeated plans do not spend the daily quota.
 *
 * Both APIs accept comma-separated coordinates and return an array, so one planning request
 * costs two upstream calls regardless of how many destinations are compared.
 */

// Overridable for a self-hosted Open-Meteo instance (or a stub in tests).
const FORECAST_URL = process.env.OPEN_METEO_FORECAST_URL || "https://api.open-meteo.com/v1/forecast";
const AIR_URL = process.env.OPEN_METEO_AIR_URL || "https://air-quality-api.open-meteo.com/v1/air-quality";
const TIMEOUT_MS = 12_000;
const REVALIDATE_S = 1800;

const FORECAST_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "wind_speed_10m",
  "wind_gusts_10m",
  "precipitation_probability",
  "precipitation",
  "cloud_cover",
] as const;
const AIR_VARS = ["dust", "pm10"] as const;

export type WeatherErrorCode = "timeout" | "rate_limited" | "upstream" | "bad_response";

export class WeatherError extends Error {
  constructor(
    public code: WeatherErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SiteSeries {
  hours: HourPoint[];
  /** Air quality may fail independently; weather is still usable without it. */
  airAvailable: boolean;
  units: Record<string, string>;
}

export interface WeatherBundle {
  fetchedAt: string;
  series: SiteSeries[];
  airError: WeatherErrorCode | null;
}

type Coord = { lat: number; lon: number };

interface OpenMeteoLocation {
  hourly?: Record<string, (number | null)[] | string[]>;
  hourly_units?: Record<string, string>;
}

async function getJson(url: string): Promise<{ locations: OpenMeteoLocation[]; fetchedAt: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_S },
      headers: { "User-Agent": "KASHTA/1.0 (desert trip planner)" },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new WeatherError("timeout", "Open-Meteo did not answer in time");
    }
    throw new WeatherError("upstream", "Could not reach Open-Meteo");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 200) : "";
    console.warn("[weather] Provider request failed", { provider: new URL(url).host, status: res.status, reason });
    throw new WeatherError(res.status === 429 ? "rate_limited" : "upstream", `Open-Meteo answered ${res.status}${reason ? `: ${reason}` : ""}`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WeatherError("bad_response", "Open-Meteo returned invalid JSON");
  }
  if (body && typeof body === "object" && "error" in body && (body as { error: unknown }).error) {
    throw new WeatherError("bad_response", String((body as { reason?: string }).reason ?? "error"));
  }
  // The response Date survives Next's fetch cache; do not label a cached body as newly fetched.
  const responseDate = Date.parse(res.headers.get("date") ?? "");
  return {
    locations: Array.isArray(body) ? (body as OpenMeteoLocation[]) : [body as OpenMeteoLocation],
    fetchedAt: new Date(Number.isFinite(responseDate) ? responseDate : Date.now()).toISOString(),
  };
}

function coordParams(coords: Coord[]) {
  return {
    latitude: coords.map((c) => c.lat.toFixed(4)).join(","),
    longitude: coords.map((c) => c.lon.toFixed(4)).join(","),
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function fetchWeather(coords: Coord[]): Promise<WeatherBundle> {
  if (coords.length === 0) return { fetchedAt: new Date().toISOString(), series: [], airError: null };

  const forecastQs = new URLSearchParams({
    ...coordParams(coords),
    hourly: FORECAST_VARS.join(","),
    forecast_days: "8",
    timezone: "Asia/Riyadh",
  });
  const airQs = new URLSearchParams({
    ...coordParams(coords),
    hourly: AIR_VARS.join(","),
    forecast_days: "7", // the air-quality API allows at most 7 days
    timezone: "Asia/Riyadh",
  });

  const [forecastResult, airResult] = await Promise.allSettled([
    getJson(`${FORECAST_URL}?${forecastQs}`),
    getJson(`${AIR_URL}?${airQs}`),
  ]);

  // Without the weather forecast there is nothing honest to show.
  if (forecastResult.status === "rejected") throw forecastResult.reason;
  const forecast = forecastResult.value.locations;
  if (forecast.length !== coords.length) {
    throw new WeatherError("bad_response", "Open-Meteo returned an unexpected number of locations");
  }

  const air = airResult.status === "fulfilled" ? airResult.value.locations : null;
  const airError =
    airResult.status === "rejected"
      ? airResult.reason instanceof WeatherError
        ? airResult.reason.code
        : "upstream"
      : null;

  const series: SiteSeries[] = forecast.map((loc, i) => {
    const h = loc.hourly ?? {};
    const times = (h.time as string[] | undefined) ?? [];
    if (!times.length) throw new WeatherError("bad_response", "Forecast had no hourly data");

    const airLoc = air?.[i];
    const airTimes = (airLoc?.hourly?.time as string[] | undefined) ?? [];
    const airIndex = new Map(airTimes.map((t, j) => [t, j] as const));
    const dust = airLoc?.hourly?.dust as (number | null)[] | undefined;
    const pm10 = airLoc?.hourly?.pm10 as (number | null)[] | undefined;

    const hours: HourPoint[] = times.map((time, j) => {
      const k = airIndex.get(time);
      return {
        time,
        temp: num((h.temperature_2m as number[] | undefined)?.[j]),
        feels: num((h.apparent_temperature as number[] | undefined)?.[j]),
        wind: num((h.wind_speed_10m as number[] | undefined)?.[j]),
        gust: num((h.wind_gusts_10m as number[] | undefined)?.[j]),
        precipProb: num((h.precipitation_probability as number[] | undefined)?.[j]),
        precip: num((h.precipitation as number[] | undefined)?.[j]),
        cloud: num((h.cloud_cover as number[] | undefined)?.[j]),
        dust: k === undefined ? null : num(dust?.[k]),
        pm10: k === undefined ? null : num(pm10?.[k]),
      };
    });

    return {
      hours,
      airAvailable: Boolean(airLoc),
      units: { ...(loc.hourly_units ?? {}), ...(airLoc?.hourly_units ?? {}) },
    };
  });

  return { fetchedAt: forecastResult.value.fetchedAt, series, airError };
}
