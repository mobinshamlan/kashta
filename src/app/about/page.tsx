import type { Metadata } from "next";
import credits from "../../../public/photos/credits.json";
import { NABATI_URL, NCVC_GUIDE_AR, NCVC_GUIDE_EN, NCVC_REQUIREMENTS_URL } from "@/lib/destinations";
import { getDict } from "@/lib/locale";
import {
  BASE_WEIGHTS,
  CLOUD_LIMITS,
  DUST_LIMITS,
  GUST_LIMITS,
  PRIORITY_BOOST,
  RAIN_LIMITS,
  TEMP_BANDS,
} from "@/lib/score";
import type { Factor } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.about.title, description: dict.about.lead };
}

export default async function AboutPage() {
  const { locale, dict } = await getDict();
  const ar = locale === "ar";
  const h2 = "sub";
  const factorOrder: Factor[] = ["temp", "wind", "rain", "dust", "clouds", "moon"];

  return (
    <div className="frame pb-10 pt-10 md:pt-16">
      <header className="max-w-[52rem]">
        <h1 className="display">{dict.about.title}</h1>
        <p className="lead mt-6 max-w-[46ch]">{dict.about.lead}</p>
      </header>

      <section aria-labelledby="score-h" className="mt-24 grid gap-10 lg:grid-cols-12">
        <h2 id="score-h" className={`${h2} lg:col-span-4`}>
          {ar ? "معادلة تقييم كشتة" : "The Kashta Score formula"}
        </h2>
        <div className="min-w-0 lg:col-span-8">
          <p className="max-w-[62ch]">
            {ar
              ? "كل عامل يتحول إلى درجة من 0 إلى 100 بخط مستقيم بين حد «جيد» وحد «سيئ»، ثم نأخذ المتوسط الموزون. الأولوية اللي تختارها تضاعف وزن العامل "
              : "Each factor becomes a 0–100 score along a straight line between a “good” and a “bad” limit, then we take the weighted average. A priority you choose multiplies that factor's weight by "}
            <span className="num">{PRIORITY_BOOST}</span>
            {ar
              ? " قبل إعادة توزيع الأوزان. إذا وصل عامل لحده الخطر (هبات فوق حد تحملك، أو مطر 70% أو أكثر، أو غبار 400 ميكروغرام/م³ أو أكثر) ينحد التقييم عند 35. وإذا نقصت بيانات أي عامل ما نعطي رقمًا."
              : " before the weights are rebalanced. If a factor hits its danger limit (gusts beyond your tolerance, rain chance of 70% or more, or dust of 400 μg/m³ or more) the score is capped at 35. If any factor's data is missing, we give no number."}
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="num w-full min-w-[36rem] text-start">
              <thead>
                <tr className="text-ink-2">
                  <th className="py-2 pe-4 text-start font-normal">{ar ? "العامل" : "Factor"}</th>
                  <th className="py-2 pe-4 text-start font-normal">{dict.experience.kashta}</th>
                  <th className="py-2 pe-4 text-start font-normal">{dict.experience.stars}</th>
                  <th className="py-2 text-start font-normal">{ar ? "القياس والحدود" : "Measure and limits"}</th>
                </tr>
              </thead>
              <tbody>
                {factorOrder.map((f) => (
                  <tr key={f} className="align-top even:bg-sand-2">
                    <th scope="row" className="py-3 pe-4 text-start font-medium">
                      {dict.factor[f]}
                    </th>
                    <td className="py-3 pe-4">{BASE_WEIGHTS.kashta[f] ? `${Math.round(BASE_WEIGHTS.kashta[f]! * 100)}%` : "—"}</td>
                    <td className="py-3 pe-4">{BASE_WEIGHTS.stars[f] ? `${Math.round(BASE_WEIGHTS.stars[f]! * 100)}%` : "—"}</td>
                    <td className="py-3">
                      {dict.factorHint[f]}.{" "}
                      {f === "temp" &&
                        (ar
                          ? `نطاق الراحة لحرارة المساء: بارد ${TEMP_BANDS.cool.join("–")}°، معتدل ${TEMP_BANDS.mild.join("–")}°، دافئ ${TEMP_BANDS.warm.join("–")}°. نخصم 8 نقاط لكل درجة خارج النطاق، و5 لكل درجة إحساس تحت 4° آخر الليل.`
                          : `Evening comfort band: cool ${TEMP_BANDS.cool.join("–")}°, mild ${TEMP_BANDS.mild.join("–")}°, warm ${TEMP_BANDS.warm.join("–")}°. −8 per degree outside the band, −5 per feels-like degree below 4° before dawn.`)}
                      {f === "wind" &&
                        (ar
                          ? `الهبات (كم/س): ما أتحمله ${GUST_LIMITS.low.good}→${GUST_LIMITS.low.bad}، عادي ${GUST_LIMITS.medium.good}→${GUST_LIMITS.medium.bad}، ما يفرق ${GUST_LIMITS.high.good}→${GUST_LIMITS.high.bad}.`
                          : `Gusts (km/h): can't stand it ${GUST_LIMITS.low.good}→${GUST_LIMITS.low.bad}, some is fine ${GUST_LIMITS.medium.good}→${GUST_LIMITS.medium.bad}, doesn't bother me ${GUST_LIMITS.high.good}→${GUST_LIMITS.high.bad}.`)}
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
              ? "الليلة تمتد من 6 مساءً إلى 5 فجرًا بتوقيت الرياض. نعتمد قياسًا فقط إذا توفر لنصف ساعات الليلة على الأقل."
              : "A night runs from 6 pm to 5 am Riyadh time. A measurement counts only if at least half the night's hours have it."}
          </p>
        </div>
      </section>

      <section aria-labelledby="data-h" className="mt-24 grid gap-10 lg:grid-cols-12">
        <h2 id="data-h" className={`${h2} lg:col-span-4`}>
          {ar ? "مصادر البيانات" : "Data sources"}
        </h2>
        <dl className="grid gap-6 lg:col-span-8">
          <div>
            <dt className="font-medium">Open-Meteo Forecast API</dt>
            <dd className="mt-1 max-w-[62ch]">
              {ar
                ? "الحرارة، الإحساس الحراري، الرياح والهبات، احتمال المطر وكميته، والغيوم، لثمانية أيام. مجاني للاستخدام غير التجاري، والبيانات برخصة CC BY 4.0. نخزن الردود 30 دقيقة لتقليل الطلبات."
                : "Temperature, feels-like, wind and gusts, rain chance and amount, and cloud cover for eight days. Free for non-commercial use; data under CC BY 4.0. Responses are cached for 30 minutes."}{" "}
              <a className="link" href="https://open-meteo.com/en/docs" target="_blank" rel="noopener">
                open-meteo.com
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Open-Meteo Air Quality API (CAMS)</dt>
            <dd className="mt-1 max-w-[62ch]">
              {ar
                ? "الغبار قرب السطح وPM10 من نموذج Copernicus CAMS العالمي (دقة تقارب 45 كم)، لسبعة أيام كحد أقصى، لذلك قد تكون آخر ليلة ناقصة."
                : "Surface dust and PM10 from the global Copernicus CAMS model (about 45 km resolution), up to seven days, so the last night may be incomplete."}{" "}
              <a className="link" href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noopener">
                {ar ? "التوثيق" : "Documentation"}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium">{ar ? "القمر والشمس" : "Moon and sun"}</dt>
            <dd className="mt-1 max-w-[62ch]">
              {ar ? "نحسب الإضاءة والشروق والغروب والظلام الفلكي محليًا بمكتبة SunCalc مفتوحة المصدر." : "Illumination, rise, set and astronomical darkness are calculated locally with the open-source SunCalc library."}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{ar ? "المواقع والتصاريح" : "Sites and permits"}</dt>
            <dd className="mt-1 max-w-[62ch]">
              {ar
                ? "مواقع منطقة الرياض وطاقتها ونقاط دخولها من دليل التخييم والكرفانات في مواقع الغطاء النباتي 2025 الصادر عن المركز الوطني لتنمية الغطاء النباتي ومكافحة التصحر. ما عندنا ربط مباشر بنظام التصاريح، والحالة محدثة يدويًا بتاريخ التحقق المعروض."
                : "Riyadh-region sites, capacities and entry points come from the NCVC Camping and Caravan Guide in Vegetation Cover Areas 2025. We have no live link to the permit system; statuses are updated by hand with the check date shown."}
              <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                <a className="link" href={NCVC_GUIDE_AR} target="_blank" rel="noopener">
                  {ar ? "الدليل (عربي)" : "Guide (Arabic)"}
                </a>
                <a className="link" href={NCVC_GUIDE_EN} target="_blank" rel="noopener">
                  {ar ? "الدليل (إنجليزي)" : "Guide (English)"}
                </a>
                <a className="link" href={NCVC_REQUIREMENTS_URL} target="_blank" rel="noopener">
                  {ar ? "اشتراطات التخييم" : "Camping requirements"}
                </a>
                <a className="link" href={NABATI_URL} target="_blank" rel="noopener">
                  {ar ? "منصة نباتي" : "Nabati platform"}
                </a>
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-medium">{ar ? "المسافات" : "Distances"}</dt>
            <dd className="mt-1 max-w-[62ch]">
              {ar
                ? "المسافة المباشرة من وسط الرياض × 1.3 معامل طرق، بمتوسط 90 كم/س. تقدير فقط وليس مسار ملاحة."
                : "Straight-line distance from central Riyadh × 1.3 road factor at 90 km/h average. An estimate, not a route."}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="ai-h" className="mt-24 grid gap-10 lg:grid-cols-12">
        <h2 id="ai-h" className={`${h2} lg:col-span-4`}>
          {ar ? "دور Llama" : "What Llama does"}
        </h2>
        <div className="max-w-[62ch] lg:col-span-8">
          <p>
            {ar
              ? "نستخدم نموذج Llama 4 Scout من Meta عبر Cloudflare Workers AI (أو OpenRouter) في مهمتين: تحويل وصفك إلى إعدادات منظمة، وكتابة شرح وتجهيزات بالاعتماد على أرقام التوقعات. الخادم يتحقق من كل رد بمخطط Zod، ويرفض أي اقتراح بديل ليس من القائمة اللي أرسلناها، ويحذف أي جملة تذكر رقمًا غير موجود في التوقعات."
              : "We use Meta's Llama 4 Scout through Cloudflare Workers AI (or OpenRouter) for two jobs: turning your description into structured settings, and writing an explanation and preparations from the forecast numbers. The server validates every reply with a Zod schema, rejects any alternative not in the list we sent, and drops any sentence quoting a number that isn't in the forecast."}
          </p>
          <p className="mt-4">
            {ar
              ? "Llama ما يحسب التقييم، وما يحدد حالة التصاريح، وما يضيف معلومات عن المواقع."
              : "Llama never calculates the score, decides permit status, or adds facts about sites."}
          </p>
        </div>
      </section>

      <section id="privacy" aria-labelledby="privacy-h" className="mt-24 grid scroll-mt-8 gap-10 lg:grid-cols-12">
        <h2 id="privacy-h" className={`${h2} lg:col-span-4`}>
          {dict.footer.privacy}
        </h2>
        <p className="max-w-[62ch] lg:col-span-8">
          {ar
            ? "ما عندنا حسابات. تفضيلاتك وعلامات قائمة التجهيز تنحفظ في متصفحك فقط (localStorage)، ولغة الموقع في ملف تعريف ارتباط. الوصف اللي تكتبه يُرسل لمزود Llama لمعالجته فقط عند ضغطك الزر، فلا تكتب فيه معلومات شخصية."
            : "There are no accounts. Your preferences and checklist ticks stay in your browser (localStorage), and the site language in a cookie. The description you type is sent to the Llama provider only when you press the button, so don't include personal information."}
        </p>
      </section>

      <section id="credits" aria-labelledby="credits-h" className="mt-24 grid scroll-mt-8 gap-10 lg:grid-cols-12">
        <h2 id="credits-h" className={`${h2} lg:col-span-4`}>
          {ar ? "الصور" : "Photographs"}
        </h2>
        <div className="min-w-0 lg:col-span-8">
          <p className="max-w-[62ch] text-ink-2">
            {ar
              ? "كل الصور من ويكيميديا كومنز برخص تسمح بالاستخدام. هي صور توضيحية لتضاريس المنطقة، وليست صورًا للمواقع نفسها إلا إذا ذُكر ذلك."
              : "All photographs come from Wikimedia Commons under licences that allow reuse. They illustrate the region's terrain and are not pictures of the sites themselves unless stated."}
          </p>
          <ul className="small mt-6 flex flex-col gap-3">
            {credits.map((c) => (
              <li key={c.file}>
                <a className="link" href={c.page} target="_blank" rel="noopener">
                  {c.title}
                </a>{" "}
                — {c.creator}, {c.licenseUrl ? (
                  <a className="link" href={c.licenseUrl} target="_blank" rel="noopener">
                    {c.license}
                  </a>
                ) : (
                  c.license
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
