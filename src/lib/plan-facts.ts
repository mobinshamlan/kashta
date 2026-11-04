import "server-only";
import { buildChecklist } from "./checklist";
import { DICTS } from "./i18n";
import { DESTINATIONS, DRIVE_MAX_HOURS, estimateDrive, getDestination, isRecommendable } from "./destinations";
import { eligibleDestinations, scoreDestinations } from "./planner";
import { NEARBY_TIE_POINTS, nightReasons } from "./reasons";
import type { Locale, NightScore, PlanPrefs } from "./types";

/** The forecast and scoring facts for one place and night, in the names Llama is given. */
export function factsFor(s: NightScore) {
  const m = s.metrics;
  return {
    date: s.date,
    kashtaScore: s.score,
    assessment: s.assessment,
    missingData: s.missing,
    dealbreakers: s.dealbreakers,
    factorScores: Object.fromEntries(s.factors.map((f) => [f.factor, f.score])),
    forecast: {
      eveningTempC: m.eveningTemp,
      lowestTempC: m.minTemp,
      lowestFeelsLikeC: m.minFeels,
      maxWindKmh: m.maxWind,
      maxGustKmh: m.maxGust,
      maxRainChancePct: m.maxPrecipProb,
      totalRainMm: m.totalPrecip,
      meanNightCloudPct: m.meanCloud,
      maxSurfaceDustUgm3: m.maxDust,
      sunset: m.sunset,
      astronomicalDusk: m.duskAstro,
      astronomicalDawn: m.dawnAstro,
      moonIlluminationPct: Math.round(m.moonIllumination * 100),
      moonFreeDarkHours: m.moonFreeDarkHours,
      darkHours: m.darkHours,
    },
  };
}

/**
 * Recomputes the scores for a place and night on the server (numbers sent by the browser are
 * never trusted) and returns the chosen night with the best scored alternatives.
 */
export async function scorePlan(slug: string, date: string, prefs: PlanPrefs) {
  const dest = getDestination(slug);
  if (!dest) return null;
  const { considered } = eligibleDestinations({ ...prefs, maxDriveHours: DRIVE_MAX_HOURS });
  const pool = considered.some((d) => d.slug === slug) ? considered : [...considered, dest];
  const { scores } = await scoreDestinations({ ...prefs, date: "flexible" }, pool);
  const chosen = scores.find((s) => s.slug === slug && s.date === date);
  if (!chosen) return null;
  const inReach = scores
    .filter((s) => s.score !== null && !(s.slug === slug && s.date === date))
    .filter((s) => isRecommendable(getDestination(s.slug)!))
    .filter((s) => estimateDrive(getDestination(s.slug)!, prefs.city).hours <= prefs.maxDriveHours);
  // The night's pick follows the app's rule (rankNight): within NEARBY_TIE_POINTS of the top score, the nearest place wins.
  const night = [chosen, ...inReach.filter((s) => s.date === date)].filter((s) => s.score !== null);
  const top = Math.max(...night.map((s) => s.score!));
  const hours = (s: NightScore) => estimateDrive(getDestination(s.slug)!, prefs.city).hours;
  const pick = night.filter((s) => s.score! >= top - NEARBY_TIE_POINTS).sort((a, b) => hours(a) - hours(b) || b.score! - a.score!)[0];
  const better = pick && pick !== chosen ? night.filter((s) => s !== chosen && s.score! > (chosen.score ?? -1)).slice(0, 3) : [];
  return { dest, chosen, alternatives: inReach.slice(0, 3), isPick: pick === chosen, better };
}

/** Everything the assistant may say about the selected plan: forecast, ranking, drive, permit and checklist. */
export function answerFacts(plan: NonNullable<Awaited<ReturnType<typeof scorePlan>>>, prefs: PlanPrefs, locale: Locale) {
  const { dest, chosen, isPick, better } = plan;
  const drive = estimateDrive(dest, prefs.city);
  const name = (slug: string) => DESTINATIONS.find((d) => d.slug === slug)!.name[locale];
  // A chat answer names a few items; the plan keeps the full list. The permit and this night's
  // weather or sky items lead, then the basics.
  const checklist = buildChecklist({ experience: prefs.experience, groupSize: prefs.groupSize, metrics: chosen.metrics, permitStatus: dest.permit.status });
  const rank = (i: (typeof checklist)[number]) => (i.id === "permit" ? 0 : i.group === "weather" || i.group === "stars" ? 1 : ["water", "fuelwood", "firstaid"].includes(i.id) ? 2 : 3);
  const keyItems = [...checklist].sort((a, b) => rank(a) - rank(b)).slice(0, 5);
  // The same reasons the plan card shows, so the chat never disagrees with the page.
  const reasons = nightReasons(chosen, chosen.metrics, 3).map((r) => ({ condition: r.factor, verdict: r.tone === "good" ? "helped" : "held it back", measured: r.values }));
  const rounded = Object.fromEntries(Object.entries(factsFor(chosen).forecast).map(([k, v]) => [k, typeof v === "number" ? Math.round(v) : v]));
  return {
    selectedPlace: {
      name: dest.name[locale],
      governorate: dest.governorate[locale],
      terrain: dest.terrain,
      estimatedDriveFromStart: { startCity: DICTS[locale].common.cities[prefs.city], hours: drive.hours, roadKm: drive.roadKm, note: "rough estimate, not a routed travel time" },
      permit: { status: dest.permit.status, notes: dest.permit.notes[locale], checkedOn: dest.permit.checkedOn },
    },
    group: { people: prefs.groupSize, activity: prefs.experience, tempPref: prefs.tempPref, windTolerance: prefs.windTolerance, maxDriveHours: prefs.maxDriveHours, priorities: prefs.priorities },
    selectedNight: {
      date: chosen.date,
      kashtaScore: chosen.score,
      assessment: chosen.assessment,
      missingData: chosen.missing,
      dealbreakers: chosen.dealbreakers,
      otherForecastDetails: rounded,
    },
    whyThisPlace: {
      mainReasons: reasons,
      rankedFirstWithinDriveLimitThatNight: isPick,
      scoredHigherThatNight: better.map((s) => name(s.slug)),
    },
    howKashtaChooses: "Every place within the drive limit is scored per night from the forecast (temperature, wind, rain, dust, clouds and, for stargazing, moonlight), weighted by the group's preferences. The highest score is recommended.",
    packingChecklist: { keyItems: keyItems.map((i) => i.label[locale]), totalItemsInPlan: checklist.length },
  };
}
