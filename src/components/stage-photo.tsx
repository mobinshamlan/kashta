"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PHOTOS } from "@/lib/photos";
import type { PhotoKey } from "@/lib/types";
import { useI18n } from "./locale-provider";

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
    <div className="relative h-[62svh] overflow-hidden bg-ink lg:sticky lg:top-0 lg:h-svh">
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
      <p className="small absolute bottom-0 start-0 m-4 bg-ink/80 px-3 py-1.5 text-sand" aria-live="polite">
        {current.caption[locale]}
      </p>
    </div>
  );
}
