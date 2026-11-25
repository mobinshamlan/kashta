"use client";

import { ChevronLeft, ChevronRight, LoaderCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanResponse } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { getDestination } from "@/lib/destinations";
import { rating } from "@/lib/score";
import Link from "next/link";
import { formatNight } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/prefs-storage";
import { bestPerNight, rankNight } from "@/lib/reasons";
import type { CityId, Experience } from "@/lib/types";
import { DEFAULT_TUNE, tuneFromParams, tuneKey, type Tune } from "@/lib/tune";
import { HomePlaces } from "./home-places";
import { HomePlan, PlanSuggestion } from "./home-plan";
import { SaduBand } from "./sadu-band";
import { useI18n } from "./locale-provider";
import { CityPicker } from "./city-picker";
import { ModeSwitch } from "./mode-switch";
import { NightScene } from "./night-scene";
import { PlanRail, type RailStep } from "./plan-rail";
import { RecommendationCard } from "./recommendation-card";
import { SevenNights, WeekLegend } from "./seven-nights";
import { TripChat } from "./trip-chat";
import { ErrorState, Skeleton } from "./ui";

type Load = { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse };
type Step = 1 | 2 | 3 | 4;
const SECTION: Record<Step, string> = { 1: "night", 2: "week", 3: "places", 4: "plan" };
/**
 * The whole MVP on one night: pick the activity and night (hero + week), the place (map + list),
 * then the plan. The rail is both progress and section navigation. `reached` is the step the
 * visitor is on: earlier steps are decided; changing one sends the later ones back to "to do".
 * One night and one place drive everything below them, so nothing can disagree.
 */
export function HomeExperience({ initialMode }: { initialMode?: Experience }) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const [mode, setMode] = useState<Experience>(initialMode ?? "kashta");
  const [loads, setLoads] = useState<Record<string, Load>>({});
  const [tune, setTune] = useState<Tune>(DEFAULT_TUNE);
  const [picked, setPicked] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  // Activity and night are decided in the hero (defaults: the current mode and the best night), so
  // the trail starts at the place; 4 means the plan has been used.
  const [reached, setReached] = useState<Step>(3);
  const [groupSize, setGroupSize] = useState(DEFAULT_PREFS.groupSize);
  const started = useRef(new Set<string>());
  const restoring = useRef(false);
  const jumpTo = useRef<string | null>(null);
  const asked = useRef<{ night: string | null; place: string | null } | null>(null);
  const [linkNote, setLinkNote] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // Scored by the app's own planner with these preferences; the assistant can only change inputs.
  const load = useCallback(async (experience: Experience, tuned: Tune, force = false) => {
    const key = tuneKey(experience, tuned);
    if (started.current.has(key) && !force) return;
    started.current.add(key);
    setLoads((l) => ({ ...l, [key]: { s: "loading" } }));
    const res = await callApi<PlanResponse>("/api/plan", {
      method: "POST",
      body: JSON.stringify({ ...DEFAULT_PREFS, ...tuned, experience, date: "flexible" }),
    });
    setLoads((l) => ({ ...l, [key]: res.ok ? { s: "ok", data: res.data } : { s: "error", code: res.code } }));
  }, []);

  /** Read the plan from the address: first load, reload, Back from a place page, or history. */
  const readUrl = useCallback((fallbackGroup: number, fallbackCity: CityId) => {
    const sp = new URLSearchParams(window.location.search);
    const n = sp.get("night");
    const pl = sp.get("place");
    const st = Number(sp.get("step"));
    const g = Number(sp.get("group"));
    setPicked(n && /^\d{4}-\d{2}-\d{2}$/.test(n) ? n : null);
    // Remember what a link asked for, to say so if the forecast can no longer honour it.
    asked.current = st === 4 && (n || pl) ? { night: n, place: pl } : null;
    setPlace(pl && /^[a-z0-9-]+$/.test(pl) ? pl : null);
    setReached(st === 4 ? 4 : 3);
    // The address omits the default size, so "no group" means the fallback, not "keep the current".
    setGroupSize(Number.isInteger(g) && g >= 1 && g <= 40 ? g : fallbackGroup);
    // Without ?city= the visitor's own saved start city applies, not Riyadh.
    const tuned = { ...tuneFromParams(sp), ...(sp.get("city") ? {} : { city: fallbackCity }) };
    setTune(tuned);
    return { restore: st === 4, tuned };
  }, []);

  useEffect(() => {
    // A ?mode= link wins for this visit; it isn't saved, so a shared link never replaces the
    // visitor's own preferences. Only their own choices are saved.
    const saved = loadPrefs();
    const start = initialMode ?? saved.experience;
    /* eslint-disable react-hooks/set-state-in-effect */
    setMode(start);
    const first = readUrl(saved.groupSize, saved.city);
    restoring.current = first.restore;
    // A link to a section (e.g. /destinations → /#places): go there once the forecast is in.
    const hash = window.location.hash.slice(1);
    jumpTo.current = hash === "places" || hash === "plan" || hash === "week" ? hash : null;
    /* eslint-enable react-hooks/set-state-in-effect */
    void load(start, first.tuned);
    const onPop = () => {
      const m = new URLSearchParams(window.location.search).get("mode");
      const back = readUrl(loadPrefs().groupSize, loadPrefs().city);
      const nextMode = m === "kashta" || m === "stars" ? m : null;
      if (nextMode) setMode(nextMode);
      void load(nextMode ?? start, back.tuned);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [initialMode, load, readUrl]);

  const state = loads[tuneKey(mode, tune)] ?? { s: "loading" };
  const data = state.s === "ok" ? state.data : null;
  const nights = data ? bestPerNight(data, tune.city) : [];
  const bestNight = nights.reduce<string | null>((top, n) => {
    if (!n.best) return top;
    const current = nights.find((x) => x.night === top)?.best?.score ?? -1;
    return (n.best.score ?? -1) > current ? n.night : top;
  }, null);
  // No "Best" tag on the week when even the top night is unsuitable.
  const bestTag = bestNight && rating(nights.find((n) => n.night === bestNight)?.best?.score ?? null) !== "poor" ? bestNight : null;
  // Only a night the forecast scores counts (an old address or the helper may name another).
  const night = picked && nights.some((n) => n.night === picked && n.best) ? picked : bestNight;
  const ranked = data && night ? rankNight(data, night, tune.city) : [];
  // One place for the hero, map, list and plan: the visitor's pick if it's ranked tonight, else the night's pick.
  const chosen = ranked.find((r) => r.slug === place) ?? ranked[0];
  const chosenDest = chosen ? getDestination(chosen.slug) : undefined;
  const step: Step = data && chosen ? reached : 3;
  const prefs = { ...DEFAULT_PREFS, ...tune, experience: mode, groupSize, date: "flexible" as const };
  // Settings a place page needs to score like this page, and to link back to the same plan.
  const carry = new URLSearchParams(Object.entries({
    city: tune.city !== DEFAULT_TUNE.city ? tune.city : "",
    group: groupSize !== DEFAULT_PREFS.groupSize ? String(groupSize) : "",
    drive: tune.maxDriveHours !== DEFAULT_TUNE.maxDriveHours ? String(tune.maxDriveHours) : "",
    temp: tune.tempPref !== DEFAULT_TUNE.tempPref ? tune.tempPref : "",
    wind: tune.windTolerance !== DEFAULT_TUNE.windTolerance ? tune.windTolerance : "",
    pri: tune.priorities.join(","),
    step: reached === 4 ? "4" : "",
  }).filter(([, v]) => v)).toString();
  const [explainSignal, setExplainSignal] = useState(0);
  const [openSignal, setOpenSignal] = useState(0);
  // "Ask the assistant" from the hero: wide screens bring the trail (and its chat column) into view.
  const askAssistant = () => {
    if (window.matchMedia("(min-width: 1200px)").matches) scrollTo(3);
    setOpenSignal((n) => n + 1);
  };

  // Keep the address in step with the plan. Decisions that move forward add a history entry, so
  // Back steps back through the plan; everything else replaces the current entry.
  const push = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    if (!data) {
      // While the new forecast loads, the address already shows the chosen activity and city;
      // nothing is removed, so a shared plan arriving on first load stays intact.
      url.searchParams.set("mode", mode);
      if (tune.city !== DEFAULT_TUNE.city) url.searchParams.set("city", tune.city);
      if (url.href === window.location.href) return;
      // A decision (new activity or city) gets its own history entry now, so Back still works.
      if (push.current) { push.current = false; window.history.pushState(null, "", url); }
      else window.history.replaceState(window.history.state, "", url);
      return;
    }
    set("mode", mode);
    // A used plan pins its night and place, so a bookmark or reload can't drift with the forecast.
    const used = reached === 4 && !!chosen;
    set("night", used || (picked && night === picked) ? night : null);
    set("place", used ? chosen!.slug : place && chosen?.slug === place ? place : null);
    set("step", reached === 4 ? "4" : null);
    // A used plan spells out city and group, so a reload or a shared link keeps the same trip.
    set("city", used || tune.city !== DEFAULT_TUNE.city ? tune.city : null);
    set("group", used || groupSize !== DEFAULT_PREFS.groupSize ? String(groupSize) : null);
    set("drive", tune.maxDriveHours !== DEFAULT_TUNE.maxDriveHours ? String(tune.maxDriveHours) : null);
    set("temp", tune.tempPref !== DEFAULT_TUNE.tempPref ? tune.tempPref : null);
    set("wind", tune.windTolerance !== DEFAULT_TUNE.windTolerance ? tune.windTolerance : null);
    set("pri", tune.priorities.length ? tune.priorities.join(",") : null);
    url.hash = "";
    const add = push.current;
    push.current = false;
    if (url.href === window.location.href) return;
    if (add) window.history.pushState(null, "", url);
    else window.history.replaceState(window.history.state, "", url);
  }, [data, mode, picked, night, place, chosen, reached, groupSize, tune]);

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollTo = (s: Step) =>
    requestAnimationFrame(() => {
      const el = document.getElementById(SECTION[s]);
      el?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
      el?.querySelector<HTMLElement>("[data-step-focus]")?.focus({ preventScroll: true });
    });

  // A linked plan whose night has passed or isn't scored (or whose place isn't ranked that night):
  // show the current pick, and say so instead of swapping silently.
  useEffect(() => {
    if (!data || !asked.current) return;
    const a = asked.current;
    asked.current = null;
    setLinkNote(Boolean((a.night && a.night !== night) || (a.place && chosen?.slug !== a.place)));
  }, [data, night, chosen]);

  // Restored mid-plan: once the forecast is in, return to the step the visitor was on.
  useEffect(() => {
    if (data && jumpTo.current) {
      const id = jumpTo.current;
      jumpTo.current = null;
      if (!restoring.current) {
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
        return;
      }
    }
    if (!data || !restoring.current) return;
    restoring.current = false;
    requestAnimationFrame(() => document.getElementById(SECTION[reached])?.scrollIntoView({ block: "start" }));
  }, [data, reached]);

  /* Decisions. Each one invalidates only what depends on it. */
  const chooseMode = (next: Experience) => {
    push.current = true;
    setMode(next);
    setPicked(null);
    setPlace(null);
    setReached(3);
    savePrefs({ ...loadPrefs(), experience: next });
    void load(next, tune);
  };
  /** A new night re-ranks the places; `keepPlace` (from a place's "best night") keeps that place. */
  const chooseNight = (n: string, keepPlace = false) => {
    if (n === night) return;
    push.current = true;
    setPicked(n);
    if (!keepPlace) setPlace(null);
    setReached(3);
  };
  const choosePlace = (slug: string) => {
    setPlace(slug);
    if (reached > 3) setReached(3);
  };
  const advance = (to: Step) => {
    // Only a real step forward earns a history entry.
    if (to > reached) push.current = true;
    setReached((r) => (to > r ? to : r));
    scrollTo(to);
  };
  /** A new start city changes every drive time, so the places are re-ranked from the recommended night. */
  const chooseCity = (next: CityId) => {
    if (next === tune.city) return;
    push.current = true;
    const t = { ...tune, city: next };
    setTune(t);
    setPicked(null);
    setPlace(null);
    setReached(3);
    savePrefs({ ...loadPrefs(), city: next });
    void load(mode, t);
  };
  const changeGroup = (n: number) => {
    setGroupSize(n);
    savePrefs({ ...loadPrefs(), groupSize: n });
  };
  /** The assistant's changes, applied through the same inputs a visitor can set; the app's planner
   *  then re-ranks. Changing the activity, night or preferences clears the place, as it would by hand. */
  const applyChanges = (c: { experience?: Experience; night?: string | null; groupSize?: number; tune?: Partial<Tune> }) => {
    push.current = true;
    const m = c.experience ?? mode;
    const t: Tune = { ...tune, ...c.tune };
    const retune = tuneKey(m, t) !== tuneKey(mode, tune);
    if (m !== mode) {
      setMode(m);
      savePrefs({ ...loadPrefs(), experience: m });
    }
    if (retune) setTune(t);
    if (t.city !== tune.city) savePrefs({ ...loadPrefs(), city: t.city });
    // "night" present (even null = any night) replaces the night; otherwise keep it unless the mode changed.
    const nightGiven = "night" in c;
    if (nightGiven || retune) setPicked(nightGiven ? (c.night ?? null) : m === mode ? picked : null);
    if (nightGiven || retune) setPlace(null);
    if (c.groupSize) changeGroup(c.groupSize);
    if (nightGiven || retune) setReached(3);
    void load(m, t);
  };
  /** "Start over": the night, place, group size and tuned preferences go back to the defaults (the
   *  recommended night and its pick, 5 people), at the place step. The activity stays as the page's
   *  mode; checklist ticks, the chat and the fetched forecasts are kept. */
  const startOver = () => {
    push.current = true;
    setPicked(null);
    setPlace(null);
    // The start city is where the visitor lives, not a trip setting, so it stays.
    const reset = { ...DEFAULT_TUNE, city: tune.city };
    setTune(reset);
    void load(mode, reset);
    changeGroup(DEFAULT_PREFS.groupSize);
    setReached(3);
    scrollTo(1);
  };

  // Wind over the dunes: the near sand drifts a little as the page scrolls; no layout reads
  // beyond scrollY, and nothing moves when the visitor prefers reduced motion.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || reduce()) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const wind = Math.min(1, Math.max(0, window.scrollY / Math.max(1, el.offsetHeight)));
        document.documentElement.style.setProperty("--wind", wind.toFixed(3));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); };
  }, []);

  const Forward = locale === "ar" ? ChevronLeft : ChevronRight;
  const railSteps: RailStep[] = [
    { n: 1, label: dict.plan.steps.activity, value: dict.experience[mode], reachable: true },
    { n: 2, label: dict.plan.steps.night, value: night ? formatNight(night, locale, { short: true }) : undefined, reachable: !!data },
    { n: 3, label: dict.plan.steps.place, value: chosenDest?.name[locale], reachable: !!chosen },
    { n: 4, label: dict.plan.steps.plan, reachable: !!chosen },
  ];
  const updatedAt = data?.forecastFetchedAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  }).format(new Date(data.forecastFetchedAt)) : null;

  return (
    <div className="home-journey" data-mode={mode} data-step={step}>
      {/* 1–2 · The night: the scene, the activity, the answer, and the week laid along its ground. */}
      <section ref={heroRef} id="night" className="night-hero home-v5 on-night on-dark" aria-labelledby="hero-title">
        <div className="home-v5-stage">
        <NightScene mode={mode} />
        <div className="frame home-v5-grid">
          <div className="home-v4-main min-w-0">
            <h1 id="hero-title" className="home-v3-title" tabIndex={-1} data-step-focus>{t.heroByMode[mode].h1}</h1>
            <div className="hero-controls mt-5">
              <ModeSwitch value={mode} onChange={chooseMode} legend={t.modeLegend} />
              <CityPicker value={tune.city} onChange={chooseCity} experience={mode} maxDriveHours={tune.maxDriveHours} />
            </div>
            <div className="home-v4-answer" aria-live="polite" aria-busy={state.s === "loading"}>
              {state.s === "loading" && (
                <div className="rec-card on-night" data-mode={mode}>
                  <p className="small muted flex items-center gap-2"><LoaderCircle aria-hidden size={16} className="animate-spin" />{dict.common.loading}</p>
                  <Skeleton className="mt-5 h-9 w-3/4" />
                  <Skeleton className="mt-4 h-5 w-1/2" />
                </div>
              )}
              {state.s === "error" && <ErrorState code={state.code} onRetry={() => load(mode, tune, true)} className="!bg-sky-2 rounded-xl" />}
              {data && chosen && night && (
                <RecommendationCard
                  key={`${mode}-${chosen.slug}-${chosen.date}`}
                  city={tune.city}
                  compact
                  facts={false}
                  row={chosen}
                  metrics={data.metrics[`${chosen.slug}|${chosen.date}`]}
                  experience={mode}
                  kicker={night === bestNight && chosen.slug === ranked[0]?.slug ? (rating(chosen.score) === "poor" ? t.noGood : t.best) : t.nightPick}
                  actions={
                    <button type="button" className="btn btn-accent" onClick={() => advance(3)}>
                      {t.toPlaces}
                      <Forward aria-hidden size={18} />
                    </button>
                  }
                />
              )}
              {data && !chosen && (
                <div className="rec-card on-night" data-mode={mode} role="status">
                  <p className="lead">{t.noneTitle}</p>
                  <p className="muted mt-2">{t.noneBody}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button type="button" className="btn btn-accent" onClick={() => load(mode, tune, true)}>{dict.common.retry}</button>
                    <Link href={`/plan?exp=${mode}`} className="rec-link small inline-flex min-h-11 items-center">{t.openPlanner}</Link>
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="hero-ask" onClick={askAssistant}>
              <Sparkles aria-hidden size={16} />{t.chat.ask}
            </button>
            {/* Phones: a window onto the camp or the sky under the answer. */}
            <div className="home-v4-window" aria-hidden />
          </div>
        </div>

        </div>

        {/* The week sits on the dunes of the same scene: picking a night re-ranks everything below. */}
        <div id="week" className="home-v5-week" aria-labelledby="week-title">
          <div className="frame home-v5-week-grid">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="week-title" className="home-h2 home-h2--sm" tabIndex={-1} data-step-focus>{t.weekShort}</h2>
                {updatedAt && data?.forecastFetchedAt && (
                  <p className="small text-star-2">{dict.common.updated} <time className="num" dateTime={data.forecastFetchedAt}>{updatedAt}</time></p>
                )}
              </div>
              {data && <p className="small mt-3 text-star-2">{t.weekRated(nights.filter((n) => n.best).length, nights.length)}</p>}
              <div className="mt-3">
                {data ? (
                  <SevenNights compact nights={nights} metricsFor={(n) => { const r = nights.find((x) => x.night === n)?.best; return r ? data.metrics[`${r.slug}|${n}`] : undefined; }} selected={night} bestNight={bestTag} onSelect={chooseNight} />
                ) : state.s === "loading" && (
                  <div className="seven seven--compact" aria-hidden>{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
                )}
              </div>
              {/* A night picked here re-ranks the card above, which may be off screen on phones: name its pick here too. */}
              {data && picked && night === picked && chosen && chosenDest && (
                <p className="week-pick small mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
                  <span className="text-star-2">{formatNight(night, locale)}:</span>
                  <strong className="font-semibold">{chosenDest.name[locale]}</strong>
                  <button type="button" className="rec-link inline-flex min-h-11 items-center gap-1" onClick={() => advance(3)}>{t.toPlaces}<Forward aria-hidden size={16} /></button>
                </p>
              )}
              {data && <WeekLegend className="muted mt-3" nights={nights} mode={mode} />}
            </div>
          </div>
        </div>
      </section>

      {/* 3–4 · The outing: a woven edge, then the trail from place to plan. The rail stays in view
          only while this part of the page is on screen. */}
      <div className="home-trail">
        <SaduBand className="home-trail-sadu" />
        <div className="home-trail-grid">
        <div className="home-trail-main min-w-0">
        <PlanRail variant="night" steps={railSteps} step={step} onStep={(n) => scrollTo(n)} label={t.journey} navigate />

        <section id="places" className="home-v4-places on-night on-dark" aria-labelledby="places-title">
          <div className="frame pb-12 pt-8">
            {data && night && chosen ? (
              <HomePlaces carry={carry} city={tune.city} mode={mode} data={data} night={night} ranked={ranked} selected={chosen.slug} onSelect={choosePlace} onPlan={() => advance(4)} />
            ) : (
              <h2 id="places-title" className="home-h2" tabIndex={-1} data-step-focus>{t.placesHeading}</h2>
            )}
          </div>
        </section>

        {/* 4 · The plan, at first light. Until a place is used, it shows the suggestion, clearly labelled. */}
        <section id="plan" className="home-v4-plan on-night on-dark" aria-labelledby="plan-title">
          <div className="frame pb-[clamp(2.5rem,5vw,4rem)]">
            <h2 id="plan-title" className="home-h2" tabIndex={-1} data-step-focus>{t.summaryTitle}</h2>
            {linkNote && <p role="status" className="plan-note small mt-3">{t.linkChanged}</p>}
            <div className="mt-5">
              {data && chosen && step === 4 ? (
                <HomePlan carry={carry} city={tune.city} key={`${chosen.slug}-${chosen.date}`} mode={mode} row={chosen} data={data} groupSize={groupSize} onGroupSize={changeGroup} onStartOver={startOver} onChangePlace={() => { push.current = true; setReached(3); scrollTo(3); }} onExplain={() => setExplainSignal((n) => n + 1)} />
              ) : data && chosen ? (
                <PlanSuggestion mode={mode} row={chosen} picked={!!place && place === chosen.slug && chosen.slug !== ranked[0]?.slug} onUse={() => advance(4)} onChange={() => scrollTo(3)} />
              ) : (
                <div className="plan-pending" role="status" aria-busy={state.s === "loading"}>
                  {state.s === "loading" ? (
                    <p className="small flex items-center gap-2"><LoaderCircle aria-hidden size={16} className="animate-spin" />{dict.common.loading}</p>
                  ) : <p>{state.s === "error" || data ? t.planUnavailable : t.planPending}</p>}
                </div>
              )}
            </div>
          </div>
        </section>
        </div>

        {/* The assistant stays beside every step (docked at the bottom on smaller screens). */}
        <TripChat
          mode={mode}
          prefs={prefs}
          data={data}
          dataKey={tuneKey(mode, tune)}
          perNight={nights}
          chosen={chosen}
          night={night}
          explainSignal={explainSignal}
          openSignal={openSignal}
          onApply={applyChanges}
          onUse={() => advance(4)}
          onPick={(slug, date) => { push.current = true; setPicked(date); setPlace(slug); setReached(3); }}
        />
        </div>
      </div>
    </div>
  );
}
