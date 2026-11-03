"use client";

import Link from "next/link";
import { Car, ChevronLeft, ChevronRight, LoaderCircle, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanResponse } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { estimateDrive, getDestination } from "@/lib/destinations";
import { approxHours, formatNight } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/prefs-storage";
import { bestPerNight, nightReasons } from "@/lib/reasons";
import { rating } from "@/lib/score";
import type { Experience } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { ModeSwitch } from "./mode-switch";
import { NightScene } from "./night-scene";
import { NightSummary } from "./night-summary";
import { NightWindow } from "./night-window";
import { HomePlanner, type PlanStep } from "./home-planner";
import { ReasonList, RecommendationCard } from "./recommendation-card";
import { SaduBand } from "./sadu-band";
import { SevenNights } from "./seven-nights";
import { ErrorState, RATING_COLOR, Skeleton } from "./ui";

type Load = { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse };

/**
 * The MVP in one scroll: the answer for the chosen activity, the week, why the night suits it,
 * a few verified places, and a short planner that ends in a plan. /plan keeps the full options.
 */
export function HomeExperience({ initialMode }: { initialMode?: Experience }) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const [mode, setMode] = useState<Experience>(initialMode ?? "kashta");
  const [loads, setLoads] = useState<Partial<Record<Experience, Load>>>({});
  const [picked, setPicked] = useState<string | null>(null);
  // The homepage planner shares this page's mode and night; it adds a place and a step.
  const [planPlace, setPlanPlace] = useState<string | null>(null);
  const [planStep, setPlanStep] = useState<PlanStep>(1);
  const started = useRef(new Set<Experience>());

  const load = useCallback(async (experience: Experience, force = false) => {
    if (started.current.has(experience) && !force) return;
    started.current.add(experience);
    setLoads((l) => ({ ...l, [experience]: { s: "loading" } }));
    const res = await callApi<PlanResponse>("/api/plan", {
      method: "POST",
      body: JSON.stringify({ ...DEFAULT_PREFS, experience, date: "flexible" }),
    });
    setLoads((l) => ({ ...l, [experience]: res.ok ? { s: "ok", data: res.data } : { s: "error", code: res.code } }));
  }, []);

  useEffect(() => {
    // A ?mode= link wins; otherwise start in the mode the visitor used last.
    const start = initialMode ?? loadPrefs().experience;
    if (initialMode) savePrefs({ ...loadPrefs(), experience: initialMode });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(start);
    void load(start);
  }, [initialMode, load]);

  const choose = (next: Experience) => {
    setMode(next);
    setPicked(null);
    setPlanPlace(null);
    savePrefs({ ...loadPrefs(), experience: next });
    // Keep the address shareable: /?mode=stars opens the same view.
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState(null, "", url);
    void load(next);
  };

  const state = loads[mode] ?? { s: "loading" };
  const data = state.s === "ok" ? state.data : null;
  const nights = data ? bestPerNight(data) : [];
  const bestNight = nights.reduce<string | null>((top, n) => {
    if (!n.best) return top;
    const current = nights.find((x) => x.night === top)?.best?.score ?? -1;
    return (n.best.score ?? -1) > current ? n.night : top;
  }, null);
  const shownNight = picked ?? bestNight;
  const shown = nights.find((n) => n.night === shownNight)?.best;
  const metricsFor = (night: string) => {
    if (!data) return undefined;
    const row = nights.find((n) => n.night === night)?.best ?? data.results.find((r) => r.date === night);
    return row ? data.metrics[`${row.slug}|${night}`] : undefined;
  };
  const shownDest = shown ? getDestination(shown.slug) : undefined;
  const shownHours = shown ? data?.forecasts[shown.slug]?.metrics.find((m) => m.date === shown.date)?.hours : undefined;
  const nightRows = data && shownNight
    ? data.results.filter((r) => r.date === shownNight && r.score !== null).sort((a, b) => b.score! - a.score!).slice(0, 3)
    : [];
  // Jump into the planner at a step, with the night (and place) already chosen.
  const planFrom = (slug: string | null, step: PlanStep) => {
    if (slug) setPlanPlace(slug);
    setPlanStep(step);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById("plan")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };
  const hero = t.heroByMode[mode];
  const Forward = locale === "ar" ? ChevronLeft : ChevronRight;

  return (
    <div data-mode={mode}>
      {/* 1 · The answer: the scene for the chosen activity and its best night. */}
      <section className="night-hero home-v3 on-night on-dark" aria-labelledby="hero-title">
        <NightScene mode={mode} />
        <div className="frame home-v3-grid">
          <div className="home-v3-main min-w-0">
            <ModeSwitch value={mode} onChange={choose} legend={t.modeLegend} />
            <h1 id="hero-title" className="home-v3-title mt-5">{hero.h1}</h1>
            <p className="hero-sub mt-2">{hero.sub}</p>

            <div className="mt-6" aria-live="polite" aria-busy={state.s === "loading"}>
              {state.s === "loading" && (
                <div className="rec-card on-night" data-mode={mode}>
                  <p className="small muted flex items-center gap-2"><LoaderCircle aria-hidden size={16} className="animate-spin" />{dict.common.loading}</p>
                  <Skeleton className="mt-5 h-9 w-3/4" />
                  <Skeleton className="mt-4 h-5 w-1/2" />
                </div>
              )}
              {state.s === "error" && <ErrorState code={state.code} onRetry={() => load(mode, true)} className="!bg-sky-2 rounded-xl" />}
              {data && shown && (
                <RecommendationCard
                  key={`${mode}-${shown.slug}-${shown.date}`}
                  compact
                  row={shown}
                  metrics={data.metrics[`${shown.slug}|${shown.date}`]}
                  experience={mode}
                  kicker={shownNight === bestNight ? t.best : t.nightPick}
                  actions={
                    <button type="button" className="btn btn-accent" onClick={() => planFrom(shown.slug, 4)}>
                      {t.planNight}
                      <Forward aria-hidden size={18} />
                    </button>
                  }
                />
              )}
              {data && !shown && (
                <div className="rec-card on-night" data-mode={mode} role="status">
                  <p className="lead">{t.noneTitle}</p>
                  <p className="muted mt-2">{t.noneBody}</p>
                </div>
              )}
            </div>
            <p className="small muted mt-4 flex items-center gap-2">
              <MapPin aria-hidden size={15} />
              {t.scopeNote}
            </p>
          </div>
          {/* Phones: a window onto the scene between the answer and the week. */}
          <div className="home-v3-window" aria-hidden />
        </div>
      </section>

      {/* 2 · The week, then 3 · why the chosen night suits the activity. */}
      <section id="nights" className="home-v3-week on-night on-dark" aria-labelledby="week-title">
        <div className="frame grid gap-8 py-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="week-title" className="lead font-medium">{t.weekShort}</h2>
              {shownNight && <p className="small muted">{formatNight(shownNight, locale)}</p>}
            </div>
            <div className="mt-4">
              {data ? (
                <SevenNights compact nights={nights} metricsFor={metricsFor} selected={shownNight} bestNight={bestNight} onSelect={setPicked} />
              ) : (
                <div className="seven seven--compact" aria-hidden>
                  {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
              )}
            </div>
            <ul className="week-legend small muted mt-4">
              <li><span className="week-legend-bar" aria-hidden />{t.weekBars[mode]} {t.weekTap}</li>
              <li><span className="week-legend-na" aria-hidden />{t.weekIncomplete}</li>
            </ul>
          </div>

          {data && shown && (
            <div className="why-panel min-w-0" aria-labelledby="why-title">
              <h2 id="why-title" className="lead font-medium">{t.whyTitle}</h2>
              <ReasonList className="mt-4" reasons={nightReasons(shown, data.metrics[`${shown.slug}|${shown.date}`], 3)} />
              {shownDest && shownHours && <NightWindow className="mt-5" date={shown.date} lat={shownDest.lat} lon={shownDest.lon} hours={shownHours} mode={mode} />}
              <details className="why-more mt-4">
                <summary className="small">{t.nightDetails}</summary>
                <div className="mt-3"><NightSummary metrics={metricsFor(shown.date)} experience={mode} /></div>
              </details>
            </div>
          )}
        </div>
        <p className="frame small muted pb-6 flex flex-wrap gap-x-4 gap-y-1">
          {data?.forecastFetchedAt && (
            <span>
              {dict.common.forecastBy} · {dict.common.updated}{" "}
              <time className="num" dateTime={data.forecastFetchedAt}>
                {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(data.forecastFetchedAt))}
              </time>
            </span>
          )}
          {data && !data.airQuality.available && <span>{dict.plan.airDown}</span>}
          <span>{t.illustration}</span>
        </p>
      </section>

      <SaduBand />

      {/* 4 · A few verified places for the chosen night. */}
      {nightRows.length > 0 && (
        <section className="home-v3-places" aria-labelledby="preview-title">
          <div className="frame py-[clamp(2.25rem,5vw,3.5rem)]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 id="preview-title" className="sub">{t.previewTitle}</h2>
              <Link href={`/destinations?mode=${mode}`} className="link small inline-flex min-h-11 items-center">{t.previewAll}</Link>
            </div>
            <ul className="mt-5 grid gap-3 md:grid-cols-3">
              {nightRows.map((r) => {
                const d = getDestination(r.slug)!;
                const rt = rating(r.score);
                return (
                  <li key={r.slug} className="preview-card">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/destinations/${r.slug}?night=${r.date}&exp=${mode}`} className="font-medium hover:underline">{d.name[locale]}</Link>
                      <span className="rating-pill" style={{ ["--rating" as string]: RATING_COLOR[rt] }}>{dict.rating[rt]}</span>
                    </div>
                    <ReasonList className="small mt-2" reasons={nightReasons(r, data!.metrics[`${r.slug}|${r.date}`], 1)} />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="small inline-flex items-center gap-1.5 text-ink-2" title={dict.common.estimateNote}>
                        <Car aria-hidden size={15} />
                        <bdi className="num">{approxHours(estimateDrive(d).hours, locale)}</bdi>
                      </span>
                      <button type="button" className="btn-quiet !min-h-11" onClick={() => planFrom(r.slug, 4)}>{t.planHere}</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="small mt-4 flex items-center gap-2 text-ink-2"><MapPin aria-hidden size={15} />{t.scopeNote}</p>
          </div>
        </section>
      )}

      {/* 5 · The planner: activity → night → place → plan, all on this page. */}
      <section id="plan" className="home-v3-cta" aria-labelledby="plan-title">
        <div className="frame py-[clamp(2.5rem,5vw,4rem)]">
          <h2 id="plan-title" className="sub">{t.ctaTitle[mode]}</h2>
          <p className="mt-1 max-w-[56ch] text-ink-2">{t.planLeadHome}</p>
          <div className="mt-6">
            <HomePlanner
              mode={mode}
              onMode={choose}
              data={data}
              perNight={nights}
              bestNight={bestNight}
              night={shownNight}
              onNight={(n) => { setPicked(n); setPlanPlace(null); }}
              place={planPlace}
              onPlace={setPlanPlace}
              step={planStep}
              onStep={setPlanStep}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
