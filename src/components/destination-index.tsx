"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DESTINATIONS, estimateDrive } from "@/lib/destinations";
import { PHOTOS } from "@/lib/photos";
import type { Terrain } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { PermitBadge } from "./permit-panel";

type Filter = "all" | Terrain;
type Sort = "distance" | "name";

/** An editorial index: one lead destination large, the rest as photo rows. */
export function DestinationIndex() {
  const { locale, dict } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [maxHours, setMaxHours] = useState<number>(6);
  const [sort, setSort] = useState<Sort>("distance");

  const list = useMemo(() => {
    const l = DESTINATIONS.filter((d) => (filter === "all" || d.terrain === filter) && estimateDrive(d).hours <= maxHours);
    return l.sort((a, b) =>
      sort === "distance"
        ? estimateDrive(a).hours - estimateDrive(b).hours
        : a.name[locale].localeCompare(b.name[locale], locale),
    );
  }, [filter, maxHours, sort, locale]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: dict.destinations.filterAll },
    { id: "dunes", label: dict.home.groups.dunes },
    { id: "park", label: dict.home.groups.park },
    { id: "meadow", label: dict.home.groups.meadow },
  ];

  const [lead, ...rest] = list;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <fieldset>
          <legend className="sr-only">{dict.nav.destinations}</legend>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <label key={f.id} className="choice">
                <input type="radio" name="terrain" checked={filter === f.id} onChange={() => setFilter(f.id)} />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          {[2, 3, 6].map((h) => (
            <label key={h} className="choice">
              <input type="radio" name="hours" checked={maxHours === h} onChange={() => setMaxHours(h)} />
              {h === 6 ? dict.destinations.filterAll : dict.destinations.within(h)}
            </label>
          ))}
          <label className="ms-2 flex items-center gap-2">
            <span className="small text-ink-2">{dict.destinations.sortLabel}</span>
            <select
              className="field !w-auto !py-2"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="distance">{dict.destinations.sortDistance}</option>
              <option value="name">{dict.destinations.sortName}</option>
            </select>
          </label>
        </div>
      </div>
      <p className="small mt-4 text-ink-2" aria-live="polite">
        {dict.destinations.count(list.length)}
      </p>

      {list.length === 0 && <p className="lead mt-10 bg-sand-2 p-8">{dict.destinations.empty}</p>}

      {lead && (
        <Link href={`/destinations/${lead.slug}`} className="group mt-8 grid gap-6 md:grid-cols-[1.4fr_1fr] md:gap-10">
          <div className="relative aspect-[16/10] overflow-hidden bg-ink">
            <Image
              src={PHOTOS[lead.photo].src}
              alt={PHOTOS[lead.photo].alt[locale]}
              fill
              priority
              sizes="(min-width: 768px) 58vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          </div>
          <div className="flex flex-col justify-end">
            <span className="self-start">
              <PermitBadge status={lead.permit.status} label={dict.permit.status[lead.permit.status]} />
            </span>
            <h2 className="head mt-4 group-hover:text-clay">{lead.name[locale]}</h2>
            <p className="mt-3 text-ink-2">
              {lead.governorate[locale]} · ~{estimateDrive(lead).hours} {dict.common.hours} ({estimateDrive(lead).straightKm}{" "}
              {dict.common.km} {dict.common.straightLine})
            </p>
            <p className="mt-4 max-w-[44ch]">{lead.description[locale]}</p>
          </div>
        </Link>
      )}

      <ul className="mt-16 grid gap-x-10 gap-y-2 md:grid-cols-2">
        {rest.map((d, i) => {
          const drive = estimateDrive(d);
          return (
            <li key={d.slug} data-reveal style={{ ["--i" as string]: i % 4 }}>
              <Link href={`/destinations/${d.slug}`} className="group grid grid-cols-[6.5rem_1fr] items-center gap-5 py-3 transition-colors hover:bg-sand-2 sm:grid-cols-[8.5rem_1fr]">
                <div className="relative aspect-[4/3] overflow-hidden bg-ink">
                  <Image
                    src={PHOTOS[d.photo].src}
                    alt=""
                    fill
                    sizes="140px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="lead font-medium group-hover:text-clay">{d.name[locale]}</h2>
                  <p className="small mt-1 text-ink-2">
                    {d.governorate[locale]} · ~{drive.hours} {dict.common.hours}
                  </p>
                  <p className="small mt-1.5">
                    <span
                      className="me-2 inline-block size-2.5 rounded-full align-middle"
                      aria-hidden
                      style={{ background: d.permit.status === "unverified" ? "var(--color-ink-2)" : "var(--color-clay)" }}
                    />
                    {dict.permit.status[d.permit.status]}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="small mt-10 text-ink-2">{dict.common.photoNote}: {locale === "ar" ? "الصور تمثل تضاريس مشابهة في المنطقة، وكل صورة مكتوب تحتها مكان التقاطها في صفحة الوجهة." : "Photos show similar terrain in the region; each destination page says where its photo was taken."}</p>
    </div>
  );
}
