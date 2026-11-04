import type { InterpretedPrefs } from "./schemas";

export type UnsupportedInterpretation = "moon_viewing";

const WEEK_PHRASE = /(?:هال(?:أ|ا)سبوع|(?:هذا|هاذا)\s+(?:الأسبوع|الاسبوع)|(?:الأسبوع|الاسبوع)\s+(?:هذا|هاذا)|this\s+week)/iu;
const WEEK_PHRASE_GLOBAL = /(?:هال(?:أ|ا)سبوع|(?:هذا|هاذا)\s+(?:الأسبوع|الاسبوع)|(?:الأسبوع|الاسبوع)\s+(?:هذا|هاذا)|this\s+week)/giu;
const SPECIFIC_DATE_OR_NIGHT = /(?:\b\d{4}-\d{2}-\d{2}\b|الليلة|اليوم|بكرة|بكره|غدًا|غدا|الأحد|الاحد|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/iu;
const POSITIVE_MOON_VIEWING = /(?:(?:نبي|نبغى|أبي|ابغى|أبغى|ابي|ودي|أود)\s+)?(?:نشوف|نشاهد|نرى|أشوف|اشوف|أشاهد|اشاهد)\s+(?:القمر|قمر)|\b(?:see|watch|view)\s+(?:the\s+)?moon\b/iu;
const EXPLICIT_DARK_SKY = /(?:ظلام|سماء\s+(?:مظلمة|داكنة)|بدون\s+(?:ضوء\s+)?القمر|ما\s+نبي\s+(?:ضوء\s+)?القمر|مانبي\s+(?:ضوء\s+)?القمر|moonless|no\s+moon(?:light)?|dark\s+sky|avoid\s+moonlight)/iu;
const GROUP_SIZE_MENTION = /(?:(?:حنا|احنا|إحنا|نحن|معنا|عددنا)\s*(?:عدد)?\s*(?:[0-9٠-٩]+|واحد|واحدة|أحد|احد|اثنين|اثنتين|ثلاث|ثلاثة|أربع|أربعة|اربع|اربعة|خمس|خمسة|ست|ستة|سبع|سبعة|ثمان|ثمانية|تسع|تسعة|عشر|عشرة)|(?:[0-9٠-٩]+|واحد|واحدة|أحد|احد|اثنين|اثنتين|ثلاث|ثلاثة|أربع|أربعة|اربع|اربعة|خمس|خمسة|ست|ستة|سبع|سبعة|ثمان|ثمانية|تسع|تسعة|عشر|عشرة|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:أشخاص|اشخاص|شخص|نفر|people|persons|of\s+us)|(?:we\s+are|we're|group\s+of|party\s+of)\s+(?:[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))/iu;
const KASHTA_MENTION = /(?:كشتة|كشته|نكشت|كشت|تخييم|نخيم|مخيم|جلسة|kashta|camp(?:ing|fire)?|bonfire|fire)/iu;
const STARS_MENTION = /(?:رصد|نجوم|النجوم|درب\s+التبانة|stargaz|\bstars?\b)/iu;

// Longest forms first so "تسعة" is not read as "تسع" + "ة", or "ستة" as "ست".
const NUMBER_WORDS: [string, number][] = [
  ["واحدة", 1], ["واحد", 1], ["اثنتين", 2], ["اثنين", 2], ["ثلاثة", 3], ["ثلاث", 3],
  ["أربعة", 4], ["اربعة", 4], ["أربع", 4], ["اربع", 4], ["خمسة", 5], ["خمس", 5],
  ["ستة", 6], ["ست", 6], ["سبعة", 7], ["سبع", 7], ["ثمانية", 8], ["ثمان", 8],
  ["تسعة", 9], ["تسع", 9], ["عشرة", 10], ["عشر", 10],
  ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6], ["seven", 7],
  ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12],
];
const NUMBER_TOKEN = `(?:[0-9٠-٩]{1,2}|${NUMBER_WORDS.map(([w]) => w).join("|")})`;
const GROUP_BEFORE = new RegExp(`(?:حنا|احنا|إحنا|نحن|معنا|عددنا|we\\s+are|we're|group\\s+of|party\\s+of)\\s*(?:عدد)?\\s*(${NUMBER_TOKEN})(?![\\p{L}])`, "iu");
const GROUP_AFTER = new RegExp(`(?<![\\p{L}])(${NUMBER_TOKEN})\\s*(?:أشخاص|اشخاص|شخص|نفر|people|persons|of\\s+us)`, "iu");

function toNumber(token: string): number | null {
  const digits = token.replace(/[٠-٩]/gu, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (/^\d+$/u.test(digits)) return Number(digits);
  return NUMBER_WORDS.find(([w]) => w === token.toLowerCase())?.[1] ?? null;
}

/** The headcount the user actually wrote, or null. Llama's number is never trusted over the text. */
export function extractGroupSize(text: string): number | null {
  const normalized = normalizeText(text);
  const m = normalized.match(GROUP_BEFORE) ?? normalized.match(GROUP_AFTER);
  if (!m) return null;
  const n = toNumber(m[1]);
  return n !== null && n >= 1 && n <= 40 ? n : null;
}
const TEMPERATURE_MENTION = /(?:حرارة|بارد|برد|معتدل|لطيف|دافئ|دافي|حار|حر|صقيع|جو\s+(?:بارد|معتدل|دافئ|دافي|حار)|temperature|cold|mild|warm|hot)/iu;
const WIND_MENTION = /(?:هوا|هواء|رياح|عواصف|عاصفة|wind)/iu;
const DRIVE_MENTION = /(?:قيادة|سواقة|سوق|ساعة|ساعات|بعيد|قريب|drive|hour|hours|far|near)/iu;
const AVOID_WIND = /(?:ما\s*نبي|مانبي|ما\s*(?:أبي|ابي)|مابغى|ما\s*ابغى|لا\s*(?:نبي|أبي|ابي)|no|avoid)\s*(?:هوا|هواء|رياح|wind)(?:\s+(?:قوي|شديد|strong))?/iu;
const LOW_WIND = /(?:هوا|هواء|رياح|wind)\s+(?:خفيف|قليل|هادئ|low|little)|\blow\s+wind\b/iu;
const AVOID_DUST = /(?:ما\s*نبي|مانبي|ما\s*(?:أبي|ابي)|مابغى|ما\s*ابغى|لا\s*(?:نبي|أبي|ابي)|no|avoid)\s*(?:(?:هوا|هواء|رياح|wind)\s*(?:و|and)\s*)?(?:غبار|تراب|dust)/iu;

function normalizeText(value: string) {
  return value.normalize("NFKC").replace(/[\u064B-\u065F\u0670]/gu, "").replace(/\s+/gu, " ").trim();
}

export function applyInterpretationGuards(
  text: string,
  input: InterpretedPrefs,
): { prefs: InterpretedPrefs; unsupported: UnsupportedInterpretation[] } {
  const normalizedText = normalizeText(text);
  const next: InterpretedPrefs = { ...input };

  const asksForWeek = WEEK_PHRASE.test(normalizedText);
  if (asksForWeek && !SPECIFIC_DATE_OR_NIGHT.test(normalizedText)) {
    next.date = "flexible";
  } else if (!SPECIFIC_DATE_OR_NIGHT.test(normalizedText)) {
    next.date = null;
  }

  // Headcount and experience come from the user's words; Llama only fills what the text cannot settle.
  const statedGroup = extractGroupSize(text);
  if (statedGroup !== null) next.groupSize = statedGroup;
  else if (!GROUP_SIZE_MENTION.test(normalizedText)) next.groupSize = null;

  const saysKashta = KASHTA_MENTION.test(normalizedText);
  const saysStars = STARS_MENTION.test(normalizedText);
  if (saysKashta && !saysStars) next.experience = "kashta";
  else if (saysStars && !saysKashta) next.experience = "stars";
  else if (!saysKashta && !saysStars) next.experience = null;
  if (!TEMPERATURE_MENTION.test(normalizedText)) next.tempPref = null;
  if (!WIND_MENTION.test(normalizedText)) next.windTolerance = null;
  if (!DRIVE_MENTION.test(normalizedText)) next.maxDriveHours = null;
  if (AVOID_WIND.test(normalizedText) || LOW_WIND.test(normalizedText)) next.windTolerance = "low";

  const mentionedFactors = new Set<string>();
  if (TEMPERATURE_MENTION.test(normalizedText)) mentionedFactors.add("temp");
  if (WIND_MENTION.test(normalizedText)) mentionedFactors.add("wind");
  if (/(?:غبار|تراب|dust)/iu.test(normalizedText)) mentionedFactors.add("dust");
  if (/(?:مطر|أمطار|امطار|rain)/iu.test(normalizedText)) mentionedFactors.add("rain");
  if (/(?:غيوم|غيم|سحاب|سماء\s+صافية|cloud|clear\s+sky)/iu.test(normalizedText)) mentionedFactors.add("clouds");
  if (EXPLICIT_DARK_SKY.test(normalizedText)) mentionedFactors.add("moon");
  const forcedPriorities: string[] = [];
  if (AVOID_WIND.test(normalizedText) || LOW_WIND.test(normalizedText)) forcedPriorities.push("wind");
  if (AVOID_DUST.test(normalizedText)) forcedPriorities.push("dust");
  if (next.priorities || forcedPriorities.length) {
    next.priorities = [...new Set([...(next.priorities ?? []).filter((factor) => mentionedFactors.has(factor)), ...forcedPriorities])].slice(0, 3) as InterpretedPrefs["priorities"];
  }

  if (input.unclear) {
    next.unclear = input.unclear.flatMap((item) => {
      const normalizedItem = normalizeText(item);
      if (normalizedItem === normalizedText) return [];
      if (asksForWeek && WEEK_PHRASE.test(normalizedItem)) {
        const remainder = normalizedItem.replace(WEEK_PHRASE_GLOBAL, "").replace(/[،,;:]/gu, " ").trim();
        return remainder ? [remainder] : [];
      }
      return [item];
    });
  }

  const wantsMoonViewing = POSITIVE_MOON_VIEWING.test(normalizedText);
  const explicitlyPrefersDarkSky = EXPLICIT_DARK_SKY.test(normalizedText);
  if (wantsMoonViewing && !explicitlyPrefersDarkSky && next.priorities) {
    next.priorities = next.priorities.filter((factor) => factor !== "moon");
  }
  if (wantsMoonViewing) {
    next.unclear = (next.unclear ?? []).filter((item) => !/(?:قمر|moon)/iu.test(item));
  }

  return {
    prefs: next,
    unsupported: wantsMoonViewing ? ["moon_viewing"] : [],
  };
}

// "Why", "what does … mean", "what should I bring", "how far": the user is asking, not changing the plan.
const ASKS_QUESTION = /(?:ليش|ليه|لماذا|لمَ|وش\s+يعني|ايش\s+يعني|إيش\s+يعني|يعني\s+(?:وش|ايش|إيش)|وش\s+معنى|ما\s+معنى|معنى|وش\s+(?:أحتاج|احتاج|نحتاج|آخذ|اخذ|ناخذ)|ايش\s+(?:أحتاج|احتاج|نحتاج|آخذ|اخذ|ناخذ)|كم\s+(?:يبعد|تبعد|المسافة|المشوار|ساعة)|اشرح|\bwhy\b|\bwhat\s+(?:does|do|is|are|'s)\b|\bwhat's\b|\bhow\s+(?:far|long|cold|windy)\b|\bdo\s+(?:i|we)\s+need\b|\bwhat\s+should\s+(?:i|we)\s+(?:bring|pack|take)\b|\bexplain\b)/iu;
// Words that tie a message to KASHTA's plan, forecast, places or activities.
const KASHTA_TOPIC = /(?:مكان|المكان|موقع|ليلة|الليلة|خطة|الخطة|تقييم|توقع|طقس|جو|غيم|غيوم|سحاب|هوا|هواء|رياح|حرارة|برد|مطر|غبار|قمر|نجوم|درب\s+التبانة|كشت|تخييم|تصريح|نباتي|مشوار|قيادة|أغراض|اغراض|قائمة|place|spot|site|night|plan|score|forecast|weather|cloud|wind|temperature|cold|rain|dust|moon|stars?|stargaz|milky\s+way|kashta|camp|permit|drive|checklist|pack|bring)/iu;

export type ChatIntent = "change" | "question" | "redirect";

/**
 * Settles whether a chat message changes the plan, asks about it, or is off-topic. The text
 * decides first: a question never changes preferences, and a KASHTA question is never redirected.
 */
export function chatIntent(text: string, model: { question?: boolean | null; redirect?: string | null }): ChatIntent {
  const normalized = normalizeText(text);
  if (ASKS_QUESTION.test(normalized)) return "question";
  if (model.question) return "question";
  if (model.redirect) return KASHTA_TOPIC.test(normalized) ? "question" : "redirect";
  return "change";
}
