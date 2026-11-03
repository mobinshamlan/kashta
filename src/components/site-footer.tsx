"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "./locale-provider";
import { Wordmark } from "./site-header";

export function SiteFooter() {
  const { dict } = useI18n();
  const dark = usePathname().startsWith("/stars");
  return (
    <footer className={`site-footer ${dark ? "on-dark bg-night text-star" : "bg-sand text-ink"}`}>
      <div className="frame py-8 md:py-10">
        <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between md:gap-12">
          <div className="flex flex-col items-start gap-3">
            <Link href="/" className="inline-flex" aria-label="KASHTA كشتة">
              <Wordmark className="brand-wordmark-footer" />
            </Link>
            <p className={`small ${dark ? "text-star-2" : "text-ink-2"}`}>{dict.home.footerWhat}</p>
          </div>
          <nav aria-label={dict.nav.menu}>
            <ul className="small grid grid-cols-2 gap-x-8 gap-y-1 md:flex md:flex-wrap md:gap-x-6">
              <li>
                <Link className="link inline-flex min-h-11 items-center" href="/plan">
                  {dict.nav.plan}
                </Link>
              </li>
              <li>
                <Link className="link inline-flex min-h-11 items-center" href="/destinations">
                  {dict.nav.destinations}
                </Link>
              </li>
              <li>
                <Link className="link inline-flex min-h-11 items-center" href="/stars">
                  {dict.nav.stars}
                </Link>
              </li>
              <li>
                <Link className="link inline-flex min-h-11 items-center" href="/about#credits">
                  {dict.footer.credits}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className={`footer-meta small mt-6 pt-5 ${dark ? "text-star-2" : "text-ink-2"}`}>
          <a className="link" href="https://open-meteo.com/" rel="noopener" target="_blank">
            {dict.footer.weatherAttribution}{" "}<bdi className="whitespace-nowrap" dir="ltr">{dict.footer.weatherLicense}</bdi>
          </a>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <Link className="link" href="/about#privacy">
            {dict.footer.privacy}
          </Link>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <span>2026</span>
        </p>
      </div>
    </footer>
  );
}
