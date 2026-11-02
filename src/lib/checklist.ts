import type { Experience, Localized, NightMetrics, PermitStatus } from "./types";

export type ChecklistGroup = "documents" | "vehicle" | "camp" | "weather" | "stars";

export interface ChecklistItem {
  id: string;
  group: ChecklistGroup;
  label: Localized;
  /** Why this item is on the list for this night. */
  why?: Localized;
}

type Metrics = Pick<
  NightMetrics,
  "minFeels" | "maxGust" | "maxPrecipProb" | "maxDust" | "moonIllumination" | "sunset" | "totalPrecip"
>;

/**
 * Deterministic checklist built from the group size, the experience and the real forecast.
 * Base items follow the NCVC camping guide ("Camping Essentials", "Prep Your Vehicle",
 * "Leave No Trace"). Weather items appear only when the forecast calls for them.
 */
export function buildChecklist(input: {
  experience: Experience;
  groupSize: number;
  metrics: Metrics | null;
  permitStatus?: PermitStatus;
}): ChecklistItem[] {
  const { experience, groupSize, metrics: m, permitStatus } = input;
  const n = groupSize;
  const items: ChecklistItem[] = [
    {
      id: "permit",
      group: "documents",
      label: permitStatus === "unverified"
        ? { ar: "تحقق من قواعد التخييم الحالية لهذا الموقع والهويات", en: "Verify this site's current camping rules and carry IDs" }
        : { ar: "تصريح التخييم من منصة نباتي والهويات", en: "Camping permit from Nabati and IDs" },
      why: permitStatus === "unverified"
        ? { ar: "لم نتمكن من تأكيد متطلبات التصريح لهذا الموقع.", en: "We could not confirm this site's permit requirements." }
        : { ar: "الدليل الرسمي يطلب أن يكون التصريح والهوية جاهزين.", en: "The official guide asks you to have the permit and ID ready." },
    },
    {
      id: "route",
      group: "documents",
      label: { ar: "حمّل الخريطة ومسار الطريق قبل الطلعة", en: "Download the map and route before leaving" },
      why: { ar: "قد تفقد الإرسال في البر.", en: "You may lose signal in the desert." },
    },
    { id: "fuel", group: "vehicle", label: { ar: "خزان وقود ممتلئ", en: "A full fuel tank" } },
    {
      id: "tyres",
      group: "vehicle",
      label: { ar: "فحص الكفرات والاستبنة ومنفاخ هواء", en: "Check tyres, spare and air pump" },
    },
    { id: "tow", group: "vehicle", label: { ar: "حبل سحب وعدة تغيير كفر", en: "Tow rope and tyre-change kit" } },
    { id: "firstaid", group: "vehicle", label: { ar: "شنطة إسعافات أولية", en: "First-aid kit" } },
    { id: "extinguisher", group: "camp", label: { ar: "طفاية حريق", en: "Fire extinguisher" } },
    {
      id: "water",
      group: "camp",
      label: { ar: `ماء شرب وطبخ يكفي ${n} ${n === 1 ? "شخص" : n <= 10 ? "أشخاص" : "شخصًا"}`, en: `Drinking and cooking water for ${n} ${n === 1 ? "person" : "people"}` },
    },
    {
      id: "fuelwood",
      group: "camp",
      label: { ar: "فحم أو حطب مستورد", en: "Charcoal or imported firewood" },
      why: { ar: "لا تقطع شجر المكان، وأشعل النار في المواقع المخصصة فقط.", en: "Never cut local plants; light fires only in designated spots." },
    },
    { id: "light", group: "camp", label: { ar: "كشافات وبطاريات احتياط", en: "Torches and spare batteries" } },
    {
      id: "trash",
      group: "camp",
      label: { ar: "أكياس نفايات ترجع معك", en: "Rubbish bags to carry everything out" },
      why: { ar: "من مبادئ «لا تترك أثرًا» في دليل المركز.", en: "Part of the guide's Leave No Trace principles." },
    },
    {
      id: "tents",
      group: "camp",
      label: { ar: `خيام أو بيت شعر يتسع لـ ${n}`, en: `Tents or a tent house for ${n}` },
    },
  ];

  if (m?.sunset) {
    items.push({
      id: "arrive",
      group: "camp",
      label: { ar: `اوصل قبل المغرب (الغروب ${m.sunset})`, en: `Arrive before sunset (${m.sunset})` },
      why: { ar: "عشان تتعرف على المكان وتنصب على أرض مستوية.", en: "So you can read the ground and pitch on level terrain." },
    });
  }

  if (m?.minFeels !== null && m?.minFeels !== undefined) {
    if (m.minFeels < 10) {
      items.push({
        id: "warm",
        group: "weather",
        label: { ar: "فروة أو بطانيات ثقيلة وملابس طبقات", en: "Farwa or heavy blankets and layered clothing" },
        why: {
          ar: `أدنى إحساس بالحرارة الليلة ${m.minFeels}°م.`,
          en: `Feels-like low tonight is ${m.minFeels}°C.`,
        },
      });
    }
    if (m.minFeels < 5) {
      items.push({
        id: "sleepingbag",
        group: "weather",
        label: { ar: "أكياس نوم شتوية لكل شخص", en: "Cold-weather sleeping bag for each person" },
        why: { ar: `البرد قوي آخر الليل (${m.minFeels}°م).`, en: `It gets very cold before dawn (${m.minFeels}°C).` },
      });
    }
  }

  if (m?.maxGust !== null && m?.maxGust !== undefined && m.maxGust >= 30) {
    items.push({
      id: "pegs",
      group: "weather",
      label: { ar: "أوتاد إضافية وحبال تثبيت ومصدّ رياح", en: "Extra pegs, guy ropes and a windbreak" },
      why: { ar: `هبات الرياح تصل ${m.maxGust} كم/س.`, en: `Gusts reach ${m.maxGust} km/h.` },
    });
  }

  if (m?.maxDust !== null && m?.maxDust !== undefined && m.maxDust >= 150) {
    items.push({
      id: "dust",
      group: "weather",
      label: { ar: "كمامات ونظارات وأغطية للأكل", en: "Masks, glasses and covers for food" },
      why: { ar: `الغبار السطحي يصل ${m.maxDust} ميكروغرام/م³.`, en: `Surface dust reaches ${m.maxDust} μg/m³.` },
    });
  }

  if (m?.maxPrecipProb !== null && m?.maxPrecipProb !== undefined && m.maxPrecipProb >= 30) {
    items.push({
      id: "rain",
      group: "weather",
      label: { ar: "مشمع مقاوم للمطر، وخيّم بعيد عن الأودية والشعاب", en: "Rain tarp, and camp away from wadis and channels" },
      why: {
        ar: `احتمال المطر ${m.maxPrecipProb}%. الدليل ينصح بتجنب الأماكن المعرضة للسيول.`,
        en: `Rain chance ${m.maxPrecipProb}%. The guide advises avoiding flood-prone ground.`,
      },
    });
  }

  if (experience === "stars") {
    items.push(
      {
        id: "redlight",
        group: "stars",
        label: { ar: "كشاف بضوء أحمر يحافظ على رؤيتك الليلية", en: "Red-light torch to keep your night vision" },
      },
      { id: "chairs", group: "stars", label: { ar: "كراسي مائلة أو فرشة للاستلقاء", en: "Reclining chairs or ground mats" } },
      { id: "skymap", group: "stars", label: { ar: "تطبيق خريطة سماء محمّل مسبقًا", en: "A star-map app downloaded in advance" } },
    );
    if (m && m.moonIllumination >= 0.6) {
      items.push({
        id: "moon",
        group: "stars",
        label: { ar: "خطط للرصد بعد غياب القمر", en: "Plan to observe after moonset" },
        why: {
          ar: `القمر مضاء ${Math.round(m.moonIllumination * 100)}% الليلة.`,
          en: `The moon is ${Math.round(m.moonIllumination * 100)}% lit tonight.`,
        },
      });
    }
  }

  return items;
}
