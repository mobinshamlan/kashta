"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { getDestination } from "@/lib/destinations";
import { formatDayMonth, formatWeekday } from "@/lib/i18n";
import { DEFAULT_PREFS } from "@/lib/prefs-storage";
import { rating } from "@/lib/score";
import { useI18n } from "./locale-provider";
import { ErrorState, RATING_COLOR, Skeleton } from "./ui";

/** The live thing on the homepage: tonight and the six nights after, with the best site for each. */
export function WeekStrip() {
  const { locale, dict } = useI18n();
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; code: ClientErrorCode } | { status: "ok"; data: PlanResponse }
  >({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const res = await callApi<PlanResponse>("/api/plan", {
      method: "POST",
      body: JSON.stringify({ ...DEFAULT_PREFS, maxDriveHours: 6 }),
    });
    setState(res.ok ? { status: "ok", data: res.data } : { status: "error", code: res.code });
  }, []);

  useEffect(() => {
    // Fetch once on mount; state updates happen after the network call resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">{dict.common.loading}</span>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-14" />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (state.status === "error") return <ErrorState code={state.code} onRetry={load} />;

  const { data } = state;
  const bestByNight = new Map<string, ScoreRow | undefined>();
  for (const n of data.nights) bestByNight.set(n, data.results.find((r) => r.date === n && r.score !== null));

  return (
    <div>
      <ol className="flex flex-col">
        {data.nights.map((night, i) => {
          const best = bestByNight.get(night);
          const dest = best ? getDestination(best.slug) : undefined;
          const r = rating(best?.score ?? null);
          return (
            <li key={night} data-reveal style={{ ["--i" as string]: i }}>
              {best && dest ? (
                <Link
                  href={`/destinations/${dest.slug}?night=${night}`}
                  className="group grid min-h-16 grid-cols-[6.5rem_1fr_auto] items-center gap-4 py-2.5 transition-colors hover:bg-sand-2 sm:grid-cols-[8rem_1fr_auto]"
                >
                  <span>
                    <span className="block font-medium">{i === 0 ? dict.common.tonight : formatWeekday(night, locale)}</span>
                    <span className="small block text-ink-2">{formatDayMonth(night, locale)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{dest.name[locale]}</span>
                    <span className="small block text-ink-2">{dest.governorate[locale]}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-end">
                      <span className="num block lead font-light leading-none">{best.score}</span>
                      <span className="small block font-medium" style={{ color: RATING_COLOR[r] }}>
                        {dict.rating[r]}
                      </span>
                    </span>
                    <Arrow aria-hidden size={18} className="transition-transform rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1" />
                  </span>
                </Link>
              ) : (
                <div className="grid min-h-16 grid-cols-[6.5rem_1fr] items-center gap-4 py-2.5 sm:grid-cols-[8rem_1fr]">
                  <span>
                    <span className="block font-medium">{i === 0 ? dict.common.tonight : formatWeekday(night, locale)}</span>
                    <span className="small block text-ink-2">{formatDayMonth(night, locale)}</span>
                  </span>
                  <span className="small text-ink-2">{dict.home.weekEmpty}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {data.forecastFetchedAt && (
        <p className="small mt-4 text-ink-2">
          {dict.common.forecastBy} · {dict.common.updated}{" "}
          <time dateTime={data.forecastFetchedAt} className="num">
            {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Riyadh",
            }).format(new Date(data.forecastFetchedAt))}
          </time>
          {!data.airQuality.available && <span className="block">{dict.plan.airDown}</span>}
        </p>
      )}
    </div>
  );
}
