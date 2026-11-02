"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { estimateDrive, getDestination } from "@/lib/destinations";
import { formatDayMonth, formatWeekday } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs } from "@/lib/prefs-storage";
import type { PlanPrefs } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { ErrorState, FactorBars, MoonGlyph, ScoreFigure, Skeleton } from "./ui";

/** Seven nights ranked for stargazing, each with its best site, moon and dark window. */
export function StarHunter() {
  const { locale, dict } = useI18n();
  const [hours, setHours] = useState(3);
  const [state, setState] = useState<
    { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse }
  >({ s: "loading" });
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (maxDriveHours: number) => {
    setState({ s: "loading" });
    const base = typeof window === "undefined" ? DEFAULT_PREFS : loadPrefs();
    const prefs: PlanPrefs = { ...base, experience: "stars", date: "flexible", maxDriveHours, priorities: [] };
    const res = await callApi<PlanResponse>("/api/plan", { method: "POST", body: JSON.stringify(prefs) });
    setState(res.ok ? { s: "ok", data: res.data } : { s: "error", code: res.code });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(hours);
  }, [load, hours]);

  let rows: { night: string; best: ScoreRow | undefined }[] = [];
  if (state.s === "ok") {
    rows = state.data.nights
      .map((night) => ({ night, best: state.data.results.find((r) => r.date === night && r.score !== null) }))
      .sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1));
  }

  return (
    <div>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="small mb-2 w-full text-star-2">{dict.plan.driveLabel}</legend>
        {[2, 3, 5].map((h) => (
          <label key={h} className="choice !bg-night-2 hover:!bg-night-3 has-[input:checked]:!bg-star has-[input:checked]:!text-night">
            <input type="radio" name="sh-hours" checked={hours === h} onChange={() => setHours(h)} />
            {dict.plan.driveValue(h)}
          </label>
        ))}
      </fieldset>

      <h2 className="mt-14 sub">{dict.stars.rank}</h2>

      {state.s === "loading" && (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">{dict.common.loading}</span>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {state.s === "error" && (
        <ErrorState className="mt-6 !bg-night-2" code={state.code} onRetry={() => load(hours)} />
      )}
      {state.s === "ok" && state.data.considered.length === 0 && (
        <p className="lead mt-6 bg-night-2 p-6">{dict.plan.noneInRange}</p>
      )}
      {state.s === "ok" && state.data.considered.length > 0 && (
        <ol className="mt-6 flex flex-col gap-1.5">
          {rows.map(({ night, best }, i) => {
            const m = best ? state.data.metrics[`${best.slug}|${best.date}`] : state.data.metrics[`${state.data.considered[0]}|${night}`];
            const d = best ? getDestination(best.slug) : undefined;
            const isOpen = open === night;
            return (
              <li key={night} data-reveal style={{ ["--i" as string]: i }} className="bg-night-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : night)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-5 p-4 text-start transition-colors hover:bg-night-3 md:grid-cols-[3rem_auto_1.2fr_1fr_auto] md:p-5"
                >
                  <span className="num hidden text-star-2 md:block">{i + 1}</span>
                  {m ? <MoonGlyph illumination={m.moonIllumination} waxing={m.moonWaxing} size={44} /> : <span />}
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {night === state.data.nights[0] ? dict.common.tonight : formatWeekday(night, locale)}{" "}
                      <span className="small num text-star-2">{formatDayMonth(night, locale)}</span>
                    </span>
                    <span className="small block truncate text-star-2">
                      {d ? `${dict.stars.best}: ${d.name[locale]}` : dict.home.weekEmpty}
                    </span>
                  </span>
                  <span className="small hidden text-star-2 md:block">
                    {m && (
                      <>
                        {dict.detail.moonLit(Math.round(m.moonIllumination * 100))} ·{" "}
                        <span className="num">{m.moonFreeDarkHours}</span> {dict.stars.moonless}
                        <span className="num block" dir="ltr" style={{ textAlign: locale === "ar" ? "right" : "left" }}>
                          {m.duskAstro ?? "—"} → {m.dawnAstro ?? "—"}
                        </span>
                      </>
                    )}
                  </span>
                  <ScoreFigure score={best?.score ?? null} size="sm" dark />
                </button>
                {isOpen && best && d && (
                  <div className="grid gap-10 p-5 pt-2 md:grid-cols-2 md:p-8 md:pt-2">
                    <FactorBars factors={best.factors} dealbreakers={best.dealbreakers} dark />
                    <div>
                      <p className="text-star-2">
                        {dict.stars.drive}: ~{estimateDrive(d).hours} {dict.common.hours} ({estimateDrive(d).straightKm} {dict.common.km}{" "}
                        {dict.common.straightLine})
                      </p>
                      <p className="small mt-3 text-star-2">{dict.stars.noLight}</p>
                      <Link
                        href={`/destinations/${d.slug}?night=${night}&exp=stars`}
                        className="btn mt-6"
                      >
                        {dict.common.viewDestination}
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {state.s === "ok" && !state.data.airQuality.available && <p className="mt-4 text-star-2">{dict.plan.airDown}</p>}
      {state.s === "ok" && state.data.forecastFetchedAt && (
        <p className="small mt-6 text-star-2">{dict.common.forecastBy}</p>
      )}
    </div>
  );
}
