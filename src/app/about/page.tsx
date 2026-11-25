import type { Metadata } from "next";
import credits from "../../../public/photos/credits.json";
import { Car, CloudFog, CloudRain, Cloud, ExternalLink, MapPin, Moon, ShieldCheck, SunDim, Thermometer, Wind, CircleSlash } from "lucide-react";
import { NightScene } from "@/components/night-scene";
import { OpenOnHash } from "@/components/open-on-hash";
import { NABATI_URL, NCVC_GUIDE_AR, NCVC_GUIDE_EN, NCVC_REQUIREMENTS_URL, RECOMMENDABLE } from "@/lib/destinations";
import { getDict } from "@/lib/locale";
import { NEARBY_TIE_POINTS } from "@/lib/reasons";
import {
  BASE_WEIGHTS,
  CLOUD_LIMITS,
  DUST_LIMITS,
  GUST_LIMITS,
  PRIORITY_BOOST,
  RAIN_LIMITS,
  TEMP_BANDS,
} from "@/lib/score";
import type { Experience, Factor } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.about.title, description: dict.about.lead };
}

const FACTORS: Factor[] = ["temp", "wind", "rain", "dust", "clouds", "moon"];
const FACTOR_ICON = { temp: Thermometer, wind: Wind, rain: CloudRain, dust: CloudFog, clouds: Cloud, moon: Moon } as const;
/** One colour per factor for the weight bars; each segment is also named in its accessible label. */
const FACTOR_TONE: Record<Factor, string> = {
  // All dark enough for white percentage labels (4.5:1 or better).
  temp: "#a8582a",
  wind: "#4f7387",
  rain: "#2f5f86",
  dust: "#86683a",
  clouds: "#656f82",
  moon: "#2c3557",
};
/** Rating bands from score.ts `rating()`; colours are the same tokens the app uses for suitability. */
const BANDS = [
  { key: "excellent", from: 80, color: "var(--color-good)" },
  { key: "good", from: 65, color: "var(--color-good)" },
  { key: "fair", from: 50, color: "var(--color-fair)" },
  { key: "poor", from: 0, color: "var(--color-poor)" },
] as const;

export default async function AboutPage() {
  const { locale, dict } = await getDict();
  const ar = locale === "ar";
  const sep = ar ? "، " : ", ";
  const pct = (w: number | undefined) => `${Math.round((w ?? 0) * 100)}%`;
  const weightsLabel = (mode: Experience) =>
    `${dict.experience[mode]}: ${FACTORS.filter((f) => BASE_WEIGHTS[mode][f]).map((f) => `${dict.factor[f]} ${pct(BASE_WEIGHTS[mode][f])}`).join(sep)}`;

  const limits = [
    { Icon: MapPin, text: dict.home.coverageLeadFn(RECOMMENDABLE.length) },
    {
      Icon: Car,
      text: ar
        ? "المشوار تقدير: المسافة المباشرة من مدينة الانطلاق × 1.3 على 90 كم/س. مو مسار ملاحة."
        : "Drive times are estimates: straight-line distance from your starting city × 1.3 at 90 km/h. Not a navigation route.",
    },
    { Icon: SunDim, text: dict.stars.noLight },
    {
      Icon: CircleSlash,
      text: ar
        ? "إذا نقصت بيانات عامل لليلة (مثل الغبار بعد اليوم السابع) ما نعطيها رقم، ونكتب «ناقصة»."
        : "If a factor's data is missing for a night (such as dust after day seven), we give no number and mark it “n/a”.",
    },
    {
      Icon: ShieldCheck,
      text: ar
        ? "حالة التصاريح منقولة يدويًا من دليل المركز مع تاريخ التحقق. كشتة ما تعطيك تصريح."
        : "Permit status is copied by hand from the NCVC guide with a check date. KASHTA does not issue permits.",
    },
  ];

  return (
    <div>
      <OpenOnHash />
      <section className="method-hero night-hero on-night on-dark" aria-labelledby="method-title">
        <NightScene mode="stars" />
        <div className="frame method-hero-inner">
          <h1 id="method-title" className="places-title">{dict.about.title}</h1>
          <p className="mt-3 max-w-[52ch] text-star-2">
            {ar
              ? "التقييم يحسبه كود كشتة من أرقام التوقعات، مو الذكاء الاصطناعي. هذي الخطوات الثلاث باختصار."
              : "The score is calculated by KASHTA's code from forecast numbers, not by AI. Here are the three steps in short."}
          </p>
        </div>
      </section>

      <div className="frame pb-16">
        {/* The whole method in three steps, drawn from the same constants the scorer uses. */}
        <ol id="how" className="method-flow" aria-label={dict.home.stepsTitle}>
          <li className="method-step">
            <span className="method-n num" aria-hidden>1</span>
            <h2 className="font-semibold">{ar ? "بيانات الطقس والسماء" : "Weather and sky data"}</h2>
            <ul className="method-factors mt-4" aria-label={ar ? "العوامل" : "Factors"}>
              {FACTORS.map((f) => {
                const Icon = FACTOR_ICON[f];
                return (
                  <li key={f}>
                    <Icon aria-hidden size={20} style={{ color: FACTOR_TONE[f] }} />
                    <span>{dict.factor[f]}</span>
                  </li>
                );
              })}
            </ul>
            <p className="small mt-4 text-ink-2">
              {ar
                ? "لكل مكان ولسبع ليالٍ: الطقس من Open-Meteo، والغبار من CAMS (توقعه أقصر، فآخر الليالي قد تبقى بدون تقييم)، والقمر بحساب فلكي."
                : "For every place and seven nights: weather from Open-Meteo, dust from CAMS (a shorter forecast, so the last nights may stay unrated), and the moon calculated astronomically."}
            </p>
          </li>

          <li className="method-step">
            <span className="method-n num" aria-hidden>2</span>
            <h2 className="font-semibold">{ar ? "التقييم" : "Scoring"}</h2>
            <div className="mt-4 grid gap-3">
              {(["kashta", "stars"] as const).map((mode) => (
                <div key={mode}>
                  <p className="small mb-1 font-medium">{dict.experience[mode]}</p>
                  <div className="method-weights" role="img" aria-label={weightsLabel(mode)}>
                    {FACTORS.filter((f) => BASE_WEIGHTS[mode][f]).map((f) => (
                      <span key={f} style={{ flexGrow: BASE_WEIGHTS[mode][f], background: FACTOR_TONE[f] }} title={`${dict.factor[f]} ${pct(BASE_WEIGHTS[mode][f])}`}>
                        {(BASE_WEIGHTS[mode][f] ?? 0) >= 0.15 && <bdi className="num">{pct(BASE_WEIGHTS[mode][f])}</bdi>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="small mt-4 text-ink-2">
              {ar
                ? "كل عامل يصير درجة من 0 إلى 100، والمتوسط الموزون يعطي تقييم الليلة. الأوزان تختلف: الكشتة يهمها الحرارة والهوا، والنجوم يهمها الغيم والقمر."
                : "Each factor becomes a 0–100 score, and the weighted average is the night's score. Weights differ: a kashta cares about temperature and wind; stargazing about clouds and the moon."}
            </p>
          </li>

          <li className="method-step">
            <span className="method-n num" aria-hidden>3</span>
            <h2 className="font-semibold">{ar ? "الترشيح" : "Recommendation"}</h2>
            <ul className="method-bands mt-4">
              {BANDS.map((b) => (
                <li key={b.key}>
                  <span className="method-band-chip" style={{ ["--rating" as string]: b.color }}>{dict.rating[b.key]}</span>
                  <bdi className="num small text-ink-2">{b.from > 0 ? `${b.from}+` : ar ? "أقل من 50" : "under 50"}</bdi>
                </li>
              ))}
            </ul>
            <p className="small mt-4 text-ink-2">
              {ar
                ? `نرشّح أعلى ليلة ومكان. إذا تقارب تقييمان (${NEARBY_TIE_POINTS} نقاط) نفضّل الأقرب. المكان اللي حالته غير مؤكدة ما نرشحه.`
                : `We recommend the highest night and place. When two scores are within ${NEARBY_TIE_POINTS} points, the nearer place wins. A place with unconfirmed status is never recommended.`}
            </p>
          </li>
        </ol>

        <section aria-labelledby="limits-h" className="method-limits">
          <h2 id="limits-h" className="lead font-medium">{ar ? "حدود لازم تعرفها" : "Limits worth knowing"}</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {limits.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon aria-hidden size={19} className="mt-0.5 shrink-0 text-olive" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="method-more-list">
          <h2 className="lead font-medium">{ar ? "التفاصيل" : "The details"}</h2>

          <details id="formula" className="method-more">
            <summary>{ar ? "المعادلة والحدود لكل عامل" : "The formula and each factor's limits"}</summary>
            <div className="method-more-body">
              <p className="max-w-[62ch]">
                {ar
                  ? "كل عامل يتحول إلى درجة من 0 إلى 100 بخط مستقيم بين حد «جيد» وحد «سيئ»، ثم نأخذ المتوسط الموزون. الأولوية اللي تختارها تضاعف وزن العامل "
                  : "Each factor becomes a 0–100 score along a straight line between a “good” and a “bad” limit, then we take the weighted average. A priority you choose multiplies that factor's weight by "}
                <span className="num">{PRIORITY_BOOST}</span>
                {ar
                  ? " قبل إعادة توزيع الأوزان. إذا وصل عامل لحده الخطر (هبات فوق حد تحملك، أو مطر 70% أو أكثر، أو غبار 400 ميكروغرام/م³ أو أكثر) ينحد التقييم عند 35."
                  : " before the weights are rebalanced. If a factor hits its danger limit (gusts beyond your tolerance, rain chance of 70% or more, or dust of 400 μg/m³ or more) the score is capped at 35."}
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="num w-full text-start md:min-w-[36rem]">
                  <thead>
                    <tr className="text-ink-2">
                      <th className="py-2 pe-4 text-start font-normal">{ar ? "العامل" : "Factor"}</th>
                      <th className="py-2 pe-4 text-start font-normal">{dict.experience.kashta}</th>
                      <th className="py-2 pe-4 text-start font-normal">{dict.experience.stars}</th>
                      <th className="py-2 text-start font-normal">{ar ? "القياس والحدود" : "Measure and limits"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FACTORS.map((f) => (
                      <tr key={f} className="align-top even:bg-sand-2">
                        <th scope="row" className="py-3 pe-4 text-start font-medium">{dict.factor[f]}</th>
                        <td className="py-3 pe-4">{BASE_WEIGHTS.kashta[f] ? pct(BASE_WEIGHTS.kashta[f]) : "—"}</td>
                        <td className="py-3 pe-4">{BASE_WEIGHTS.stars[f] ? pct(BASE_WEIGHTS.stars[f]) : "—"}</td>
                        <td className="py-3">
                          {dict.factorHint[f]}.{" "}
                          {f === "temp" &&
                            (ar
                              ? `نطاق الراحة لحرارة المساء: بارد ${TEMP_BANDS.cool.join("–")}°، معتدل ${TEMP_BANDS.mild.join("–")}°، دافئ ${TEMP_BANDS.warm.join("–")}°. نخصم 8 نقاط لكل درجة خارج النطاق، و5 لكل درجة إحساس تحت 4° آخر الليل.`
                              : `Evening comfort band: cool ${TEMP_BANDS.cool.join("–")}°, mild ${TEMP_BANDS.mild.join("–")}°, warm ${TEMP_BANDS.warm.join("–")}°. −8 per degree outside the band, −5 per feels-like degree below 4° before dawn.`)}
                          {f === "wind" &&
                            (ar
                              ? `الهبات (كم/س): ما أبي هوا ${GUST_LIMITS.low.good}→${GUST_LIMITS.low.bad}، هوا خفيف ${GUST_LIMITS.medium.good}→${GUST_LIMITS.medium.bad}، ما يهمني ${GUST_LIMITS.high.good}→${GUST_LIMITS.high.bad}.`
                              : `Gusts (km/h): calm only ${GUST_LIMITS.low.good}→${GUST_LIMITS.low.bad}, a little is fine ${GUST_LIMITS.medium.good}→${GUST_LIMITS.medium.bad}, doesn't bother me ${GUST_LIMITS.high.good}→${GUST_LIMITS.high.bad}.`)}
                          {f === "rain" &&
                            (ar
                              ? `${RAIN_LIMITS.good}% → ${RAIN_LIMITS.bad}%، والحد الأقصى 25 إذا تجاوز المجموع 1 مم.`
                              : `${RAIN_LIMITS.good}% → ${RAIN_LIMITS.bad}%, capped at 25 if the total exceeds 1 mm.`)}
                          {f === "dust" && `${DUST_LIMITS.good} → ${DUST_LIMITS.bad} μg/m³ (CAMS).`}
                          {f === "clouds" && `${CLOUD_LIMITS.good}% → ${CLOUD_LIMITS.bad}%.`}
                          {f === "moon" &&
                            (ar
                              ? "60% لنسبة ساعات الظلام الفلكي بدون قمر، و40% لخفوت القمر. نحسبه بمكتبة SunCalc."
                              : "60% share of astronomical-dark hours without the moon, 40% moon dimness. Calculated with SunCalc.")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small mt-4 text-ink-2">
                {ar
                  ? "الليلة تمتد من 6 مساءً إلى 5 فجرًا بتوقيت السعودية. نعتمد قياسًا فقط إذا توفر لنصف ساعات الليلة على الأقل."
                  : "A night runs from 6 pm to 5 am Saudi time. A measurement counts only if at least half the night's hours have it."}
              </p>
            </div>
          </details>

          <details id="data" className="method-more">
            <summary>{ar ? "مصادر البيانات" : "Data sources"}</summary>
            <dl className="method-more-body grid gap-5">
              <div>
                <dt className="font-medium">Open-Meteo Forecast API</dt>
                <dd className="mt-1 max-w-[62ch] text-ink-2">
                  {ar
                    ? "الحرارة، الإحساس الحراري، الرياح والهبات، احتمال المطر وكميته، والغيوم، لثمانية أيام. البيانات برخصة CC BY 4.0، ونخزن الردود 30 دقيقة."
                    : "Temperature, feels-like, wind and gusts, rain chance and amount, and cloud cover for eight days. Data under CC BY 4.0; responses are cached for 30 minutes."}{" "}
                  <a className="link" href="https://open-meteo.com/en/docs" target="_blank" rel="noopener">open-meteo.com</a>
                </dd>
              </div>
              <div>
                <dt className="font-medium">Open-Meteo Air Quality API (CAMS)</dt>
                <dd className="mt-1 max-w-[62ch] text-ink-2">
                  {ar
                    ? "الغبار قرب السطح من نموذج Copernicus CAMS العالمي (دقة تقارب 45 كم)، لسبعة أيام كحد أقصى، لذلك قد تكون آخر الليالي ناقصة."
                    : "Surface dust from the global Copernicus CAMS model (about 45 km resolution), up to seven days, so the last nights may be incomplete."}{" "}
                  <a className="link" href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener">{ar ? "التوثيق" : "Documentation"}</a>
                </dd>
              </div>
              <div>
                <dt className="font-medium">{ar ? "القمر والشمس" : "Moon and sun"}</dt>
                <dd className="mt-1 max-w-[62ch] text-ink-2">
                  {ar ? "نحسب الإضاءة والشروق والغروب والظلام الفلكي محليًا بمكتبة SunCalc مفتوحة المصدر." : "Illumination, rise, set and astronomical darkness are calculated locally with the open-source SunCalc library."}
                </dd>
              </div>
              <div>
                <dt className="font-medium">{ar ? "المواقع" : "Sites"}</dt>
                <dd className="mt-1 max-w-[62ch] text-ink-2">
                  {ar
                    ? "مواقع المخيمات في المملكة وطاقتها ونقاط دخولها من دليل التخييم والكرفانات في مواقع الغطاء النباتي 2025 الصادر عن المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر."
                    : "Campsite locations, capacities and entry points across Saudi Arabia come from the NCVC Camping and Caravan Guide in Vegetation Cover Areas 2025."}
                  <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    <a className="link" href={NCVC_GUIDE_AR} target="_blank" rel="noopener">{ar ? "الدليل (عربي)" : "Guide (Arabic)"}</a>
                    <a className="link" href={NCVC_GUIDE_EN} target="_blank" rel="noopener">{ar ? "الدليل (إنجليزي)" : "Guide (English)"}</a>
                    <a className="link" href={NCVC_REQUIREMENTS_URL} target="_blank" rel="noopener">{ar ? "اشتراطات التخييم" : "Camping requirements"}</a>
                  </span>
                </dd>
              </div>
            </dl>
          </details>

          <details id="permit" className="method-more">
            <summary>{dict.home.permitTitle}</summary>
            <div className="method-more-body">
              <p className="max-w-[62ch] text-ink-2">{dict.home.permitLead}</p>
              <p className="small mt-3 max-w-[62ch] text-ink-2">
                {ar
                  ? "ما عندنا ربط مباشر بنظام التصاريح، والحالة محدثة يدويًا بتاريخ التحقق المعروض في صفحة كل مكان."
                  : "We have no live link to the permit system; statuses are updated by hand, with the check date shown on each place page."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <a href={NABATI_URL} target="_blank" rel="noopener" className="btn">
                  {dict.permit.apply}
                  <ExternalLink aria-hidden size={16} />
                </a>
                <a href={ar ? NCVC_GUIDE_AR : NCVC_GUIDE_EN} target="_blank" rel="noopener" className="link inline-flex min-h-11 items-center gap-1.5">
                  {dict.home.guideLink}
                  <ExternalLink aria-hidden size={14} />
                </a>
              </div>
              <p className="small mt-4 max-w-[62ch] text-ink-2">{dict.permit.disclaimer}</p>
            </div>
          </details>

          <details id="ai" className="method-more">
            <summary>{ar ? "مساعد الطلعة: وش يسوي ووش ما يسوي" : "The trip helper: what it does and doesn't do"}</summary>
            <div className="method-more-body max-w-[62ch]">
              <p>
                {ar
                  ? "المساعد يقرأ وصفك ويحوّله لنفس الخيارات اللي في المخطط، ويشرح المكان والليلة اللي اخترتها من أرقام التوقعات. يشتغل على نموذج Llama 4 Scout من Meta عبر Cloudflare Workers AI (أو OpenRouter)."
                  : "The helper reads your description into the same choices the planner offers, and explains your chosen place and night from the forecast numbers. It runs on Meta's Llama 4 Scout through Cloudflare Workers AI (or OpenRouter)."}
              </p>
              <p className="mt-3 text-ink-2">
                {ar
                  ? "ما يحسب التقييم، وما يحدد حالة التصاريح، وما يختار أماكن من عنده. الخادم يرفض أي بديل مو من قائمتنا، ويحذف أي جملة فيها رقم مو موجود في التوقعات."
                  : "It never calculates the score, decides permit status, or picks places of its own. The server rejects any alternative not on our list and drops any sentence quoting a number that isn't in the forecast."}
              </p>
            </div>
          </details>

          <details id="privacy" className="method-more">
            <summary>{dict.footer.privacy}</summary>
            <p className="method-more-body max-w-[62ch] text-ink-2">
              {ar
                ? "ما عندنا حسابات. تفضيلاتك وعلامات قائمة التجهيز تنحفظ في متصفحك فقط (localStorage)، ولغة الموقع في ملف تعريف ارتباط. الوصف اللي تكتبه للمساعد يُرسل لمزوّد النموذج فقط عند ضغطك الزر، فلا تكتب فيه معلومات شخصية."
                : "There are no accounts. Your preferences and checklist ticks stay in your browser (localStorage), and the site language in a cookie. What you type for the helper is sent to the model provider only when you press the button, so don't include personal information."}
            </p>
          </details>

          <details id="credits" className="method-more">
            <summary>{ar ? "الصور والرسومات" : "Photos and illustrations"}</summary>
            <div className="method-more-body">
              <p className="max-w-[62ch] text-ink-2">
                {ar
                  ? "مشاهد الليل في الموقع رسومات توضيحية، مو صور لأماكن. الصور من ويكيميديا كومنز برخص تسمح بالاستخدام، وهي لتضاريس المنطقة وليست للمواقع نفسها إلا إذا ذُكر ذلك."
                  : "The night scenes on this site are illustrations, not pictures of places. Photographs come from Wikimedia Commons under reuse licences; they show the region's terrain, not the sites themselves unless stated."}
              </p>
              <ul className="small mt-4 flex flex-col gap-2">
                {credits.map((c) => (
                  <li key={c.file}>
                    <a className="link" href={c.page} target="_blank" rel="noopener">{c.title}</a> — {c.creator},{" "}
                    {c.licenseUrl ? <a className="link" href={c.licenseUrl} target="_blank" rel="noopener">{c.license}</a> : c.license}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>

        <section id="faq" aria-labelledby="faq-h" className="method-faq">
          <h2 id="faq-h" className="lead font-medium">{dict.home.faqTitle}</h2>
          <div className="mt-3 border-t border-ink/15">
            {dict.home.faq.map((f) => (
              <details key={f.q} className="faq-item">
                <summary>{f.q}</summary>
                <p className="max-w-[62ch] pb-5 text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
