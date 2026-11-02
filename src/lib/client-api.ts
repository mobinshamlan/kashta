import type { ApiErrorCode } from "./api-types";

export type ClientErrorCode = ApiErrorCode | "network";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ClientErrorCode; message?: string };

/** fetch wrapper for our own API routes: never throws, always returns a typed result. */
export async function callApi<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    return { ok: false, code: "network" };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return { ok: false, code: res.ok ? "bad_response" : "internal" };
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: ApiErrorCode; message?: string } })?.error;
    return { ok: false, code: err?.code ?? "internal", message: err?.message };
  }
  return { ok: true, data: body as T };
}
