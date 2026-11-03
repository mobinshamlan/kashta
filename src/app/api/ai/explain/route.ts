import { collectNumbers, extractJson, keepGrounded } from "@/lib/ai-guards";
import { DESTINATIONS, estimateDrive, getDestination, isRecommendable } from "@/lib/destinations";
import { apiError, fromException, privateJson, rateLimited, readJson } from "@/lib/http";
import { chatLlama, llamaConfig } from "@/lib/llm";
import { eligibleDestinations, scoreDestinations } from "@/lib/planner";
import { explainRequestSchema, explanationSchema } from "@/lib/schemas";
import type { NightScore } from "@/lib/types";

function factsFor(s: NightScore) {
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

export async function POST(request: Request) {
  if (rateLimited(request)) return apiError("too_many_requests", "Too many AI requests, try again in a minute");
  const parsed = explainRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("invalid_input", "Invalid request", parsed.error.issues);
  if (!llamaConfig().configured) return apiError("ai_not_configured", "No Llama provider is configured");
  const { slug, date, prefs, locale } = parsed.data;

  const dest = getDestination(slug);
  if (!dest) return apiError("not_found", "Unknown destination");

  try {
    // Recompute on the server: numbers sent by the browser are never trusted.
    const { considered } = eligibleDestinations({ ...prefs, maxDriveHours: 6 });
    const pool = considered.some((d) => d.slug === slug) ? considered : [...considered, dest];
    const { scores } = await scoreDestinations({ ...prefs, date: "flexible" }, pool);
    const chosen = scores.find((s) => s.slug === slug && s.date === date);
    if (!chosen) return apiError("invalid_input", "That night is outside the seven-day forecast");

    const alternatives = scores
      .filter((s) => s.score !== null && !(s.slug === slug && s.date === date))
      .filter((s) => isRecommendable(getDestination(s.slug)!))
      .filter((s) => estimateDrive(getDestination(s.slug)!).hours <= prefs.maxDriveHours)
      .slice(0, 3);

    const facts = {
      destination: {
        slug,
        name: dest.name[locale],
        governorate: dest.governorate[locale],
        approxDriveHoursFromRiyadh: estimateDrive(dest).hours,
        terrain: dest.terrain,
      },
      group: { people: prefs.groupSize, experience: prefs.experience, tempPref: prefs.tempPref, windTolerance: prefs.windTolerance, priorities: prefs.priorities },
      chosenNight: factsFor(chosen),
      candidateAlternatives: alternatives.map((a) => ({
        slug: a.slug,
        name: DESTINATIONS.find((d) => d.slug === a.slug)!.name[locale],
        ...factsFor(a),
      })),
    };

    const language = locale === "ar" ? "Arabic (natural Saudi tone, not heavy slang)" : "English";
    const system = `You are KASHTA's trip assistant for desert camping near Riyadh.
Write in ${language}. Use ONLY the facts in the JSON the user sends. Rules:
- Quote numbers exactly as given; never invent or estimate any measurement, distance, time or score.
- Do not say anything about whether camping is legal or permitted; the app shows official permit information separately.
- Do not describe the landscape, facilities or road conditions; you were not given that information.
- If assessment is "incomplete", say which data is missing instead of judging it.
- "alternative" must be one of candidateAlternatives (copy its slug and date) or null.
Reply with ONE JSON object and nothing else:
{"summary": string, "reasons": string[] (max 4), "cautions": string[] (max 4), "packing": string[] (max 6, specific to these conditions and group size), "preparations": string[] (max 4), "alternative": {"slug": string, "date": "YYYY-MM-DD", "why": string} | null}`;

    const reply = await chatLlama(
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(facts) },
      ],
      { maxTokens: 900, temperature: 0.3 },
    );

    let raw: unknown;
    try {
      raw = extractJson(reply.content);
    } catch {
      return apiError("ai_invalid_output", "Llama did not return JSON");
    }
    const result = explanationSchema.safeParse(raw);
    if (!result.success) return apiError("ai_invalid_output", "Llama returned an explanation in an unexpected shape", result.error.issues);

    const out = result.data;
    const allowed = [...collectNumbers(facts), 1, 2, 3, 4];
    let dropped = 0;
    const guard = (list: string[]) => {
      const r = keepGrounded(list, allowed);
      dropped += r.dropped;
      return r.kept;
    };
    const summaryOk = keepGrounded([out.summary], allowed).kept.length === 1;
    if (!summaryOk) dropped += 1;

    let alternative = out.alternative ?? null;
    if (alternative && !alternatives.some((a) => a.slug === alternative!.slug && a.date === alternative!.date)) {
      alternative = null;
      dropped += 1;
    }
    if (alternative && !keepGrounded([alternative.why], allowed).kept.length) {
      alternative = { ...alternative, why: "" };
      dropped += 1;
    }

    return privateJson({
      explanation: {
        summary: summaryOk ? out.summary : null,
        reasons: guard(out.reasons),
        cautions: guard(out.cautions),
        packing: guard(out.packing),
        preparations: guard(out.preparations),
        alternative,
      },
      droppedForUngroundedNumbers: dropped,
      score: chosen.score,
      model: reply.model,
      provider: reply.provider,
    });
  } catch (err) {
    return fromException(err);
  }
}
