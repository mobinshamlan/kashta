import { extractJson } from "@/lib/ai-guards";
import { apiError, fromException, rateLimited, readJson } from "@/lib/http";
import { chatLlama, llamaConfig } from "@/lib/llm";
import { upcomingNights } from "@/lib/nights";
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

Fields:
- "experience": "kashta" (camping, fire, gathering) or "stars" (stargazing, نجوم, درب التبانة).
- "groupSize": integer number of people (e.g. "حنا خمسة" = 5).
- "tempPref": "cool" | "mild" | "warm" — the evening temperature they want.
- "windTolerance": "low" (they hate wind / wind matters a lot) | "medium" | "high" (wind does not bother them).
- "maxDriveHours": number, maximum one-way driving hours (0.5–6).
- "date": "flexible", or one date from the calendar below when they name a day ("الخميس", "tonight", "بكرة").
- "priorities": up to 3 of "temp","wind","rain","dust","clouds","moon" that they said matter most.
  ("غبار" = dust, "هوا/رياح" = wind, "مطر" = rain, "غيوم/سماء صافية" = clouds, "قمر/ظلام" = moon).
- "summary": one short sentence, in the same language as the user, restating what you understood.
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

    const prefs = result.data;
    // A date must be one of the seven nights we can forecast; anything else is discarded.
    if (prefs.date && prefs.date !== "flexible" && !nights.includes(prefs.date)) prefs.date = null;
    if (prefs.priorities) prefs.priorities = [...new Set(prefs.priorities)];

    return Response.json({ prefs, model: reply.model, provider: reply.provider });
  } catch (err) {
    return fromException(err);
  }
}
