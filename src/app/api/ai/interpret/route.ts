import { collectNumbers, extractJson, hasInternalKey, isGrounded } from "@/lib/ai-guards";
import { apiError, fromException, privateJson, rateLimited, readJson } from "@/lib/http";
import { chatLlama, llamaConfig } from "@/lib/llm";
import { upcomingNights } from "@/lib/nights";
import { applyInterpretationGuards, chatIntent } from "@/lib/interpretation";
import { answerFacts, scorePlan } from "@/lib/plan-facts";
import { chatAnswerSchema, interpretRequestSchema, interpretedPrefsSchema } from "@/lib/schemas";
import type { Locale, PlanPrefs } from "@/lib/types";

const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function systemPrompt(nights: string[], language: string) {
  const calendar = nights
    .map((d, i) => {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      return `${d} = ${WEEKDAYS_AR[wd]} / ${WEEKDAYS_EN[wd]}${i === 0 ? " (tonight / الليلة)" : ""}`;
    })
    .join("\n");

  return `The user writes in ${language}; any text you write must be in ${language}.
You are KASHTA's trip assistant for kashta (كشتة) and stargazing trips in Saudi Arabia. Classify the user's message and, when they clearly ask to change their plan, convert it into planner settings.
Reply with ONE JSON object and nothing else. Only include a field when the user clearly said it; otherwise omit it.
If the message is a question about KASHTA, set only "question": true. That includes why a place or night was recommended, the selected place, the forecast or what a value means, the drive, permits, what to bring, and kashta or stargazing in Saudi Arabia. Another step answers it from the app's data; never answer it yourself and never turn a question into settings.
Only for messages genuinely unrelated to KASHTA (jokes, other topics), set only "redirect" to one or two short, warm sentences in the user's language that invite them back to planning their kashta or stargazing night. A light Saudi-style joke is fine when it fits; never mock the user.
For serious safety concerns, set only "redirect" to calm, direct safety guidance in the user's language. Do not joke; if there may be immediate danger, urge the user to move to safety and contact local emergency services.
When "question" or "redirect" is present, do not include any planning fields.
Never infer a preference from the planner's defaults or from the user's activity alone. Only set group size when a headcount is stated, temperature when a temperature preference is stated, and driving hours when a limit is stated.

Fields:
- "experience": "kashta" (camping, fire, gathering) or "stars" (stargazing, نجوم, درب التبانة).
- "groupSize": integer number of people (e.g. "حنا خمسة" = 5).
- "tempPref": "cool" | "mild" | "warm" — the evening temperature they want.
- "windTolerance": "low" (they hate wind / wind matters a lot) | "medium" | "high" (wind does not bother them).
- "maxDriveHours": number, maximum one-way driving hours (0.5–6).
- "date": "flexible" for "هالأسبوع", "هالاسبوع", "هذا الأسبوع", "this week" or any night in the coming week; otherwise one date from the calendar below when they name a specific day ("الخميس", "tonight", "بكرة"). Do not mark a recognized week phrase unclear.
  Nights are dated by the evening they start. In Saudi Arabic «ليلة <day>» means the night BEFORE that day: «ليلة الجمعة» = the Thursday evening date, «ليلة السبت» = the Friday evening date. A bare day name («يوم الخميس», «الخميس») or English "Friday night" means that day's own evening.
- "priorities": up to 3 of "temp","wind","rain","dust","clouds","moon" that they said matter most.
  ("غبار" = dust, "هوا/رياح" = wind, "مطر" = rain, "غيوم/سماء صافية" = clouds, "ظلام/بدون قمر" = moon. A request to see or watch the moon is not a dark-sky preference; do not add "moon" for it. This planner cannot optimize moon viewing, so put that request in "unclear".)
- "summary": one short sentence in the same language that lists the settings understood. Do not copy or paraphrase the full original description.
- "unclear": list of short phrases from the user you could not map to a field.
- "question": true when the user asks about KASHTA rather than asking to change the plan.
- "redirect": a short same-language response only for unrelated requests or serious safety concerns. Leave it out for anything about KASHTA.

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
        { role: "system", content: systemPrompt(nights, writesArabic(parsed.data.text, parsed.data.locale) ? "Arabic" : "English") },
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
    const intent = chatIntent(parsed.data.text, result.data);
    const lang: Locale = writesArabic(parsed.data.text, parsed.data.locale) ? "ar" : "en";
    if (intent === "redirect") {
      const redirect = result.data.redirect!;
      return privateJson({ redirect: inLanguage(redirect, lang) ? redirect : REDIRECT[lang] });
    }
    if (intent === "question") return privateJson({ answer: await answer(parsed.data.text, lang, parsed.data.context ?? null) });

    const guarded = applyInterpretationGuards(parsed.data.text, result.data);
    const prefs = guarded.prefs;
    // The planner writes its own summary from the guarded settings; Llama's sentence may predate the guards.
    prefs.summary = null;
    // Saudi usage: «ليلة الجمعة» is the night before Friday, i.e. the Thursday evening. Settle it from
    // the text itself rather than trusting the model with the convention.
    const laylat = parsed.data.text.match(/ليل(?:ة|ه)\s+(?:يوم\s+)?(الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت)/u);
    if (laylat) {
      const day = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].indexOf(laylat[1].replace("الاحد", "الأحد").replace("الإثنين", "الاثنين").replace("الاربعاء", "الأربعاء"));
      const eve = nights.find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === (day + 6) % 7);
      if (day >= 0) prefs.date = eve ?? null;
    }
    // A date must be one of the seven nights we can forecast; anything else is discarded.
    if (prefs.date && prefs.date !== "flexible" && !nights.includes(prefs.date)) prefs.date = null;
    if (prefs.priorities) prefs.priorities = [...new Set(prefs.priorities)];

    return privateJson({ prefs, unsupported: guarded.unsupported, model: reply.model, provider: reply.provider });
  } catch (err) {
    return fromException(err);
  }
}

const REDIRECT: Record<Locale, string> = {
  ar: "هذي برا اختصاصي 😄 بس إذا ودك بكشتة أو ليلة نجوم، أنا حاضر.",
  en: "That's outside my patch of desert! Ask me about a kashta or a stargazing night instead.",
};

/** The language the user wrote in; the page's language only when the text has no letters. */
const writesArabic = (text: string, locale: Locale) => (/[\u0600-\u06FF]/u.test(text) ? true : /[A-Za-z]/u.test(text) ? false : locale === "ar");
const inLanguage = (x: string, locale: Locale) => (locale === "ar" ? /[\u0600-\u06FF]/u.test(x) : !/[\u0600-\u06FF]/u.test(x));

/**
 * Answers a question from the plan on screen, recomputed on the server. Returns null when the
 * reply quotes a number the facts don't contain or drifts language; the chat then shows the
 * app's own reasons instead. Answering never changes preferences.
 */
async function answer(text: string, locale: Locale, context: { slug: string; date: string; prefs: PlanPrefs } | null): Promise<string | null> {
  const plan = context ? await scorePlan(context.slug, context.date, context.prefs) : null;
  const facts = plan && context
    ? answerFacts(plan, context.prefs, locale)
    : { selectedPlace: null, note: context ? "The selected night is no longer in the seven-day forecast; ask them to pick a new night." : "The user has not picked a place and night yet." };
  const language = locale === "ar" ? "Arabic (natural Saudi tone, not heavy slang)" : "English";
  const system = `You are KASHTA's trip assistant. KASHTA recommends an upcoming night and a verified place near Riyadh for a kashta (desert camping) or stargazing, from the forecast.
Answer the user's question in ${language}, in at most three short sentences. Use ONLY the facts JSON below for anything about the selected place, night, forecast, drive, permit, ranking or packing.
- "Why this place": in two short sentences, use whyThisPlace only: describe each mainReasons condition with its measured value and unit (evening/coldest °C, gust km/h, rain chance %, cloud %, dust µg/m³, moon-free dark hours), then, only if rankedFirstWithinDriveLimitThatNight is true, say it ranked first within the drive limit that night; otherwise say it is the place they picked and name scoredHigherThatNight. Do not use otherForecastDetails for this. It is a forecast: say "expected".
- otherForecastDetails: use only when the user asks about a specific value.
- A forecast value: say what it means for this night in plain words (for example 0% cloud means a clear sky is expected).
- Packing: list packingChecklist.keyItems as written, then say the full list of totalItemsInPlan items is in the plan. Never add items.
- Drive: it is a rough estimate. Permit: repeat the permit facts only; never claim legality beyond them.
- General kashta or stargazing questions in Saudi Arabia: brief, practical, no numbers, places or permit claims that are not in the facts.
- If selectedPlace is null and the question is about the plan, ask them to pick a place and night first.
- Quote measurements with their units exactly as given. Never quote scores. Never invent weather, places, permits, reasons or measurements. Never write JSON field names.
- Do not offer to change settings; this is only an answer.
Reply with ONE JSON object and nothing else: {"answer": string}

Facts:
${JSON.stringify(facts)}`;

  const reply = await chatLlama(
    [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    { maxTokens: 350, temperature: 0.2 },
  );
  let raw: unknown;
  try {
    raw = extractJson(reply.content);
  } catch {
    return null;
  }
  const result = chatAnswerSchema.safeParse(raw);
  if (!result.success) return null;
  const out = result.data.answer;
  // Numbers must come from the facts (or the user's own message); 0–10 covers counts like "three items".
  const allowed = [...collectNumbers(facts), ...collectNumbers(text), 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  if (hasInternalKey(out) || !inLanguage(out, locale) || !isGrounded(out, allowed)) return null;
  return out;
}
