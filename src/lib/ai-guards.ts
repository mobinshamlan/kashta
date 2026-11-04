/**
 * Guards applied to everything Llama writes before it reaches the page.
 * Pure functions so they can be unit-tested without the network.
 */

/** Pulls the first JSON object out of a model reply (models sometimes wrap it in prose or fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(candidate.slice(start, end + 1));
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normaliseDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d))).replace(/٫/g, ".");
}

export function numbersIn(text: string): number[] {
  return (normaliseDigits(text).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * True when every number in `text` matches a number we gave the model (within 0.5).
 * Stops Llama from inventing measurements: a sentence quoting a temperature or wind speed
 * that is not in the forecast we passed is dropped.
 */
export function isGrounded(text: string, allowed: number[]): boolean {
  return numbersIn(text).every((n) => allowed.some((a) => Math.abs(a - n) <= 0.5));
}

export function keepGrounded(items: string[], allowed: number[]): { kept: string[]; dropped: number } {
  const kept = items.filter((t) => isGrounded(t, allowed));
  return { kept, dropped: items.length - kept.length };
}

/** Collects every number in a facts object so the guard knows what Llama may quote. */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    out.push(value, Math.round(value));
  } else if (typeof value === "string") {
    out.push(...numbersIn(value));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectNumbers(v, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectNumbers(v, out));
  }
  return out;
}

/** Internal field names (camelCase or snake_case identifiers) must never reach the visitor. */
export function hasInternalKey(text: string): boolean {
  return /\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[a-z]+_[a-z_]+\b/u.test(text);
}
