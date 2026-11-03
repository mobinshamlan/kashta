import type { InterpretedPrefs } from "./schemas";

export type UnsupportedInterpretation = "moon_viewing";

const WEEK_PHRASE = /(?:هال(?:أ|ا)سبوع|(?:هذا|هاذا)\s+(?:الأسبوع|الاسبوع)|(?:الأسبوع|الاسبوع)\s+(?:هذا|هاذا)|this\s+week)/iu;
const WEEK_PHRASE_GLOBAL = /(?:هال(?:أ|ا)سبوع|(?:هذا|هاذا)\s+(?:الأسبوع|الاسبوع)|(?:الأسبوع|الاسبوع)\s+(?:هذا|هاذا)|this\s+week)/giu;
const SPECIFIC_DATE_OR_NIGHT = /(?:\b\d{4}-\d{2}-\d{2}\b|الليلة|اليوم|بكرة|بكره|غدًا|غدا|الأحد|الاحد|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/iu;
const POSITIVE_MOON_VIEWING = /(?:(?:نبي|نبغى|أبي|ابغى|أبغى|ابي|ودي|أود)\s+)?(?:نشوف|نشاهد|نرى|أشوف|اشوف|أشاهد|اشاهد)\s+(?:القمر|قمر)|\b(?:see|watch|view)\s+(?:the\s+)?moon\b/iu;
const EXPLICIT_DARK_SKY = /(?:ظلام|سماء\s+(?:مظلمة|داكنة)|بدون\s+(?:ضوء\s+)?القمر|ما\s+نبي\s+(?:ضوء\s+)?القمر|مانبي\s+(?:ضوء\s+)?القمر|moonless|no\s+moon(?:light)?|dark\s+sky|avoid\s+moonlight)/iu;
const GROUP_SIZE_MENTION = /(?:(?:حنا|احنا|إحنا|نحن|معنا|عددنا)\s*(?:عدد)?\s*(?:[0-9٠-٩]+|واحد|واحدة|أحد|احد|اثنين|اثنتين|ثلاث|ثلاثة|أربع|أربعة|اربع|اربعة|خمس|خمسة|ست|ستة|سبع|سبعة|ثمان|ثمانية|تسع|تسعة|عشر|عشرة)|(?:[0-9٠-٩]+|واحد|واحدة|أحد|احد|اثنين|اثنتين|ثلاث|ثلاثة|أربع|أربعة|اربع|اربعة|خمس|خمسة|ست|ستة|سبع|سبعة|ثمان|ثمانية|تسع|تسعة|عشر|عشرة)\s*(?:أشخاص|اشخاص|شخص|نفر|people|of\s+us))/iu;
const EXPERIENCE_MENTION = /(?:كشتة|نكشت|تخييم|مخيم|جلسة|رصد|نجوم|درب\s+التبانة|camp(?:ing)?|fire|stargaz|stars?)/iu;
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

  if (!GROUP_SIZE_MENTION.test(normalizedText)) next.groupSize = null;
  if (!EXPERIENCE_MENTION.test(normalizedText)) next.experience = null;
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
