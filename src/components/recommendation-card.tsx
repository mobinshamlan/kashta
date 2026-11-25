"use client";

import Link from "next/link";
import { Car, ChevronDown, Cloud, CloudFog, CloudRain, ExternalLink, Moon, ShieldAlert, ShieldCheck, Star, Thermometer, TriangleAlert, Wind } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import type { NightSummary, ScoreRow } from "@/lib/api-types";
import { estimateDrive, getDestination } from "@/lib/destinations";
import { approxHours, formatNight } from "@/lib/i18n";
import { nightReasons, type Reason } from "@/lib/reasons";
import type { CityId, Experience, Factor, HourPoint } from "@/lib/types";
import { NightWindow } from "./night-window";
import { useI18n } from "./locale-provider";
import { RATING_COLOR } from "./ui";
import { rating } from "@/lib/score";

const FACTOR_ICON: Record<Factor, typeof Wind> = {
  temp: Thermometer,
  wind: Wind,
  rain: CloudRain,
  dust: CloudFog,
  clouds: Cloud,
  moon: Moon,
};

export function ReasonList({ reasons, className = "" }: { reasons: Reason[]; className?: string }) {
  const { dict } = useI18n();
  const t = dict.reasons;
  if (!reasons.length) return null;
  return (
    <ul className={`rec-reasons ${className}`}>
      {reasons.map((r) => {
        const Icon = r.tone === "caution" ? TriangleAlert : FACTOR_ICON[r.factor];
        const head = r.tone === "caution" ? t.caution[r.factor] : t.good[r.factor][r.tier === "high" ? "high" : "ok"];
        return (
          <li key={r.factor} data-tone={r.tone}>
            <Icon aria-hidden size={18} />
            <span>
              <span className="font-medium">{head}</span>
              <span className="muted"> — <bdi className="num">{t.detail[r.factor](r.values)}</bdi></span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The one recommendation: night, place, approximate drive, real reasons, permit status. */
export function RecommendationCard({
  row,
  metrics,
  experience,
  kicker,
  actions,
  headingLevel = 2,
  hours,
  compact = false,
  facts = true,
  details,
  city = "riyadh",
}: {
  /** Where the drive is measured from. */
  city?: CityId;
  row: ScoreRow;
  metrics: NightSummary | undefined;
  experience: Experience;
  kicker: string;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  /** Hourly forecast for this place and night; enables the fire-hours / dark-window bars. */
  hours?: HourPoint[];
  /** One reason and one practical line: the homepage answer, with details left to the plan. */
  compact?: boolean;
  /** Compact only: show the drive and permit line (off when the next section shows them). */
  facts?: boolean;
  /** Secondary forecast details, revealed only when asked for. */
  details?: ReactNode;
}) {
  const { locale, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const d = getDestination(row.slug);
  if (!d) return null;
  const drive = estimateDrive(d, city);
  const reasons = nightReasons(row, metrics, compact ? 1 : hours ? 2 : 3);
  const H = headingLevel === 2 ? "h2" : "h3";
  const permitOk = d.permit.status === "permit_required" || d.permit.status === "verified_permitted";
  const PermitIcon = permitOk ? ShieldCheck : ShieldAlert;

  return (
    <article className="rec-card on-night" data-mode={experience} aria-labelledby={`rec-${row.slug}-${row.date}`}>
      <p className="rec-kicker small">
        <Star aria-hidden size={16} fill="currentColor" />
        {kicker}
        <span className="text-star">{formatNight(row.date, locale)}</span>
      </p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <H id={`rec-${row.slug}-${row.date}`} className="rec-place">{d.name[locale]}</H>
          <p className="small muted mt-1">{d.governorate[locale]}{locale === "ar" ? "، " : ", "}{d.region[locale]}</p>
        </div>
        {/* A plain-language label leads; the number lives in the score breakdown. */}
        <span className="rec-rating" style={{ ["--rating" as string]: RATING_COLOR[rating(row.score)] }}>{dict.rating[rating(row.score)]}</span>
      </div>

      {hours && <NightWindow className="mt-5" date={row.date} lat={d.lat} lon={d.lon} hours={hours} mode={experience} />}

      {compact ? (
        <>
          {reasons.length > 0 && <ReasonList className="mt-5" reasons={reasons} />}
          {facts && <p className="small muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5" title={dict.common.estimateNote}>
              <Car aria-hidden size={16} />
              <bdi className="num">{approxHours(drive.hours, locale)}</bdi>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PermitIcon aria-hidden size={16} />
              {dict.permit.short[d.permit.status]}
            </span>
          </p>}
        </>
      ) : (<>
      <p className="mt-4 flex items-start gap-2">
        <Car aria-hidden size={18} className="mt-1 shrink-0" />
        <span>
          {dict.common.driveEstimate}: <span className="num font-medium">{approxHours(drive.hours, locale)}</span>
          <span className="small muted block">{dict.common.estimateNote}</span>
        </span>
      </p>

      {reasons.length > 0 && (
        <div className="rec-divider mt-5 pt-5">
          <p className="small muted mb-3">{dict.reasons.title}</p>
          <ReasonList reasons={reasons} />
        </div>
      )}
      {row.dealbreakers.length > 0 && (
        <p className="small mt-3" style={{ color: "#f2b8a4" }}>{dict.plan.dealbreakerNote}</p>
      )}

      <p className="rec-divider small mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 pt-4">
        <PermitIcon aria-hidden size={17} className="shrink-0" />
        <span className="font-medium">{dict.permit.short[d.permit.status]}</span>
        {d.permit.applyUrl && (
          <a className="rec-link inline-flex min-h-11 items-center gap-1 ms-1" href={d.permit.applyUrl} target="_blank" rel="noopener">
            {dict.permit.apply}
            <ExternalLink aria-hidden size={13} />
          </a>
        )}
      </p>
      </>)}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {actions ?? (
          <Link href={`/destinations/${d.slug}?night=${row.date}&exp=${experience}&city=${city}`} className="btn btn-accent">
            {dict.common.viewDestination}
          </Link>
        )}
        {details && (
          <button type="button" className="btn-ghost-night" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
            {dict.home.nightDetails}
            <ChevronDown aria-hidden size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {details && (
        <div id={detailsId} hidden={!open} className="rec-divider mt-5 grid gap-5 pt-5">
          {details}
        </div>
      )}
    </article>
  );
}
