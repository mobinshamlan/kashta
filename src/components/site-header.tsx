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
      <BrandMark className="brand-emblem text-[var(--brand-mark,var(--color-clay))]" />
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
      className={`lang-chip ${className}`}
    >
      {/* One letter is enough to signal the other language; the accessible name says it in full. */}
      <span aria-hidden>{locale === "ar" ? "E" : "ع"}</span>
    </button>
  );
}

export function SiteHeader() {
  const { dict } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Pages that open on the night scene get the night header, so the two read as one surface.
  const dark = pathname === "/" || pathname === "/about" || pathname.startsWith("/destinations/");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [
    { href: "/", label: dict.nav.nights },
    { href: "/plan", label: dict.nav.plan },
    { href: "/about", label: dict.nav.method },
  ];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className={`site-header sticky top-0 z-40 ${dark ? "on-dark bg-sky text-star" : "bg-sand text-ink"}`}>
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

        <div className="flex items-center gap-1">
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
          <LanguageSwitch />
        </div>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className={`absolute inset-x-0 top-full lg:hidden ${dark ? "bg-sky" : "bg-sand"}`}
      >
        <nav aria-label={dict.nav.menu} className="frame pb-8 pt-2">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="flex min-h-14 items-center lead font-light"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
