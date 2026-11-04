import { DEFAULT_PREFS } from "./prefs-storage";
import type { Experience, Factor, PlanPrefs } from "./types";

/** The preferences the assistant (or a shared link) can tune beyond activity, night and group. */
export type Tune = Pick<PlanPrefs, "maxDriveHours" | "tempPref" | "windTolerance" | "priorities">;

export const DEFAULT_TUNE: Tune = {
  maxDriveHours: DEFAULT_PREFS.maxDriveHours,
  tempPref: DEFAULT_PREFS.tempPref,
  windTolerance: DEFAULT_PREFS.windTolerance,
  priorities: [],
};

/** One scored data set per activity and tuning. */
export const tuneKey = (m: Experience, t: Tune) => `${m}|${t.maxDriveHours}|${t.tempPref}|${t.windTolerance}|${t.priorities.join(",")}`;

const FACTORS = new Set(["temp", "wind", "rain", "dust", "clouds", "moon"]);

/** Tuned preferences from an address; anything invalid falls back to the default. */
export function tuneFromParams(sp: URLSearchParams): Tune {
  const drive = Number(sp.get("drive"));
  const temp = sp.get("temp");
  const wind = sp.get("wind");
  const pri = (sp.get("pri") ?? "").split(",").filter((f) => FACTORS.has(f)).slice(0, 3) as Factor[];
  return {
    maxDriveHours: drive >= 1.5 && drive <= 5 && drive * 2 === Math.round(drive * 2) ? drive : DEFAULT_TUNE.maxDriveHours,
    tempPref: temp === "cool" || temp === "warm" || temp === "mild" ? temp : DEFAULT_TUNE.tempPref,
    windTolerance: wind === "low" || wind === "high" || wind === "medium" ? wind : DEFAULT_TUNE.windTolerance,
    priorities: [...new Set(pri)],
  };
}
