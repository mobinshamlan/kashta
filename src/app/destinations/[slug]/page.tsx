import type { Metadata } from "next";
import { approxHours } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { DestinationForecast } from "@/components/destination-forecast";
import { PermitBadge, PermitPanel } from "@/components/permit-panel";
import { DESTINATIONS, estimateDrive, getDestination } from "@/lib/destinations";
import { getDict } from "@/lib/locale";
import { PHOTOS } from "@/lib/photos";
import { tuneFromParams } from "@/lib/tune";

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

  // Carried plan settings (from the homepage) come back unchanged, so the plan is exactly as left.
  const carried = new URLSearchParams();
  for (const k of ["group", "drive", "temp", "wind", "pri", "step"]) {
    const v = sp[k];
    if (typeof v === "string" && /^[a-z0-9.,]{1,40}$/.test(v)) carried.set(k, v);
  }
  const tune = tuneFromParams(carried);
  const group = Number(carried.get("group"));
  const back = `/?${new URLSearchParams({ ...(exp ? { mode: exp } : {}), ...(night ? { night } : {}), place: d.slug, ...Object.fromEntries(carried) }).toString()}#${carried.get("step") === "4" ? "plan" : "places"}`;

  return (
    <article>
      {/* The essentials on the night surface: where, how far, permit; the photo beside, captioned. */}
      <header className="place-intro on-night on-dark">
        <div className="frame place-intro-grid">
          <div className="min-w-0">
            <nav aria-label={dict.common.back} className="small">
              <Link className="rec-link inline-flex min-h-11 items-center" href={back}>{dict.detail.backToMap}</Link>
            </nav>
            <h1 className="place-intro-title">{d.name[locale]}</h1>
            <p className="muted mt-1">{d.governorate[locale]}</p>
            <ul className="place-intro-facts mt-5">
              <li title={dict.common.estimateNote}>
                <span className="small muted block">{dict.common.driveEstimate}</span>
                <span className="lead num">{approxHours(drive.hours, locale)}</span>
              </li>
              <li>
                <span className="small muted block">{dict.permit.title}</span>
                <a href="#permit-heading" className="inline-flex min-h-11 items-center"><PermitBadge status={d.permit.status} label={dict.permit.short[d.permit.status]} /></a>
              </li>
            </ul>
            {d.permit.status === "unverified" && <p role="note" className="small mt-4 max-w-[52ch] rounded-lg bg-white/10 p-3">{dict.permit.excluded}</p>}
          </div>
          <figure className="place-intro-photo">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <Image src={photo.src} alt={photo.alt[locale]} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            </div>
            <figcaption className="small muted mt-2">{dict.common.photoNote}: {photo.caption[locale]}</figcaption>
          </figure>
        </div>
      </header>

      <div className="frame">
        <section aria-labelledby="forecast-heading" className="pb-14 pt-10">
          <h2 id="forecast-heading" className="home-h2">{dict.detail.forecast}</h2>
          <div className="mt-6">
            <DestinationForecast slug={d.slug} lat={d.lat} lon={d.lon} initialNight={night} initialExperience={exp} initialTune={carried.size ? { ...tune, ...(Number.isInteger(group) && group >= 1 && group <= 40 ? { groupSize: group } : {}) } : undefined} />
          </div>
        </section>

        <div className="pb-10">
          <PermitPanel permit={d.permit} dict={dict} locale={locale} />
        </div>

        {/* Everything else is reference: open it on purpose. */}
        <details className="place-more mb-16">
          <summary className="place-more-summary">{dict.detail.infoMore}</summary>
          <div className="mt-6 grid gap-10 lg:grid-cols-2">
            <div>
              <p className="max-w-[56ch]">{d.description[locale]}</p>
              <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="small text-ink-2">{dict.common.driveEstimate}</dt>
                  <dd className="small mt-1"><bdi className="num">{drive.straightKm} {dict.common.km}</bdi> {dict.common.straightLine}. {dict.common.estimateNote}.</dd>
                </div>
                <div>
                  <dt className="small text-ink-2">{dict.detail.coordinates}</dt>
                  <dd className="num mt-1" dir="ltr" style={{ textAlign: locale === "ar" ? "right" : "left" }}><bdi>{d.lat.toFixed(4)}, {d.lon.toFixed(4)}</bdi></dd>
                </div>
                <div>
                  <dt className="small text-ink-2">{dict.detail.capacity}</dt>
                  <dd className="num mt-1">
                    {locale === "ar" ? "مخيمات" : "Camps"}: <bdi>{d.capacity.camping ?? "—"}</bdi> · {locale === "ar" ? "كرفانات" : "Caravans"}: <bdi>{d.capacity.caravans ?? "—"}</bdi>
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">{dict.detail.location}</dt>
                  <dd className="flex flex-wrap gap-x-5">
                    <a className="link inline-flex min-h-11 items-center gap-1.5" href={d.officialMapUrl ?? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lon}`} target="_blank" rel="noopener">
                      {dict.common.openMap}<ExternalLink aria-hidden size={14} />
                    </a>
                    <a className="link inline-flex min-h-11 items-center gap-1.5" href={osm} target="_blank" rel="noopener">
                      {dict.common.openOsm}<ExternalLink aria-hidden size={14} />
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
            <section aria-labelledby="facts-heading">
              <h2 id="facts-heading" className="font-medium">{dict.detail.facts}</h2>
              <ul className="mt-3 flex list-disc flex-col gap-2 ps-5">
                {d.facts[locale].map((f) => <li key={f}>{f}</li>)}
              </ul>
              <h3 className="mt-8 font-medium">{dict.common.sources}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {d.sources.map((src) => (
                  <li key={src.url}>
                    <a className="link inline-flex min-h-11 items-center gap-1.5" href={src.url} target="_blank" rel="noopener">
                      {src.title[locale]}<ExternalLink aria-hidden size={14} />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="small mt-6 text-ink-2">
                {dict.common.photoNote}: {photo.caption[locale]} — {photo.creator}, {photo.license}.{" "}
                <a className="link" href={photo.page} target="_blank" rel="noopener">Wikimedia Commons</a>
              </p>
            </section>
          </div>
        </details>
      </div>
    </article>
  );
}
