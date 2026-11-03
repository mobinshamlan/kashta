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
  return Response.json({ error: { code, message, details } }, {
    status: STATUS[code],
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Return request-specific API data without allowing a browser or shared cache to retain it. */
export function privateJson(body: unknown) {
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}

export function fromException(err: unknown) {
  if (err instanceof WeatherError) return apiError(err.code, err.message);
  if (err instanceof LlamaError) return apiError(err.code, err.message);
  console.error(err);
  return apiError("internal", "Unexpected server error");
}

export async function readJson(request: Request): Promise<unknown> {
  const maxBytes = 16 * 1024;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return undefined;

  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Small in-memory limiter for the AI routes (per server instance). It protects the free
 * Llama allocation from accidental loops; it is not a security boundary.
 */
const hits = new Map<string, number[]>();
let lastRateLimitSweep = 0;
export function rateLimited(request: Request, limit = 12, windowMs = 60_000): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  if (now - lastRateLimitSweep >= windowMs) {
    for (const [key, timestamps] of hits) {
      const active = timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (active.length === 0) hits.delete(key);
      else hits.set(key, active);
    }
    lastRateLimitSweep = now;
  }
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}
