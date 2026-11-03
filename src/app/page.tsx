import Image from "next/image";
import { approxHours, listJoin } from "@/lib/i18n";
import Link from "next/link";
import { ArrowDown, ArrowUpLeft, ExternalLink, MapPin, Moon, Wind } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { StagePhoto } from "@/components/stage-photo";
import { WeekStrip } from "@/components/week-strip";
import { DESTINATIONS, estimateDrive, NABATI_URL, NCVC_GUIDE_AR } from "@/lib/destinations";
import { getDict } from "@/lib/locale";
import { PHOTOS } from "@/lib/photos";
import type { PermitStatus, Terrain } from "@/lib/types";

const STATUSES: PermitStatus[] = ["permit_required", "unverified", "verified_permitted", "restricted"];
const STATUS_TEXT: Record<PermitStatus, { ar: string; en: string }> = {
  permit_required: {
    ar: "مدرج رسميًا كموقع تخييم، والتخييم فيه بتصريح من منصة نباتي.",
    en: "Officially listed as a camping site; camping needs a Nabati permit.",
  },
  unverified: {
    ar: "ما لقينا مصدرًا رسميًا يحسم الحالة، فما نفترض شي.",
    en: "No official source settles it, so we assume nothing.",
  },
  verified_permitted: {
    ar: "مصدر رسمي يسمح بالتخييم بشروط محددة.",
    en: "An official source allows camping under stated conditions.",
  },
  restricted: {
    ar: "مصدر رسمي يقيد التخييم أو يمنعه.",
    en: "An official source restricts or forbids camping.",
  },
};

export default async function Home() {
  const { locale, dict } = await getDict();
  const t = dict.home;
  const groups: Terrain[] = ["dunes", "park", "meadow"];
  const sample = encodeURIComponent(t.describeSample);

  return (
    <>
      {/* The split stage: reading column on the start side, a fixed photograph on the other. */}
      <div className="flex flex-col lg:grid lg:grid-cols-2">
        <div className="frame pb-24 lg:pb-40">
          <section data-stage="0" className="home-hero flex flex-col justify-center pb-8 pt-8 md:pt-14 lg:min-h-[calc(100svh-4.5rem)] lg:py-16">
            <p className="hero-location small flex items-center gap-2 text-olive"><MapPin size={15} aria-hidden />{locale === "ar" ? "من الرياض، للبرّ" : "From Riyadh, into the open"}</p>
            <h1 className="hero-title display mt-6 whitespace-pre-line">{t.h1}</h1>
            <p className="hero-copy mt-6 max-w-[40ch] text-ink-2 md:mt-8">{t.lead}</p>
            <div className="hero-actions mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 md:mt-10">
              <Link href="/plan" className="btn">
                {dict.common.planCta}
                <ArrowUpLeft aria-hidden size={19} className="direction-arrow" />
              </Link>
              <Link href="/stars" className="link inline-flex min-h-11 items-center">
                {t.secondary}
              </Link>
              <Link href="/destinations" className="link inline-flex min-h-11 items-center">
                {dict.nav.destinations}
              </Link>
            </div>
            <div className="hero-facts small mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-ink/15 pt-5 text-ink-2">
              <span className="inline-flex items-center gap-2"><Moon size={16} aria-hidden />{locale === "ar" ? "٧ ليالٍ قدّامك" : "Seven nights ahead"}</span>
              <span className="inline-flex items-center gap-2"><Wind size={16} aria-hidden />{locale === "ar" ? "توقعات فعلية، قرار أوضح" : "Real forecasts. A clearer choice."}</span>
            </div>
            <a href="#week-heading" className="hero-scroll small mt-8 hidden items-center gap-2 self-start text-olive lg:inline-flex"><ArrowDown size={16} aria-hidden />{locale === "ar" ? "شف ليالي هالأسبوع" : "Explore this week"}</a>
            <figure className="hero-mobile-photo relative mt-8 aspect-[4/3] overflow-hidden bg-ink md:aspect-[16/9] lg:hidden">
              <Image
                src={PHOTOS["dahna-ridge"].src}
                alt={PHOTOS["dahna-ridge"].alt[locale]}
                fill
                priority
                sizes="100vw"
                className="drift object-cover"
              />
              <figcaption className="small absolute bottom-0 start-0 m-4 bg-ink/80 px-3 py-1.5 text-sand">
                {PHOTOS["dahna-ridge"].caption[locale]}
              </figcaption>
            </figure>
          </section>

          <section data-stage="1" aria-labelledby="week-heading" className="pt-10 lg:pt-24">
            <h2 id="week-heading" className="sub" data-reveal>
              {t.weekTitle}
            </h2>
            <p className="mt-3 mb-8 max-w-[46ch] text-ink-2" data-reveal>
              {t.weekLead}
            </p>
            <WeekStrip />
          </section>

          <section aria-labelledby="steps-heading" className="pt-20 lg:pt-40">
            <h2 id="steps-heading" className="sub" data-reveal>
              {t.stepsTitle}
            </h2>
            <ol className="mt-4">
              {t.steps.map((s, i) => (
                <li
                  key={s.head}
                  data-stage={String(i + 2)}
                  className="flex flex-col justify-center py-8 lg:min-h-[46svh] lg:py-10"
                >
                  <p className="lead" data-reveal>
                    {s.head}
                  </p>
                  <p className="mt-4 max-w-[44ch] text-ink-2" data-reveal style={{ ["--i" as string]: 1 }}>
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="hidden lg:block">
          <StagePhoto photos={["dahna-ridge", "camp-night", "tuwaiq-canyon", "tuwaiq-haze", "dahna-crest"]} />
        </div>
      </div>

      <div className="brand-divider frame flex flex-wrap items-center justify-between gap-4 bg-olive py-6 text-sand">
        <p className="lead">{locale === "ar" ? "قهوة على الجمر، وباقي السالفة عليك." : "Coffee over the embers. The rest is your story."}</p>
        <BrandMark className="h-10 w-14 shrink-0" />
      </div>

      {/* Input half, output half: the description the user writes and the settings it becomes. */}
      <section aria-labelledby="describe-heading" className="grid md:grid-cols-2">
        <div className="on-dark flex min-h-[62svh] flex-col justify-between bg-ink p-[clamp(1.25rem,4vw,4rem)] text-sand md:min-h-[86svh]">
          <blockquote className="mt-[12svh] max-w-[22ch] lead font-light" data-reveal>
            «{t.describeSample}»
          </blockquote>
          <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
            <h2 id="describe-heading" className="head" data-reveal>
              {t.describeTitleStart}
            </h2>
            <Link href={`/plan?q=${sample}`} className="btn" data-reveal>
              {t.describeTry}
            </Link>
          </div>
        </div>
        <div className="flex min-h-[62svh] flex-col justify-between bg-sand-2 p-[clamp(1.25rem,4vw,4rem)] md:min-h-[86svh]">
          <div className="mt-[12svh] max-w-[30rem]" data-ui data-reveal>
            <p className="small mb-4 font-medium text-ink-2">{t.describeExample}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 bg-sand p-6">
              <dt className="text-ink-2">{dict.plan.experienceLabel}</dt>
              <dd className="font-medium">{dict.experience.stars}</dd>
              <dt className="text-ink-2">{dict.plan.groupLabel}</dt>
              <dd className="num font-medium">5</dd>
              <dt className="text-ink-2">{dict.plan.windLabel}</dt>
              <dd className="font-medium">{dict.wind.low}</dd>
              <dt className="text-ink-2">{dict.plan.prioritiesLabel}</dt>
              <dd className="font-medium">
                {listJoin([dict.factor.dust, dict.factor.wind, dict.factor.clouds], locale)}
              </dd>
            </dl>
            <p className="small mt-5 max-w-[44ch] text-ink-2">{t.describeNote}</p>
          </div>
          <h2 aria-hidden className="head mt-10" data-reveal>
            {t.describeTitleEnd}
          </h2>
        </div>
      </section>

      {/* Two-ended rows in a narrow column, beside a picture of the terrain. */}
      <section aria-labelledby="list-heading" className="frame grid gap-12 py-[clamp(7rem,14vw,12rem)] lg:grid-cols-[minmax(0,34rem)_1fr] lg:gap-20">
        <div>
          <h2 id="list-heading" className="sub" data-reveal>
            {t.listTitle}
          </h2>
          <p className="mt-3 max-w-[44ch] text-ink-2" data-reveal>
            {t.listLead}
          </p>
          {groups.map((g) => {
            const items = DESTINATIONS.filter((d) => d.terrain === g).sort(
              (a, b) => estimateDrive(a).hours - estimateDrive(b).hours,
            );
            return (
              <div key={g} className="mt-10">
                <h3 className="small mb-2 text-ink-2">{t.groups[g]}</h3>
                <ul>
                  {items.map((d, i) => (
                    <li key={d.slug} data-reveal style={{ ["--i" as string]: i % 6 }}>
                      <Link
                        href={`/destinations/${d.slug}`}
                        className="group flex min-h-11 items-center justify-between gap-4 py-1.5 transition-colors hover:text-clay"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="size-4 shrink-0 rounded-full"
                            style={{ background: d.permit.status === "unverified" ? "var(--color-ink-2)" : "var(--color-clay)" }}
                          />
                          <span>{d.name[locale]}</span>
                        </span>
                        <span className="small num shrink-0 text-ink-2">
                          {approxHours(estimateDrive(d).hours, locale)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <figure className="lg:sticky lg:top-8 lg:self-start" data-reveal>
          <Image
            src={PHOTOS["tawqi-dune"].src}
            alt={PHOTOS["tawqi-dune"].alt[locale]}
            width={PHOTOS["tawqi-dune"].width}
            height={PHOTOS["tawqi-dune"].height}
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="aspect-[4/5] w-full object-cover lg:aspect-[4/5]"
          />
          <figcaption className="small mt-3 text-ink-2">{PHOTOS["tawqi-dune"].caption[locale]}</figcaption>
        </figure>
      </section>

      {/* Star Hunter: the one full-bleed night section. */}
      <section aria-labelledby="stars-heading" className="on-dark grid bg-night text-star md:grid-cols-[1fr_minmax(0,0.8fr)]">
        <div className="flex flex-col justify-center p-[clamp(1.25rem,5vw,5rem)] py-20">
          <h2 id="stars-heading" className="head" data-reveal>
            {t.starsTitle}
          </h2>
          <p className="lead mt-6 max-w-[34ch] text-star" data-reveal>
            {t.starsLead}
          </p>
          <Link href="/stars" className="btn mt-10 self-start" data-reveal>
            {t.starsCta}
          </Link>
        </div>
        <figure className="relative min-h-[70svh] overflow-hidden">
          <Image
            src={PHOTOS["alula-sky"].src}
            alt={PHOTOS["alula-sky"].alt[locale]}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="drift object-cover"
          />
          <figcaption className="small absolute bottom-0 start-0 m-4 bg-night/85 px-3 py-1.5">
            {PHOTOS["alula-sky"].caption[locale]}
          </figcaption>
        </figure>
      </section>

      {/* Permit: a full olive field. */}
      <section aria-labelledby="permit-home-heading" className="bg-olive text-olive-ink">
        <div className="frame grid gap-12 py-[clamp(6rem,12vw,10rem)] lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 id="permit-home-heading" className="head" data-reveal>
              {t.permitTitle}
            </h2>
            <p className="lead mt-6 max-w-[38ch]" data-reveal>
              {t.permitLead}
            </p>
            <div className="mt-10 flex flex-wrap gap-4" data-reveal>
              <a
                href={NABATI_URL}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-12 items-center gap-2 bg-olive-ink px-5 font-medium text-olive transition-colors hover:bg-sand"
              >
                {dict.permit.apply}
                <ExternalLink aria-hidden size={16} />
              </a>
              <a href={NCVC_GUIDE_AR} target="_blank" rel="noopener" className="link inline-flex min-h-12 items-center">
                {locale === "ar" ? "دليل التخييم الرسمي (PDF)" : "Official camping guide (PDF)"}
              </a>
            </div>
          </div>
          <dl className="grid content-start gap-8">
            {STATUSES.map((s, i) => (
              <div key={s} data-reveal style={{ ["--i" as string]: i }}>
                <dt className="lead font-medium">{dict.permit.status[s]}</dt>
                <dd className="mt-1 max-w-[46ch] opacity-90">{STATUS_TEXT[s][locale]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FAQ as reading text. */}
      <section aria-labelledby="faq-heading" className="frame grid gap-10 pt-[clamp(7rem,14vw,12rem)] lg:grid-cols-12">
        <h2 id="faq-heading" className="sub lg:col-span-3" data-reveal>
          {t.faqTitle}
        </h2>
        <div className="lg:col-span-9 md:columns-2 md:gap-14">
          {t.faq.map((f) => (
            <p key={f.q} className="mb-5 break-inside-avoid" data-reveal>
              <strong className="font-medium">{f.q}</strong> <span className="text-ink">{f.a}</span>
            </p>
          ))}
        </div>
      </section>
    </>
  );
}
