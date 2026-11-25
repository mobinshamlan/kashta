export type Locale = "ar" | "en";
export type Localized = { ar: string; en: string };

export type Experience = "kashta" | "stars";
export type CityId = "riyadh" | "jeddah" | "makkah" | "madinah" | "dammam" | "buraydah" | "abha";
export const CITY_IDS = ["riyadh", "jeddah", "makkah", "madinah", "dammam", "buraydah", "abha"] as const satisfies readonly CityId[];
export type TempPref = "cool" | "mild" | "warm";
export type WindTolerance = "low" | "medium" | "high";
export type Factor = "temp" | "wind" | "rain" | "dust" | "clouds" | "moon";

export const FACTORS: Factor[] = ["temp", "wind", "rain", "dust", "clouds", "moon"];

export type PermitStatus =
  | "verified_permitted"
  | "permit_required"
  | "restricted"
  | "unverified";

export type Terrain = "dunes" | "park" | "meadow";

export interface Permit {
  status: PermitStatus;
  sourceTitle: Localized;
  sourceUrl: string;
  /** ISO date the source was last read by a person. */
  checkedOn: string;
  notes: Localized;
  applyUrl?: string;
}

export interface Destination {
  slug: string;
  name: Localized;
  governorate: Localized;
  /** The administrative region, as the NCVC guide groups its sites. */
  region: Localized;
  lat: number;
  lon: number;
  terrain: Terrain;
  description: Localized;
  facts: { ar: string[]; en: string[] };
  experiences: Experience[];
  capacity: { camping: number | null; caravans: number | null };
  photo: PhotoKey;
  /** Map link published by the managing authority, when one exists. */
  officialMapUrl?: string;
  permit: Permit;
  sources: { title: Localized; url: string }[];
}

export type PhotoKey =
  | "dahna-ridge"
  | "dahna-ripples"
  | "dahna-crest"
  | "tawqi-dune"
  | "tuwaiq-haze"
  | "tuwaiq-canyon"
  | "tuwaiq-mesa"
  | "dusty-plain"
  | "camp-night"
  | "alula-sky"
  | "dallah";

export interface PlanPrefs {
  experience: Experience;
  /** Where the trip starts; drive times are estimated from here. */
  city: CityId;
  date: "flexible" | string;
  groupSize: number;
  maxDriveHours: number;
  tempPref: TempPref;
  windTolerance: WindTolerance;
  priorities: Factor[];
}

export interface HourPoint {
  time: string; // local Riyadh time, e.g. 2026-11-02T18:00
  temp: number | null;
  feels: number | null;
  wind: number | null;
  gust: number | null;
  precipProb: number | null;
  precip: number | null;
  cloud: number | null;
  dust: number | null;
  pm10: number | null;
}

export interface NightMetrics {
  date: string; // evening date (YYYY-MM-DD)
  eveningTemp: number | null;
  minTemp: number | null;
  minFeels: number | null;
  maxWind: number | null;
  maxGust: number | null;
  maxPrecipProb: number | null;
  totalPrecip: number | null;
  meanCloud: number | null;
  maxDust: number | null;
  meanDust: number | null;
  maxPm10: number | null;
  sunset: string | null; // HH:mm local
  duskAstro: string | null;
  dawnAstro: string | null;
  moonIllumination: number; // 0..1
  moonWaxing: boolean;
  moonFreeDarkHours: number;
  darkHours: number;
  hours: HourPoint[];
}

export interface FactorScore {
  factor: Factor;
  score: number | null; // 0..100, null when data missing
  weight: number; // normalised 0..1
  value: string | null; // human-readable measurement, e.g. "38 km/h"
}

export interface NightScore {
  slug: string;
  date: string;
  score: number | null;
  assessment: "complete" | "incomplete";
  missing: Factor[];
  dealbreakers: Factor[];
  factors: FactorScore[];
  metrics: NightMetrics;
}
