import type { Destination, Localized, Permit, PhotoKey, Terrain } from "./types";

/**
 * Curated destinations around Riyadh.
 *
 * Thirteen are the Riyadh-region sites listed in the National Center for Vegetation Cover
 * Development and Combating Desertification (NCVC) "Camping and Caravan Guide in Vegetation
 * Cover Areas" (2025). Names, governorates and capacities are copied from the guide's Riyadh
 * table; coordinates are the entry points of the Google Maps links the guide publishes for
 * each site ("Location" in the guide = entry point of the designated area).
 *
 * Rawdat Khuraim is added as a well-known meadow whose camping rules we could NOT confirm from
 * an official source, so its permit status is "unverified".
 *
 * Checked by a person on 2026-11-02. Re-check every season: permits are issued per season.
 */

export const NCVC_GUIDE_AR =
  "https://beta.ncvc.gov.sa/ar/Documents/camping2025/CampingCaravanGuide2025.pdf";
export const NCVC_GUIDE_EN =
  "https://beta.ncvc.gov.sa/en/Documents/camping2025/CampingCaravanGuide2025.pdf";
export const NABATI_URL = "https://nabati.ncvc.gov.sa";
export const NCVC_REQUIREMENTS_URL =
  "https://ncvc.gov.sa/en/digitalKnowledge/Camping/Pages/Requirements.aspx";
export const CHECKED_ON = "2026-11-02";

const ncvcPermit: Permit = {
  status: "permit_required",
  sourceTitle: {
    ar: "دليل التخييم والكرفانات في مواقع الغطاء النباتي 2025، المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر",
    en: "Camping and Caravan Guide in Vegetation Cover Areas 2025, National Center for Vegetation Cover (NCVC)",
  },
  sourceUrl: NCVC_GUIDE_AR,
  checkedOn: CHECKED_ON,
  notes: {
    ar: "الموقع مدرج ضمن مواقع التخييم المعتمدة لدى المركز. التخييم فيه يحتاج تصريحًا يُطلب من منصة نباتي (خيار «طلب ترخيص تخييم»). بحسب أسئلة الدليل: مدة التخييم حتى ثلاثة أشهر، ولا يُحجز أكثر من موقع للتاريخ نفسه. الدليل صادر لموسم 2025، فتأكد من الموسم الحالي في المنصة قبل الطلعة.",
    en: "Listed as an approved NCVC camping site. Camping here needs a permit requested on the Nabati platform (“Request Camping license”). Per the guide's FAQ: stays of up to three months, one location per date. The guide covers the 2025 season, so confirm the current season on the platform before you go.",
  },
  applyUrl: NABATI_URL,
};

const ncvcSources = [
  {
    title: { ar: "دليل التخييم 2025 (عربي، PDF)", en: "NCVC camping guide 2025 (Arabic, PDF)" },
    url: NCVC_GUIDE_AR,
  },
  {
    title: { ar: "دليل التخييم 2025 (إنجليزي، PDF)", en: "NCVC camping guide 2025 (English, PDF)" },
    url: NCVC_GUIDE_EN,
  },
];

interface NcvcRow {
  slug: string;
  name: Localized;
  governorate: Localized;
  lat: number;
  lon: number;
  terrain: Terrain;
  camping: number | null;
  caravans: number | null;
  mapUrl: string;
  photo: PhotoKey;
  kind: Localized;
}

function ncvcSite(row: NcvcRow): Destination {
  const { camping, caravans } = row;
  return {
    slug: row.slug,
    name: row.name,
    governorate: row.governorate,
    lat: row.lat,
    lon: row.lon,
    terrain: row.terrain,
    description: {
      ar: `${row.kind.ar} في محافظة ${row.governorate.ar}، مدرج ضمن مواقع التخييم المعتمدة لدى المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر في منطقة الرياض.`,
      en: `${row.kind.en} in ${row.governorate.en} governorate, listed among the NCVC's approved camping sites in the Riyadh region.`,
    },
    facts: {
      ar: [
        camping ? `الطاقة الاستيعابية للتخييم بحسب الدليل: ${camping} مخيمًا` : "لا توجد طاقة تخييم مدرجة في الدليل",
        caravans ? `مواقع الكرفانات بحسب الدليل: ${caravans}` : "لا توجد مواقع كرفانات مدرجة في الدليل",
        "الإحداثيات هي نقطة الدخول المنشورة في دليل المركز",
      ],
      en: [
        camping ? `Camping capacity per the guide: ${camping} camps` : "No camping capacity listed in the guide",
        caravans ? `Caravan spots per the guide: ${caravans}` : "No caravan spots listed in the guide",
        "Coordinates are the entry point published in the NCVC guide",
      ],
    },
    experiences: ["kashta", "stars"],
    capacity: { camping, caravans },
    photo: row.photo,
    officialMapUrl: row.mapUrl,
    permit: ncvcPermit,
    sources: ncvcSources,
  };
}

const park = { ar: "متنزه وطني", en: "A national park" };

export const DESTINATIONS: Destination[] = [
  ncvcSite({
    slug: "saad-national-park",
    name: { ar: "متنزه سعد الوطني", en: "Saad National Park" },
    governorate: { ar: "رماح", en: "Rumah" },
    lat: 25.124542,
    lon: 47.598186,
    terrain: "park",
    camping: 448,
    caravans: 12,
    mapUrl: "https://maps.app.goo.gl/MgqZUHCNJJWS685g9",
    photo: "dahna-ridge",
    kind: park,
  }),
  ncvcSite({
    slug: "saad-sand-dunes",
    name: { ar: "نفود سعد", en: "Saad Sand Dunes" },
    governorate: { ar: "رماح", en: "Rumah" },
    lat: 25.114837,
    lon: 47.633347,
    terrain: "dunes",
    camping: 500,
    caravans: null,
    mapUrl: "https://maps.app.goo.gl/gtTLysyWswJNze9u9",
    photo: "dahna-ripples",
    kind: { ar: "نفود رملي", en: "A sand-dune area" },
  }),
  ncvcSite({
    slug: "thadiq-national-park",
    name: { ar: "متنزه ثادق الوطني", en: "Thadiq National Park" },
    governorate: { ar: "ثادق", en: "Thadiq" },
    lat: 25.2243625,
    lon: 45.8903906,
    terrain: "park",
    camping: 60,
    caravans: 20,
    mapUrl: "https://maps.app.goo.gl/YYb7QrBseWsZQhGm7",
    photo: "tuwaiq-canyon",
    kind: park,
  }),
  ncvcSite({
    slug: "al-ghat-national-park",
    name: { ar: "متنزه الغاط الوطني", en: "Al-Ghat National Park" },
    governorate: { ar: "الغاط", en: "Al-Ghat" },
    lat: 25.962708,
    lon: 45.035289,
    terrain: "park",
    camping: 50,
    caravans: 20,
    mapUrl: "https://maps.app.goo.gl/16SqTZUPZmvtABK48",
    photo: "tuwaiq-mesa",
    kind: park,
  }),
  ncvcSite({
    slug: "al-sulabaikh-national-park",
    name: { ar: "متنزه الصلابيخ الوطني", en: "Al-Sulabaikh National Park" },
    governorate: { ar: "الغاط", en: "Al-Ghat" },
    lat: 26.011105,
    lon: 44.986182,
    terrain: "park",
    camping: 6,
    caravans: null,
    mapUrl: "https://maps.app.goo.gl/cD2ko4te4sqyY64w9",
    photo: "tuwaiq-haze",
    kind: park,
  }),
  ncvcSite({
    slug: "jabala-national-park",
    name: { ar: "متنزه جبلة الوطني", en: "Jabala National Park" },
    governorate: { ar: "الدوادمي", en: "Dawadmi" },
    lat: 24.815826,
    lon: 43.911263,
    terrain: "park",
    camping: 32,
    caravans: 14,
    mapUrl: "https://maps.app.goo.gl/rY2y9EkBNKX4YTam9",
    photo: "dusty-plain",
    kind: park,
  }),
  ncvcSite({
    slug: "aba-samri-national-park",
    name: { ar: "متنزه أبا سمري الوطني", en: "Aba Samri National Park" },
    governorate: { ar: "مرات", en: "Marat" },
    lat: 25.164466,
    lon: 45.466111,
    terrain: "park",
    camping: 185,
    caravans: 50,
    mapUrl: "https://maps.app.goo.gl/N5pUmRDx1PyJt2628",
    photo: "tuwaiq-mesa",
    kind: park,
  }),
  ncvcSite({
    slug: "al-zulfi-national-park",
    name: { ar: "متنزه الزلفي الوطني", en: "Al-Zulfi National Park" },
    governorate: { ar: "الزلفي", en: "Al-Zulfi" },
    lat: 26.18306,
    lon: 44.51108,
    terrain: "park",
    camping: 124,
    caravans: 40,
    mapUrl: "https://maps.app.goo.gl/zB8ChbPiBqpBfQ7H9",
    photo: "tawqi-dune",
    kind: park,
  }),
  ncvcSite({
    slug: "warat-national-park",
    name: { ar: "متنزه وراط الوطني", en: "Warat National Park" },
    governorate: { ar: "المجمعة", en: "Al-Majma'ah" },
    lat: 25.518554,
    lon: 45.526026,
    terrain: "park",
    camping: 24,
    caravans: null,
    mapUrl: "https://maps.app.goo.gl/VhoqDSYNFR7MMBVK6",
    photo: "tuwaiq-canyon",
    kind: park,
  }),
  ncvcSite({
    slug: "shaqra-sand-dunes",
    name: { ar: "نفود شقراء البري", en: "Shaqra Wilderness Sand Dunes" },
    governorate: { ar: "شقراء", en: "Shaqra" },
    lat: 25.314322,
    lon: 45.355894,
    terrain: "dunes",
    camping: 70,
    caravans: null,
    mapUrl: "https://maps.app.goo.gl/TnTUdssKYrjMjTtz9",
    photo: "tawqi-dune",
    kind: { ar: "نفود رملي بري", en: "A wilderness sand-dune area" },
  }),
  ncvcSite({
    slug: "al-ghalghal-national-park",
    name: { ar: "متنزه الغلغل والدريعي الوطني", en: "Al-Ghalghal and Al-Dura'i National Park" },
    governorate: { ar: "الأفلاج", en: "Al-Aflaj" },
    lat: 22.87408,
    lon: 46.627591,
    terrain: "park",
    camping: 50,
    caravans: null,
    mapUrl: "https://maps.app.goo.gl/chDCvrMNYWC3UvkM6",
    photo: "dahna-crest",
    kind: park,
  }),
  ncvcSite({
    slug: "al-rahmaniya-park",
    name: { ar: "متنزه الرحمانية البري", en: "Al-Rahmaniya Wilderness Park" },
    governorate: { ar: "الخرج", en: "Al-Kharj" },
    lat: 24.21909,
    lon: 47.174087,
    terrain: "park",
    camping: 50,
    caravans: 50,
    mapUrl: "https://maps.app.goo.gl/ZSJhDJhuEBrPGe2d7",
    photo: "dusty-plain",
    kind: { ar: "متنزه بري", en: "A wilderness park" },
  }),
  ncvcSite({
    slug: "al-ahwar-meadow",
    name: { ar: "روضة الأحور", en: "Al-Ahwar Meadow" },
    governorate: { ar: "مرات", en: "Marat" },
    lat: 24.92391,
    lon: 45.73348,
    terrain: "meadow",
    camping: 200,
    caravans: null,
    mapUrl:
      "https://www.google.com/maps/place/24%C2%B055'26.1%22N+45%C2%B044'00.5%22E/@24.9239148,45.7309051,890m",
    photo: "tuwaiq-haze",
    kind: { ar: "روضة", en: "A desert meadow (rawdah)" },
  }),
  {
    slug: "rawdat-khuraim",
    name: { ar: "روضة خريم", en: "Rawdat Khuraim" },
    governorate: { ar: "شمال شرق الرياض", en: "Northeast of Riyadh" },
    lat: 25.388998,
    lon: 47.293703,
    terrain: "meadow",
    description: {
      ar: "روضة معروفة شمال شرق الرياض. بحسب سعوديبيديا، تحولت روضة خريم وما حولها بأمر ملكي عام 2018 إلى محمية الإمام عبدالعزيز بن محمد الملكية.",
      en: "A well-known desert meadow northeast of Riyadh. According to Saudipedia, a 2018 royal order made Rawdat Khuraim and its surroundings the Imam Abdulaziz bin Mohammed Royal Reserve.",
    },
    facts: {
      ar: [
        "تقع ضمن نطاق محمية الإمام عبدالعزيز بن محمد الملكية بحسب سعوديبيديا",
        "ليست ضمن قائمة مواقع التخييم في دليل المركز الوطني لتنمية الغطاء النباتي 2025",
        "الإحداثيات من ويكي بيانات (Q12213899)",
      ],
      en: [
        "Inside the Imam Abdulaziz bin Mohammed Royal Reserve, per Saudipedia",
        "Not in the NCVC 2025 camping-site list",
        "Coordinates from Wikidata (Q12213899)",
      ],
    },
    experiences: ["kashta", "stars"],
    capacity: { camping: null, caravans: null },
    photo: "dusty-plain",
    permit: {
      status: "unverified",
      sourceTitle: {
        ar: "سعوديبيديا: محمية الإمام عبدالعزيز بن محمد الملكية",
        en: "Saudipedia: Imam Abdulaziz bin Mohammed Royal Reserve",
      },
      sourceUrl:
        "https://saudipedia.com/en/article/2480/geography/reserves/imam-abdulaziz-bin-mohammed-royal-reserve",
      checkedOn: CHECKED_ON,
      notes: {
        ar: "لم نجد مصدرًا رسميًا يحدد قواعد التخييم الحالية في روضة خريم. المحميات الملكية تنظم الدخول والأنشطة عبر هيئات تطويرها، فراجع هيئة تطوير محمية الإمام عبدالعزيز بن محمد الملكية قبل أي تخييم.",
        en: "We found no official source stating the current camping rules for Rawdat Khuraim. Royal reserves regulate access and activities through their development authorities, so check with the Imam Abdulaziz bin Mohammed Royal Reserve Development Authority before camping.",
      },
    },
    sources: [
      {
        title: { ar: "سعوديبيديا: محمية الإمام عبدالعزيز بن محمد الملكية", en: "Saudipedia: Imam Abdulaziz bin Mohammed Royal Reserve" },
        url: "https://saudipedia.com/en/article/2480/geography/reserves/imam-abdulaziz-bin-mohammed-royal-reserve",
      },
      { title: { ar: "ويكي بيانات: روضة خريم", en: "Wikidata: Rawdat Khuraim" }, url: "https://www.wikidata.org/wiki/Q12213899" },
    ],
  },
];

export const RIYADH = { lat: 24.7136, lon: 46.6753 };

export function getDestination(slug: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.slug === slug);
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Rough driving estimate: straight-line distance x 1.3 road factor at 90 km/h average.
 * Always labelled as an estimate in the UI; it is not a routed travel time.
 */
export function estimateDrive(d: { lat: number; lon: number }) {
  const km = distanceKm(RIYADH, d);
  const roadKm = km * 1.3;
  const hours = roadKm / 90;
  return { straightKm: Math.round(km), roadKm: Math.round(roadKm), hours: Math.round(hours * 10) / 10 };
}
