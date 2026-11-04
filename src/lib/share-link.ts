import { z } from "zod";
import { getDestination } from "./destinations";
import { FACTORS, type Factor, type PlanPrefs } from "./types";

export type SharedPlan = {
  slug: string;
  /** The night the sender selected, whether or not it is still in the forecast window. */
  night: string;
  prefs: PlanPrefs;
};

export type ShareSearchParams = Record<string, string | string[] | undefined>;

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
});

const factorListSchema = z.array(z.enum(FACTORS as [Factor, ...Factor[]])).max(3).refine(
  (factors) => new Set(factors).size === factors.length,
);

const asText = (v: unknown) => (typeof v === "number" ? String(v) : v);

const sharePayloadSchema = z.object({
  destination: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  night: daySchema,
  experience: z.enum(["kashta", "stars"]),
  // Query values arrive as strings, the builder passes numbers; both must be plain decimals
  // the planner's controls can show (1–40 people, 1–5 hours in half-hour steps).
  groupSize: z.preprocess(asText, z.string().regex(/^\d{1,2}$/).transform(Number).pipe(z.number().int().min(1).max(40))),
  maxDriveHours: z.preprocess(asText, z.string().regex(/^\d(?:\.5)?$/).transform(Number).pipe(z.number().min(1).max(5))),
  tempPref: z.enum(["cool", "mild", "warm"]),
  windTolerance: z.enum(["low", "medium", "high"]),
  priorities: factorListSchema,
});

export function parsePlanShareParams(params: ShareSearchParams):
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "valid"; value: SharedPlan } {
  if (params.share === undefined) return { kind: "none" };
  if (params.share !== "1" || typeof params.share !== "string") return { kind: "invalid" };

  const get = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const priorities = get("priorities");
  if (priorities === undefined) return { kind: "invalid" };

  const parsed = sharePayloadSchema.safeParse({
    destination: get("destination"),
    night: get("night"),
    experience: get("experience"),
    groupSize: get("groupSize"),
    maxDriveHours: get("maxDriveHours"),
    tempPref: get("tempPref"),
    windTolerance: get("windTolerance"),
    priorities: priorities === "" ? [] : priorities.split(","),
  });
  if (!parsed.success) return { kind: "invalid" };

  const destination = getDestination(parsed.data.destination);
  if (!destination || !destination.experiences.includes(parsed.data.experience)) return { kind: "invalid" };

  return {
    kind: "valid",
    value: {
      slug: parsed.data.destination,
      night: parsed.data.night,
      prefs: {
        city: "riyadh",
        date: "flexible",
        experience: parsed.data.experience,
        groupSize: parsed.data.groupSize,
        maxDriveHours: parsed.data.maxDriveHours,
        tempPref: parsed.data.tempPref,
        windTolerance: parsed.data.windTolerance,
        priorities: parsed.data.priorities,
      },
    },
  };
}

/** Build a compact, versioned link containing trip preferences only; free-text descriptions and forecast data are never serialized. */
export function buildPlanShareUrl(origin: string, slug: string, night: string, prefs: PlanPrefs): string | null {
  const priorities = [...new Set(prefs.priorities)].slice(0, 3);
  const parsed = sharePayloadSchema.safeParse({
    destination: slug,
    night,
    experience: prefs.experience,
    groupSize: prefs.groupSize,
    maxDriveHours: prefs.maxDriveHours,
    tempPref: prefs.tempPref,
    windTolerance: prefs.windTolerance,
    priorities,
  });
  const destination = getDestination(slug);
  if (!parsed.success || !destination || !destination.experiences.includes(prefs.experience)) return null;

  try {
    const url = new URL("/plan", origin);
    url.searchParams.set("share", "1");
    url.searchParams.set("destination", parsed.data.destination);
    url.searchParams.set("night", parsed.data.night);
    url.searchParams.set("experience", parsed.data.experience);
    url.searchParams.set("groupSize", String(parsed.data.groupSize));
    url.searchParams.set("maxDriveHours", String(parsed.data.maxDriveHours));
    url.searchParams.set("tempPref", parsed.data.tempPref);
    url.searchParams.set("windTolerance", parsed.data.windTolerance);
    url.searchParams.set("priorities", parsed.data.priorities.join(","));
    return url.toString();
  } catch {
    return null;
  }
}
