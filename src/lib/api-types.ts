import type { NightMetrics, NightScore } from "./types";
import type { WeatherErrorCode } from "./weather";

export type NightSummary = Omit<NightMetrics, "hours">;
export type ScoreRow = Omit<NightScore, "metrics">;

export interface PlanResponse {
  generatedAt: string;
  forecastFetchedAt: string | null;
  nights: string[];
  considered: string[];
  excludedByDistance: string[];
  airQuality: { available: boolean; error: WeatherErrorCode | null };
  results: ScoreRow[];
  metrics: Record<string, NightSummary>;
  forecasts: Record<string, ForecastResponse>;
}

export interface ForecastResponse {
  slug: string;
  fetchedAt: string;
  nights: string[];
  airQuality: { available: boolean; error: WeatherErrorCode | null };
  /** Full nightly metrics including hourly points, for charts. */
  metrics: NightMetrics[];
  units: Record<string, string>;
}

export type ApiErrorCode =
  | "invalid_input"
  | "not_found"
  | "timeout"
  | "rate_limited"
  | "upstream"
  | "bad_response"
  | "ai_not_configured"
  | "ai_failed"
  | "ai_invalid_output"
  | "too_many_requests"
  | "internal";

export interface ApiError {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}
