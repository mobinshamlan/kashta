import "server-only";
import type { ApiErrorCode } from "./api-types";
import { LlamaError } from "./llm";
import { WeatherError } from "./weather";

const STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  timeout: 504,
  rate_limited: 503,
  upstream: 502,
  bad_response: 502,
  ai_not_configured: 503,
  ai_failed: 502,
  ai_invalid_output: 502,
  too_many_requests: 429,
  internal: 500,
};

export function apiError(code: ApiErrorCode, message: string, details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status: STATUS[code] });
}

export function fromException(err: unknown) {
  if (err instanceof WeatherError) return apiError(err.code, err.message);
  if (err instanceof LlamaError) return apiError(err.code, err.message);
  console.error(err);
  return apiError("internal", "Unexpected server error");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/**
 * Small in-memory limiter for the AI routes (per server instance). It protects the free
 * Llama allocation from accidental loops; it is not a security boundary.
 */
const hits = new Map<string, number[]>();
export function rateLimited(request: Request, limit = 12, windowMs = 60_000): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}
