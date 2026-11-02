"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "./locale-provider";

export function SiteFooter() {
  const { dict } = useI18n();
  const dark = usePathname().startsWith("/stars");
  return (
    <footer className={dark ? "on-dark bg-night text-star" : "bg-sand text-ink"}>
      <div className="frame pb-8 pt-[min(20svh,10rem)]">
        <p aria-hidden className="mb-10 select-none text-[clamp(4.5rem,19vw,17rem)] font-light leading-[0.9]">
          كشتة
        </p>
        <div className="small grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-baseline md:gap-8">
          <p className={dark ? "text-star-2" : "text-ink-2"}>{dict.home.footerWhat}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link className="link" href="/plan">
                {dict.nav.plan}
              </Link>
            </li>
            <li>
              <Link className="link" href="/destinations">
                {dict.nav.destinations}
              </Link>
            </li>
            <li>
              <Link className="link" href="/stars">
                {dict.nav.stars}
              </Link>
            </li>
            <li>
              <Link className="link" href="/about#credits">
                {dict.footer.credits}
              </Link>
            </li>
          </ul>
          <p className={`md:text-end ${dark ? "text-star-2" : "text-ink-2"}`}>
            <a className="link" href="https://open-meteo.com/" rel="noopener" target="_blank">
              {dict.footer.weatherAttribution}
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
      </div>
    </footer>
  );
}
