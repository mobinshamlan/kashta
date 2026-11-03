import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { DestinationForecast } from "@/components/destination-forecast";
import { PermitPanel } from "@/components/permit-panel";
import { DESTINATIONS, estimateDrive, getDestination } from "@/lib/destinations";
import { getDict } from "@/lib/locale";
import { PHOTOS } from "@/lib/photos";

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/destinations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = getDestination(slug);
  const { locale } = await getDict();
  if (!d) return {};
  return { title: d.name[locale], description: d.description[locale] };
}

export default async function DestinationPage({ params, searchParams }: PageProps<"/destinations/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const d = getDestination(slug);
  if (!d) notFound();
  const { locale, dict } = await getDict();
  const photo = PHOTOS[d.photo];
  const drive = estimateDrive(d);
  const night = typeof sp.night === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.night) ? sp.night : undefined;
  const exp = sp.exp === "stars" || sp.exp === "kashta" ? sp.exp : undefined;
  const osm = `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lon}#map=11/${d.lat}/${d.lon}`;

  return (
    <article>
      {/* Hero: the photograph full-bleed with the name set below it, never on top of it. */}
      <div className="destination-hero relative overflow-hidden bg-ink">
        <Image src={photo.src} alt={photo.alt[locale]} fill priority sizes="100vw" className="drift object-cover" />
        <p className="small absolute bottom-0 start-0 z-10 m-4 bg-ink/80 px-3 py-1.5 text-sand">
          {dict.common.photoNote}: {photo.caption[locale]}
        </p>
      </div>

      <div className="frame">
        <header className="destination-intro grid gap-8 pb-12 pt-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-16 lg:pt-14">
          <div>
            <nav aria-label={dict.common.back} className="small mb-6">
              <Link className="link" href="/destinations">
                {dict.nav.destinations}
              </Link>
            </nav>
            <h1 className="display max-w-[14ch]">{d.name[locale]}</h1>
            <p className="lead mt-6 max-w-[46ch]">{d.description[locale]}</p>
          </div>
          <dl className="destination-facts grid content-center gap-x-8 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="small text-ink-2">{dict.detail.governorate}</dt>
              <dd className="mt-1 lead">{d.governorate[locale]}</dd>
            </div>
            <div>
              <dt className="small text-ink-2">{dict.common.driveEstimate}</dt>
              <dd className="num mt-1 lead">
                ~{drive.hours} {dict.common.hours}
                <span className="small block text-ink-2">
                  {drive.straightKm} {dict.common.km} {dict.common.straightLine}
                </span>
              </dd>
            </div>
            <div>
              <dt className="small text-ink-2">{dict.detail.coordinates}</dt>
              <dd className="num mt-1" dir="ltr" style={{ textAlign: locale === "ar" ? "right" : "left" }}>
                {d.lat.toFixed(4)}, {d.lon.toFixed(4)}
              </dd>
            </div>
            <div>
              <dt className="small text-ink-2">{dict.detail.capacity}</dt>
              <dd className="num mt-1">
                {d.capacity.camping ?? "—"} / {d.capacity.caravans ?? "—"}
                <span className="small block text-ink-2">{locale === "ar" ? "مخيمات / كرفانات" : "camps / caravans"}</span>
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
              <a
                className="link inline-flex min-h-11 items-center gap-1.5"
                href={d.officialMapUrl ?? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lon}`}
                target="_blank"
                rel="noopener"
              >
                {dict.common.openMap}
                <ExternalLink aria-hidden size={14} />
              </a>
              <a className="link inline-flex min-h-11 items-center gap-1.5" href={osm} target="_blank" rel="noopener">
                {dict.common.openOsm}
                <ExternalLink aria-hidden size={14} />
              </a>
            </div>
          </dl>
        </header>

        <section aria-labelledby="forecast-heading" className="pb-20">
          <h2 id="forecast-heading" className="head">
            {dict.detail.forecast}
          </h2>
          <p className="mt-3 mb-8 text-ink-2">{dict.detail.forecastLead}</p>
          <DestinationForecast slug={d.slug} lat={d.lat} lon={d.lon} initialNight={night} initialExperience={exp} />
        </section>

        <div className="grid gap-12 pb-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <PermitPanel permit={d.permit} dict={dict} locale={locale} />
          <section aria-labelledby="facts-heading">
            <h2 id="facts-heading" className="sub">
              {dict.detail.facts}
            </h2>
            <ul className="mt-5 flex list-disc flex-col gap-2 ps-5">
              {d.facts[locale].map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <h3 className="mt-10 font-medium">{dict.common.sources}</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {d.sources.map((s) => (
                <li key={s.url}>
                  <a className="link inline-flex items-center gap-1.5" href={s.url} target="_blank" rel="noopener">
                    {s.title[locale]}
                    <ExternalLink aria-hidden size={14} />
                  </a>
                </li>
              ))}
            </ul>
            <p className="small mt-8 text-ink-2">
              {dict.common.photoNote}: {photo.caption[locale]} — {photo.creator}, {photo.license}.{" "}
              <a className="link" href={photo.page} target="_blank" rel="noopener">
                Wikimedia Commons
              </a>
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
