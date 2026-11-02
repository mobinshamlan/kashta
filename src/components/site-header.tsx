"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Menu, X } from "lucide-react";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { useI18n } from "./locale-provider";
import { BrandMark } from "./brand-mark";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-wordmark ${className}`}>
      <BrandMark className="brand-emblem text-clay" />
      <span className="brand-lettering">
        <span lang="ar" className="brand-arabic">كشتة</span>
        <span lang="en" dir="ltr" className="brand-latin">KASHTA</span>
      </span>
    </span>
  );
}

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      lang={next}
      aria-label={dict.nav.switchLabel}
      disabled={pending}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        startTransition(() => router.refresh());
      }}
      className={`min-h-11 px-3 font-medium transition-colors hover:text-clay ${className}`}
    >
      {dict.nav.switchTo}
    </button>
  );
}

export function SiteHeader() {
  const { dict } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const dark = pathname.startsWith("/stars");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    { href: "/plan", label: dict.nav.plan },
    { href: "/destinations", label: dict.nav.destinations },
    { href: "/stars", label: dict.nav.stars },
    { href: "/about", label: dict.nav.method },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={`site-header sticky top-0 z-40 ${dark ? "on-dark bg-night text-star" : "bg-sand text-ink"}`}>
      <div className="frame flex h-16 items-center justify-between gap-6 lg:h-[4.5rem]">
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center" aria-label="KASHTA كشتة">
          <Wordmark />
        </Link>

        <nav aria-label={dict.nav.menu} className="hidden lg:block">
          <ul className="flex items-center gap-1 lg:gap-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center px-3 transition-colors hover:text-clay ${
                    isActive(l.href) ? "font-medium underline decoration-2 underline-offset-[0.6em]" : ""
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitch />
          <Link href="/plan" className="btn">
            {dict.common.planCta}
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center lg:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden size={24} /> : <Menu aria-hidden size={24} />}
          <span className="sr-only">{open ? dict.nav.close : dict.nav.menu}</span>
        </button>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className={`absolute inset-x-0 top-full lg:hidden ${dark ? "bg-night" : "bg-sand"}`}
      >
        <nav aria-label={dict.nav.menu} className="frame pb-8 pt-2">
          <ul className="flex flex-col">
            {[{ href: "/", label: dict.nav.home }, ...links].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(l.href) && l.href !== "/" ? "page" : undefined}
                  className="flex min-h-14 items-center lead font-light"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between gap-4">
            <Link href="/plan" onClick={() => setOpen(false)} className="btn flex-1">
              {dict.common.planCta}
            </Link>
            <LanguageSwitch />
          </div>
        </nav>
      </div>
    </header>
  );
}
