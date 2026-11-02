"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PHOTOS } from "@/lib/photos";
import type { PhotoKey } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { BrandMark } from "./brand-mark";

/**
 * The fixed half of the split stage. Each reading section carries data-stage="<index>";
 * when one crosses the middle of the viewport its photograph crossfades in (1.6 s).
 * Under reduced motion the swap is instant.
 */
export function StagePhoto({ photos }: { photos: PhotoKey[] }) {
  const { locale } = useI18n();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-stage]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number(e.target.getAttribute("data-stage")) || 0);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = PHOTOS[photos[active]];

  return (
    <div className="stage-photo relative h-[62svh] overflow-hidden bg-ink lg:sticky lg:top-[4.5rem] lg:h-[calc(100svh-4.5rem)]">
      <div className="relative h-full w-full">
      {photos.map((key, i) => {
        const p = PHOTOS[key];
        return (
          <Image
            key={key}
            src={p.src}
            alt={i === active ? p.alt[locale] : ""}
            aria-hidden={i !== active}
            fill
            priority={i === 0}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className={`crossfade object-cover ${i === active ? "opacity-100" : "opacity-0"} ${i === 0 ? "drift" : ""}`}
          />
        );
      })}
      </div>
      <div className="stage-scrim pointer-events-none absolute inset-0" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-8 text-white/90">
        <BrandMark className="h-12 w-14" />
        <span className="small">{locale === "ar" ? "على مهل البرّ" : "At the desert’s pace"}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-8 text-white">
        <p className="stage-title mb-5">{locale === "ar" ? "وسّع صدرك." : "Room to breathe."}</p>
        <p className="small border-t border-white/35 pt-4" aria-live="polite">{current.caption[locale]}</p>
      </div>
    </div>
  );
}
