"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForecastResponse } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { formatDayMonth, formatNight, formatWeekday } from "@/lib/i18n";
import { loadPrefs } from "@/lib/prefs-storage";
import { loadForecast, rememberForecast } from "@/lib/forecast-storage";
import { rating, scoreNight } from "@/lib/score";
import type { Experience, PlanPrefs } from "@/lib/types";
import { ChecklistPanel } from "./checklist-panel";
import { ExplainPanel } from "./explain-panel";
import { useI18n } from "./locale-provider";
import { NightChart } from "./night-chart";
import { CoverageNotice, ErrorState, FactorBars, MoonGlyph, RATING_COLOR, ScoreFigure, Skeleton } from "./ui";

export function DestinationForecast({
  slug,
  initialNight,
  initialExperience,
}: {
  slug: string;
  initialNight?: string;
  initialExperience?: Experience;
}) {
  const { locale, dict } = useI18n();
  const [state, setState] = useState<
    { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: ForecastResponse }
  >({ s: "loading" });
  const [prefs, setPrefs] = useState<PlanPrefs | null>(null);
  const [night, setNight] = useState<string | null>(initialNight ?? null);
  const [aiPacking, setAiPacking] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<ClientErrorCode | null>(null);
  const nightStrip = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    const res = await callApi<ForecastResponse>(`/api/forecast?slug=${encodeURIComponent(slug)}`);
    if (res.ok) {
      const saved = loadForecast(slug);
      rememberForecast(res.data, saved?.prefs ?? loadPrefs());
      setState({ s: "ok", data: res.data });
    } else {
      setRefreshError(res.code);
      setState(previous => previous.s === "ok" ? previous : { s: "error", code: res.code });
    }
    setRefreshing(false);
  }, [slug]);

  useEffect(() => {
    const saved = loadForecast(slug);
    const p = initialNight && saved ? saved.prefs : loadPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(initialExperience ? { ...p, experience: initialExperience } : p);
    if (saved) setState({ s: "ok", data: saved.data });
    void load();
  }, [load, initialExperience, initialNight, slug]);

  const scores = useMemo(() => {
    if (state.s !== "ok" || !prefs) return [];
    return state.data.metrics.map((m) => ({
      kashta: scoreNight(slug, m, { ...prefs, experience: "kashta" }),
      stars: scoreNight(slug, m, { ...prefs, experience: "stars" }),
    }));
  }, [state, prefs, slug]);

  useEffect(() => {
    const strip = nightStrip.current;
    const selected = strip?.querySelector<HTMLInputElement>("input:checked")?.parentElement;
    if (!strip || !selected || strip.scrollWidth <= strip.clientWidth) return;
    const offset = selected.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - selected.clientWidth) / 2;
    strip.scrollBy({ left: offset, behavior: "instant" });
  }, [state, night, prefs?.experience]);

  if (state.s === "loading" || !prefs) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">{dict.common.loading}</span>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (state.s === "error") return <ErrorState code={state.code} onRetry={refreshing ? undefined : load} />;

  const { data } = state;
  const valid = night && data.nights.includes(night) ? night : null;
  const bestIdx = scores.reduce(
    (best, s, i) => ((s[prefs.experience].score ?? -1) > (scores[best]?.[prefs.experience].score ?? -1) ? i : best),
    0,
  );
  const idx = valid ? data.nights.indexOf(valid) : bestIdx;
  const sel = scores[idx];
  const m = data.metrics[idx];
  const main = sel[prefs.experience];
  const stars = sel.stars;
  const nightLabel = formatNight(m.date, locale);

  return (
    <div>
      <div className="small mb-5 flex flex-wrap items-center justify-between gap-3 text-ink-2" aria-live="polite">
        <p>{dict.common.updated} <time dateTime={data.fetchedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(data.fetchedAt))}</time></p>
        <button type="button" className="btn-quiet" onClick={load} disabled={refreshing}>{refreshing ? dict.detail.refreshing : dict.detail.refresh}</button>
      </div>
      {refreshError && <div role="status" className="mb-5 border-s-2 border-olive bg-sand-2 p-4"><p>{dict.detail.refreshFailed}</p><p className="small mt-1 text-ink-2">{dict.errors[refreshError]}</p></div>}
      <CoverageNotice nights={data.nights.filter((_, index) => scores[index][prefs.experience].assessment === "incomplete")} />
      {initialNight && !valid && <p className="small mb-4 text-ink-2">{dict.detail.nightExpired}</p>}
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={dict.detail.useExperience}>
        <span className="small me-2 text-ink-2">{dict.detail.useExperience}</span>
        {(["kashta", "stars"] as const).map((x) => (
          <label key={x} className="choice">
            <input type="radio" name="exp" checked={prefs.experience === x} onChange={() => {
              setPrefs({ ...prefs, experience: x });
              setAiPacking([]);
            }} />
            {dict.experience[x]}
          </label>
        ))}
      </div>

      {/* Seven nights as a strip of tiles; each is a real radio button. */}
      <fieldset className="mt-6 min-w-0">
        <legend className="sr-only">{dict.detail.forecast}</legend>
        <div ref={nightStrip} className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-2 md:grid md:grid-cols-7 md:overflow-visible">
          {data.nights.map((n, i) => {
            const s = scores[i][prefs.experience];
            const r = rating(s.score);
            const mm = data.metrics[i];
            const on = i === idx;
            return (
              <label
                key={n}
                className={`night-choice relative flex min-w-[7.5rem] snap-start flex-col gap-1 p-3 transition-colors md:min-w-0 ${
                  on ? "bg-olive text-sand" : "bg-sand-2 hover:bg-sand-3"
                }`}
              >
                <input
                  type="radio"
                  name="night"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  checked={on}
                  onChange={() => {
                    setNight(n);
                    setAiPacking([]);
                  }}
                />
                <span className="font-medium">{i === 0 ? dict.common.tonight : formatWeekday(n, locale)}</span>
                <span className="small num opacity-80">{formatDayMonth(n, locale)}</span>
                <span className="num mt-2 lead font-light leading-none">{s.score ?? "—"}</span>
                <span className="small font-medium" style={on ? undefined : { color: RATING_COLOR[r] }}>
                  {dict.rating[r]}
                </span>
                {s.dealbreakers.length > 0 ? (
                  <span className="small mt-1 font-medium" style={on ? undefined : { color: "var(--color-poor)" }}>
                    {dict.plan.dealbreaker}: {s.dealbreakers.map((f) => dict.factor[f]).join("، ")}
                  </span>
                ) : (
                  <span className="small num mt-1 opacity-80" dir="ltr">
                    {mm.minTemp ?? "—"}° · {mm.maxGust ?? "—"} km/h
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <section aria-labelledby="score-heading" className="min-w-0">
          <h2 id="score-heading" className="sub">
            {prefs.experience === "stars" ? dict.detail.starsScore : dict.detail.kashtaScore}
          </h2>
          <p className="text-ink-2">{nightLabel}</p>
          <div className="mt-6">
            <ScoreFigure score={main.score} size="lg" />
          </div>
          {main.assessment === "incomplete" && (
            <p className="mt-4 bg-sand-2 p-3">
              {dict.plan.incompleteNote} {main.missing.map((f) => dict.factor[f]).join("، ")}
            </p>
          )}
          {main.dealbreakers.length > 0 && <p className="small mt-4 text-poor">{dict.plan.dealbreakerNote}</p>}
          <div className="mt-8">
            <FactorBars factors={main.factors} dealbreakers={main.dealbreakers} />
          </div>
        </section>

        <section aria-labelledby="hourly-heading" className="min-w-0">
          <h2 id="hourly-heading" className="sub">
            {dict.detail.hourly}
          </h2>
          <p className="small mb-4 text-ink-2">
            {dict.common.forecastBy} · {dict.common.updated}{" "}
            <time className="num" dateTime={data.fetchedAt}>
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Riyadh",
              }).format(new Date(data.fetchedAt))}
            </time>
          </p>
          <NightChart hours={m.hours} />

          <div className="on-dark mt-10 bg-night p-6 text-star">
            <div className="flex items-center justify-between gap-4">
              <h3 className="lead font-light">{dict.detail.starsScore}</h3>
              <ScoreFigure score={stars.score} size="sm" dark />
            </div>
            <div className="mt-5 flex items-center gap-4">
              <MoonGlyph illumination={m.moonIllumination} waxing={m.moonWaxing} size={48} />
              <div>
                <p>{dict.detail.moonLit(Math.round(m.moonIllumination * 100))}</p>
                <p className="small text-star-2">{dict.detail.darkHours(m.moonFreeDarkHours, m.darkHours)}</p>
              </div>
            </div>
            <dl className="small num mt-5 grid grid-cols-3 gap-3">
              <div>
                <dt className="text-star-2">{dict.detail.sunset}</dt>
                <dd dir="ltr" className="text-start">{m.sunset ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-star-2">{dict.detail.dusk}</dt>
                <dd dir="ltr" className="text-start">{m.duskAstro ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-star-2">{dict.detail.dawn}</dt>
                <dd dir="ltr" className="text-start">{m.dawnAstro ?? "—"}</dd>
              </div>
            </dl>
            <p className="small mt-4 text-star-2">{dict.stars.noLight}</p>
          </div>
        </section>
      </div>

      <section aria-labelledby="ai-heading" className="mt-16">
        <h2 id="ai-heading" className="sr-only">
          {dict.plan.explainTitle}
        </h2>
        <ExplainPanel key={`${slug}|${m.date}|${prefs.experience}|${locale}`} slug={slug} date={m.date} prefs={{ ...prefs, date: m.date }} onPacking={setAiPacking} />
      </section>

      <section aria-labelledby="checklist-heading" className="mt-20">
        <h2 id="checklist-heading" className="head">
          {dict.detail.checklist}
        </h2>
        <div className="mt-6">
          <ChecklistPanel
            slug={slug}
            date={m.date}
            nightLabel={nightLabel}
            experience={prefs.experience}
            groupSize={prefs.groupSize}
            metrics={m}
            aiItems={aiPacking}
          />
        </div>
      </section>
    </div>
  );
}
