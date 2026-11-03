"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ForecastResponse, PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { estimateDrive, getDestination } from "@/lib/destinations";
import { formatDayMonth, formatWeekday, approxHours } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs } from "@/lib/prefs-storage";
import { rememberPlanForecasts } from "@/lib/forecast-storage";
import { loadStarForecasts, rankStarForecasts } from "@/lib/star-forecasts";
import type { PlanPrefs } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { ErrorState, FactorBars, MoonGlyph, ScoreFigure, Skeleton } from "./ui";

/** Seven nights ranked for stargazing, each with its best site, moon and dark window. */
export function StarHunter() {
  const { locale, dict } = useI18n();
  const [hours, setHours] = useState(3);
  const [state, setState] = useState<
    { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; forecasts: Record<string, ForecastResponse> }
  >({ s: "loading" });
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<ClientErrorCode | null>(null);
  const requestId = useRef(0);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    setRefreshError(null);
    setState(previous => previous.s === "ok" ? previous : { s: "loading" });
    // All three filters use the same forecast pool; changing radius needs no new weather call.
    const prefs: PlanPrefs = { ...loadPrefs(), experience: "stars", date: "flexible", maxDriveHours: 5, priorities: [] };
    setPrefs(prefs);
    const res = await callApi<PlanResponse>("/api/plan", { method: "POST", body: JSON.stringify(prefs) });
    if (id !== requestId.current) return;
    if (res.ok) {
      rememberPlanForecasts(res.data, prefs);
      setState({ s: "ok", forecasts: res.data.forecasts });
    } else {
      setRefreshError(res.code);
      setState(previous => previous.s === "ok" ? previous : { s: "error", code: res.code });
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const saved = loadStarForecasts();
    // Restore browser storage after hydration, before the refresh completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setState({ s: "ok", forecasts: saved });
    void load();
  }, [load]);

  const data = state.s === "ok" ? rankStarForecasts(state.forecasts, prefs, hours) : null;
  let rows: { night: string; best: ScoreRow | undefined }[] = [];
  if (data) {
    rows = data.nights
      .map((night) => ({ night, best: data.results.find((r) => r.date === night && r.score !== null) }))
      .sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1));
  }
  const incompleteNights = data ? rows.filter(row => !row.best || data.results.some(result => result.date === row.night && result.assessment === "incomplete")).map(row => row.night) : [];

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

      {data && (
        <div className="small mt-5 flex flex-wrap items-center justify-between gap-3 text-star-2" aria-live="polite">
          {data.forecastFetchedAt && <p>{dict.common.updated} <time dateTime={data.forecastFetchedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(data.forecastFetchedAt))}</time></p>}
          <button type="button" className="btn-quiet" disabled={refreshing} onClick={load}>{refreshing ? dict.detail.refreshing : refreshError ? dict.common.retry : dict.detail.refresh}</button>
        </div>
      )}
      {data && refreshError && <div role="status" className="mt-4 border-s-2 border-star-2 bg-night-2 p-4 text-star-2"><p>{dict.detail.refreshFailed}</p><p className="small mt-1">{dict.errors[refreshError]}</p></div>}
      {incompleteNights.length > 0 && <p className="small mt-4 text-star-2">{dict.plan.coverageNotice(incompleteNights.map(night => formatDayMonth(night, locale)).join(locale === "ar" ? "، " : ", "))}</p>}

      {state.s === "loading" && (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">{dict.common.loading}</span>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {state.s === "error" && (
        <ErrorState className="mt-6 !bg-night-2" code={state.code} onRetry={refreshing ? undefined : load} />
      )}
      {data && data.considered.length === 0 && (
        <p className="lead mt-6 bg-night-2 p-6">{dict.plan.noneInRange}</p>
      )}
      {data && data.considered.length > 0 && (
        <ol className="mt-6 flex flex-col gap-1.5">
          {rows.map(({ night, best }, i) => {
            const m = best ? data.metrics[`${best.slug}|${best.date}`] : data.metrics[`${data.considered[0]}|${night}`];
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
                      {night === data.nights[0] ? dict.common.tonight : formatWeekday(night, locale)}{" "}
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
                        {dict.stars.drive}: {approxHours(estimateDrive(d).hours, locale)} ({estimateDrive(d).straightKm} {dict.common.km}{" "}
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
      {data && !data.airQuality.available && <p className="mt-4 text-star-2">{dict.plan.airDown}</p>}
      {data && data.forecastFetchedAt && (
        <p className="small mt-6 text-star-2">{dict.common.forecastBy}</p>
      )}
    </div>
  );
}
