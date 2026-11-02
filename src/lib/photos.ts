import type { Localized, PhotoKey } from "./types";

export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: Localized;
  /** Says where the picture was really taken. Shown wherever the photo illustrates a destination. */
  caption: Localized;
  creator: string;
  license: string;
  licenseUrl: string | null;
  page: string;
}

// Every file lives in /public/photos and is listed with its licence in
// public/photos/credits.json (downloaded from Wikimedia Commons).
export const PHOTOS: Record<PhotoKey, Photo> = {
  "dahna-ridge": {
    src: "/photos/sands-of-al-dahna-eastern-saudi-arabia.jpg",
    width: 2200,
    height: 1466,
    alt: {
      ar: "كثبان رملية برتقالية تحت سماء زرقاء صافية، ونباتات قليلة على الرمل",
      en: "Orange sand dunes under a clear blue sky with sparse grasses",
    },
    caption: { ar: "رمال الدهناء، نوفمبر 2020", en: "Sands of al-Dahna, November 2020" },
    creator: "Richard Mortel",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    page: "https://commons.wikimedia.org/wiki/File:Sands_of_al-Dahna,_eastern_Saudi_Arabia_(4)_(50620707316).jpg",
  },
  "dahna-ripples": {
    src: "/photos/sands-of-al-dahna-eastern-saudi-arabia-2.jpg",
    width: 2200,
    height: 1466,
    alt: {
      ar: "تموجات الريح على كثيب رملي واسع",
      en: "Wind ripples across a broad sand dune",
    },
    caption: { ar: "رمال الدهناء، نوفمبر 2020", en: "Sands of al-Dahna, November 2020" },
    creator: "Richard Mortel",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    page: "https://commons.wikimedia.org/wiki/File:Sands_of_al-Dahna,_eastern_Saudi_Arabia_(10)_(50619961483).jpg",
  },
  "dahna-crest": {
    src: "/photos/al-dahna-eastern-saudi-arabia-10-50619966953.jpg",
    width: 2200,
    height: 1237,
    alt: {
      ar: "قمة كثيب رملي وظل المصوّر على الرمل",
      en: "The crest of a dune with the photographer's shadow on the sand", // taste-skill-ignore (alt text)
    },
    caption: { ar: "الدهناء، نوفمبر 2020", en: "Al-Dahna, November 2020" },
    creator: "Richard Mortel",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    page: "https://commons.wikimedia.org/wiki/File:Al-Dahna,_eastern_Saudi_Arabia_(10)_(50619966953).jpg",
  },
  "tawqi-dune": {
    src: "/photos/sand-dunes-sa.jpg",
    width: 2200,
    height: 1466,
    alt: {
      ar: "كثيب رملي حاد الحافة تظهر عليه تموجات الريح",
      en: "A sharp-crested sand dune with wind ripples",
    },
    caption: { ar: "رمال الطوقي شمال شرق الرياض", en: "Dunes at Al-Tawqi, northeast of Riyadh" },
    creator: "Meshari Alawfi",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    page: "https://commons.wikimedia.org/wiki/File:Sand_Dunes_sa.jpg",
  },
  "tuwaiq-haze": {
    src: "/photos/tuwaiq-escarpment-2981960802.jpg",
    width: 2200,
    height: 1650,
    alt: {
      ar: "منحدرات جبل طويق يغطيها غبار خفيف",
      en: "Tuwaiq escarpment cliffs under a light dust haze",
    },
    caption: { ar: "حافة طويق غرب الرياض في يوم مغبر", en: "Tuwaiq escarpment west of Riyadh on a hazy day" },
    creator: "Peter Dowley",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    page: "https://commons.wikimedia.org/wiki/File:Tuwaiq_Escarpment_(2981960802).jpg",
  },
  "tuwaiq-canyon": {
    src: "/photos/desert-canyon-3344010623.jpg",
    width: 2200,
    height: 1650,
    alt: {
      ar: "وادٍ صخري واسع تحده جروف جبلية",
      en: "A wide rocky valley bordered by limestone cliffs",
    },
    caption: { ar: "من أعلى درب في جبال طويق قرب الرياض", en: "From a camel trail on the Tuwaiq escarpment near Riyadh" },
    creator: "Peter Dowley",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    page: "https://commons.wikimedia.org/wiki/File:Desert_canyon_(3344010623).jpg",
  },
  "tuwaiq-mesa": {
    src: "/photos/tuwaiq-escarpment-14h38m25s-k.jpg",
    width: 2200,
    height: 1650,
    alt: {
      ar: "هضاب صخرية مسطحة القمة فوق سهل صحراوي",
      en: "Flat-topped rock mesas above a desert plain",
    },
    caption: { ar: "حافة طويق جنوب غرب الرياض", en: "Tuwaiq escarpment, southwest of Riyadh" },
    creator: "Baptiste Marcel",
    license: "Public domain",
    licenseUrl: null,
    page: "https://commons.wikimedia.org/wiki/File:Tuwaiq_Escarpment-14h38m25s-k.jpg",
  },
  "dusty-plain": {
    src: "/photos/deserts-of-saudi-arabia.jpg",
    width: 2200,
    height: 1466,
    alt: {
      ar: "سهل صحراوي منبسط وسماء مغبرة باهتة",
      en: "A flat desert plain under a pale, dusty sky",
    },
    caption: { ar: "صحراء في المملكة العربية السعودية", en: "Desert in Saudi Arabia" },
    creator: "Meshari Alawfi",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    page: "https://commons.wikimedia.org/wiki/File:Deserts_of_Saudi_Arabia.jpg",
  },
  "camp-night": {
    src: "/photos/thumamah-dessert-in-saudi-arabia.jpg",
    width: 2200,
    height: 1466,
    alt: {
      ar: "مخيم بري ليلًا تضيئه سلسلة مصابيح وبجانبه سيارة",
      en: "A desert camp at night lit by a string of bulbs, with a car parked beside it",
    },
    caption: { ar: "مخيم في صحراء الثمامة", en: "A camp in the Thumamah desert" },
    creator: "Ismael Cacharro",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    page: "https://commons.wikimedia.org/wiki/File:Thumamah_Dessert_in_Saudi_Arabia.JPG",
  },
  "alula-sky": {
    src: "/photos/alula-night-sky.jpg",
    width: 1466,
    height: 2200,
    alt: {
      ar: "درب التبانة يظهر بين جبلين صخريين في سماء ليلية",
      en: "The Milky Way between two rock walls in the night sky",
    },
    caption: { ar: "السماء بين جبال العلا، 1447هـ", en: "The night sky between the mountains of AlUla, 2026" },
    creator: "Saudi Press Agency (وكالة الأنباء السعودية)",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    page: "https://commons.wikimedia.org/wiki/File:%D8%A7%D9%84%D8%B3%D9%85%D8%A7%D8%A1_%D9%85%D9%86_%D8%A8%D9%8A%D9%86_%D8%AC%D8%A8%D8%A7%D9%84_%D8%A7%D9%84%D8%B9%D9%84%D8%A7.jpg",
  },
  dallah: {
    src: "/photos/arabic-dallah-coffee-pot.jpg",
    width: 1466,
    height: 2200,
    alt: {
      ar: "دلة قهوة عربية نحاسية منقوشة عن قرب",
      en: "Close-up of an engraved Arabic coffee pot (dallah)",
    },
    caption: { ar: "دلة قهوة عربية", en: "An Arabic coffee pot (dallah)" },
    creator: "Bluehillies",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    page: "https://commons.wikimedia.org/wiki/File:Arabic_dallah_(coffee_pot).jpg",
  },
};
