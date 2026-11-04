import { DEFAULT_PREFS } from "./prefs-storage";
import { DRIVE_MAX_HOURS, DRIVE_MIN_HOURS } from "./destinations";
import { CITY_IDS, type CityId, type Experience, type Factor, type PlanPrefs } from "./types";

/** The preferences the assistant (or a shared link) can tune beyond activity, night and group. */
export type Tune = Pick<PlanPrefs, "city" | "maxDriveHours" | "tempPref" | "windTolerance" | "priorities">;

export const DEFAULT_TUNE: Tune = {
  city: DEFAULT_PREFS.city,
  maxDriveHours: DEFAULT_PREFS.maxDriveHours,
  tempPref: DEFAULT_PREFS.tempPref,
  windTolerance: DEFAULT_PREFS.windTolerance,
  priorities: [],
};

/** One scored data set per activity and tuning. */
export const tuneKey = (m: Experience, t: Tune) => `${m}|${t.city}|${t.maxDriveHours}|${t.tempPref}|${t.windTolerance}|${t.priorities.join(",")}`;

const FACTORS = new Set(["temp", "wind", "rain", "dust", "clouds", "moon"]);

/** Tuned preferences from an address; anything invalid falls back to the default. */
export function tuneFromParams(sp: URLSearchParams): Tune {
  const city = sp.get("city");
  const drive = Number(sp.get("drive"));
  const temp = sp.get("temp");
  const wind = sp.get("wind");
  const pri = (sp.get("pri") ?? "").split(",").filter((f) => FACTORS.has(f)).slice(0, 3) as Factor[];
  return {
    city: CITY_IDS.includes(city as CityId) ? (city as CityId) : DEFAULT_TUNE.city,
    maxDriveHours: drive >= DRIVE_MIN_HOURS && drive <= DRIVE_MAX_HOURS && drive * 2 === Math.round(drive * 2) ? drive : DEFAULT_TUNE.maxDriveHours,
    tempPref: temp === "cool" || temp === "warm" || temp === "mild" ? temp : DEFAULT_TUNE.tempPref,
    windTolerance: wind === "low" || wind === "high" || wind === "medium" ? wind : DEFAULT_TUNE.windTolerance,
    priorities: [...new Set(pri)],
  };
}
