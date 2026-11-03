import { extractJson } from "@/lib/ai-guards";
import { apiError, fromException, privateJson, rateLimited, readJson } from "@/lib/http";
import { chatLlama, llamaConfig } from "@/lib/llm";
import { upcomingNights } from "@/lib/nights";
import { applyInterpretationGuards } from "@/lib/interpretation";
import { interpretRequestSchema, interpretedPrefsSchema } from "@/lib/schemas";

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function systemPrompt(nights: string[]) {
  const calendar = nights
    .map((d, i) => {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      return `${d} = ${WEEKDAYS_AR[wd]} / ${WEEKDAYS_EN[wd]}${i === 0 ? " (tonight / الليلة)" : ""}`;
    })
    .join("\n");

  return `You convert a Saudi user's description of a desert camping trip (كشتة) into settings for a planner.
Reply with ONE JSON object and nothing else. Only include a field when the user clearly said or implied it; otherwise omit it.
Never infer a preference from the planner's defaults or from the user's activity alone. Only set group size when a headcount is stated, temperature when a temperature preference is stated, and driving hours when a limit is stated.

Fields:
- "experience": "kashta" (camping, fire, gathering) or "stars" (stargazing, نجوم, درب التبانة).
- "groupSize": integer number of people (e.g. "حنا خمسة" = 5).
- "tempPref": "cool" | "mild" | "warm" — the evening temperature they want.
- "windTolerance": "low" (they hate wind / wind matters a lot) | "medium" | "high" (wind does not bother them).
- "maxDriveHours": number, maximum one-way driving hours (0.5–6).
- "date": "flexible" for "هالأسبوع", "هالاسبوع", "هذا الأسبوع", "this week" or any night in the coming week; otherwise one date from the calendar below when they name a specific day ("الخميس", "tonight", "بكرة"). Do not mark a recognized week phrase unclear.
- "priorities": up to 3 of "temp","wind","rain","dust","clouds","moon" that they said matter most.
  ("غبار" = dust, "هوا/رياح" = wind, "مطر" = rain, "غيوم/سماء صافية" = clouds, "ظلام/بدون قمر" = moon. A request to see or watch the moon is not a dark-sky preference; do not add "moon" for it. This planner cannot optimize moon viewing, so put that request in "unclear".)
- "summary": one short sentence in the same language that lists the settings understood. Do not copy or paraphrase the full original description.
- "unclear": list of short phrases from the user you could not map to a field.

Calendar of the next seven nights (Riyadh time):
${calendar}

Never invent weather, places, permits or numbers. Never add fields that are not listed.`;
}

export async function POST(request: Request) {
  if (rateLimited(request)) return apiError("too_many_requests", "Too many AI requests, try again in a minute");
  const parsed = interpretRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError("invalid_input", "Describe your trip in a few words (4–600 characters)", parsed.error.issues);
  if (!llamaConfig().configured) return apiError("ai_not_configured", "No Llama provider is configured");

  const nights = upcomingNights();
  try {
    const reply = await chatLlama(
      [
        { role: "system", content: systemPrompt(nights) },
        { role: "user", content: parsed.data.text },
      ],
      { maxTokens: 400, temperature: 0 },
    );

    let raw: unknown;
    try {
      raw = extractJson(reply.content);
    } catch {
      return apiError("ai_invalid_output", "Llama did not return JSON");
    }
    const result = interpretedPrefsSchema.safeParse(raw);
    if (!result.success) return apiError("ai_invalid_output", "Llama returned settings in an unexpected shape", result.error.issues);

    const guarded = applyInterpretationGuards(parsed.data.text, result.data);
    const prefs = guarded.prefs;
    // The planner writes its own summary from the guarded settings; Llama's sentence may predate the guards.
    prefs.summary = null;
    // A date must be one of the seven nights we can forecast; anything else is discarded.
    if (prefs.date && prefs.date !== "flexible" && !nights.includes(prefs.date)) prefs.date = null;
    if (prefs.priorities) prefs.priorities = [...new Set(prefs.priorities)];

    return privateJson({ prefs, unsupported: guarded.unsupported, model: reply.model, provider: reply.provider });
  } catch (err) {
    return fromException(err);
  }
}
