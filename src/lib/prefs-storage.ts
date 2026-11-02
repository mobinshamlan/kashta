import type { PlanPrefs } from "./types";

export const DEFAULT_PREFS: PlanPrefs = {
  experience: "kashta",
  city: "riyadh",
  date: "flexible",
  groupSize: 5,
  maxDriveHours: 3,
  tempPref: "mild",
  windTolerance: "medium",
  priorities: [],
};

const KEY = "kashta:prefs:v1";

export function loadPrefs(): PlanPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = { ...DEFAULT_PREFS, ...JSON.parse(raw) } as PlanPrefs;
    // A stored specific date goes stale; fall back to flexible.
    if (p.date !== "flexible") p.date = "flexible";
    return p;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: PlanPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable (private mode); preferences just won't persist */
  }
}
