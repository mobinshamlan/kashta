"use client";

import Link from "next/link";
import { Car, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { buildChecklist } from "@/lib/checklist";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { estimateDrive, getDestination } from "@/lib/destinations";
import { approxHours, formatNight } from "@/lib/i18n";
import { DEFAULT_PREFS } from "@/lib/prefs-storage";
import { nightReasons } from "@/lib/reasons";
import type { InterpretedPrefs } from "@/lib/schemas";
import { rating } from "@/lib/score";
import { buildPlanShareUrl } from "@/lib/share-link";
import type { Experience } from "@/lib/types";
import { ExplainPanel, useAiStatus } from "./explain-panel";
import { useI18n } from "./locale-provider";
import { NightScene } from "./night-scene";
import { PlanRail, type RailStep } from "./plan-rail";
import { ReasonList } from "./recommendation-card";
import { SevenNights } from "./seven-nights";
import { ErrorState, RATING_COLOR, Skeleton } from "./ui";

export type PlanStep = 1 | 2 | 3 | 4;

/**
 * The homepage's own planner: activity → night → place → a short plan. It shares the page's
 * mode, forecast data and chosen night, so picking a night above carries straight into it.
 */
export function HomePlanner({
  mode,
  onMode,
  data,
  perNight,
  bestNight,
  night,
  onNight,
  place,
  onPlace,
  step,
  onStep,
  summary = false,
  onEdit,
}: {
  mode: Experience;
  onMode: (m: Experience) => void;
  data: PlanResponse | null;
  perNight: { night: string; best: ScoreRow | undefined }[];
  bestNight: string | null;
  night: string | null;
  onNight: (n: string) => void;
  place: string | null;
  onPlace: (slug: string) => void;
  step: PlanStep;
  onStep: (s: PlanStep) => void;
  /** Homepage: the hero already made the choices, so show them as a summary and one action. */
  summary?: boolean;
  onEdit?: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const p = dict.plan;
  const Forward = locale === "ar" ? ChevronLeft : ChevronRight;
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set only when the planner's own controls change the step, so a mode switch in the hero
  // (or by the helper) never pulls focus and scroll down into the planner.
  const navigated = useRef(false);

  const rows: ScoreRow[] = data && night
    ? data.results.filter((r) => r.date === night && r.score !== null).sort((a, b) => b.score! - a.score!).slice(0, 3)
    : [];
  const pick = perNight.find((n) => n.night === night)?.best;
  const chosen = rows.find((r) => r.slug === place) ?? pick ?? rows[0];
  const chosenDest = chosen ? getDestination(chosen.slug) : undefined;
  // Don't mark the final rail state while the forecast is still loading or a choice is unavailable.
  const showSummary = Boolean(summary && data && chosen && chosenDest && night);
  const metricsFor = (n: string) => {
    if (!data) return undefined;
    const row = perNight.find((x) => x.night === n)?.best ?? data.results.find((r) => r.date === n);
    return row ? data.metrics[`${row.slug}|${n}`] : undefined;
  };

  // A new step: bring its heading into view under the rail and move focus to it, so keyboard
  // and screen-reader users land on the new question instead of a vanished button.
  useEffect(() => {
    if (!navigated.current) return;
    navigated.current = false;
    const h = headingRef.current;
    if (!h) return;
    const top = h.getBoundingClientRect().top;
    if (top < 150 || top > window.innerHeight - 120) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      h.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
    h.focus({ preventScroll: true });
  }, [step, summary]);

  const to = (n: PlanStep) => {
    navigated.current = true;
    onStep(n);
  };
  const go = (n: PlanStep) => {
    if (showSummary) onEdit?.();
    to(n);
  };
  const railSteps: RailStep[] = [
    { n: 1, label: p.steps.activity, value: dict.experience[mode], reachable: true },
    { n: 2, label: p.steps.night, value: night ? formatNight(night, locale, { short: true }) : undefined, reachable: !!data },
    { n: 3, label: p.steps.place, value: chosenDest?.name[locale], reachable: !!data && !!night },
    { n: 4, label: p.steps.plan, reachable: !!data && !!chosen },
  ];
  const rail = <PlanRail steps={railSteps} step={showSummary ? 4 : step} ready={showSummary} onStep={go} label={p.title} showValues={!showSummary} />;

  // The hero chose activity and night; the week's pick chose the place. Show that, not the steps.
  if (showSummary && data && chosen && chosenDest && night) {
    const choices = [
      { label: p.steps.activity, value: dict.experience[mode], step: 1 as const },
      { label: p.steps.night, value: formatNight(night, locale, { short: true }), step: 2 as const },
      { label: p.steps.place, value: chosenDest.name[locale], step: 3 as const },
    ];
    return (
      <div className="home-planner" data-mode={mode}>
        {rail}
        <div className="plan-step-in mt-6">
          <h3 ref={headingRef} tabIndex={-1} className="plan-step-title lead font-medium">{t.readyTitle}</h3>
          <p className="small mt-1 text-ink-2">{t.readyLead}</p>
          <ul className="ready-choices mt-4" aria-label={p.title}>
            {choices.map((c) => (
              <li key={c.step}>
                <span className="ready-k">{c.label}</span>
                <span className="ready-v">{c.value}</span>
                <button type="button" className="link small min-h-11" onClick={() => go(c.step)}>{t.change}</button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="btn plan-go" onClick={() => go(4)}>
              {t.seePlan}
              <Forward aria-hidden size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const title = { 1: p.activityTitle, 2: p.nightTitle, 3: p.placeTitle, 4: t.summaryTitle }[step];
  // Distinct from the step container's key: both are siblings in `plan-body`, and a shared key made
  // React keep a stale step on screen (two activity sections after "start over").
  const helper = <TripHelper key={`helper-${step}`} step={step} mode={mode} night={night} chosen={chosen} data={data} onMode={onMode} onNight={onNight} />;

  return (
    <div className="home-planner" data-mode={mode}>
      {rail}

      <div className={`plan-body mt-6 ${step === 4 ? "" : "has-helper"}`}>
        {/* Keyed by step so each new question arrives with one short, reduced-motion-aware entrance. */}
        <div key={`step-${step}`} className="plan-step-in min-w-0">
          <h3 ref={headingRef} tabIndex={-1} className="plan-step-title lead font-medium">{title}</h3>

          {step === 1 && (
            <fieldset className="mt-4">
              <legend className="sr-only">{p.activityTitle}</legend>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {(["kashta", "stars"] as const).map((x) => (
                  <label key={x} className="mode-tile" data-mode={x}>
                    <input type="radio" name="home-plan-activity" value={x} checked={mode === x} onChange={() => { navigated.current = true; onMode(x); }} onClick={() => { if (mode === x) to(2); }} />
                    <span className="mode-tile-art" aria-hidden><NightScene mode={x} tile /></span>
                    <span className="mode-tile-text">
                      <span className="font-medium">{dict.experience[x]}</span>
                      <span className="small muted hidden sm:block">{x === "kashta" ? dict.experience.kashtaDesc : dict.experience.starsDesc}</span>
                    </span>
                  </label>
                ))}
              </div>
              <Nav next={{ label: p.toNight, onClick: () => to(2) }} forward={Forward} />
            </fieldset>
          )}

          {step > 1 && !data && <Skeleton className="mt-4 h-40 rounded-xl" />}

          {step === 2 && data && (
            <div className="mt-4">
              <div className="on-night on-dark rounded-[18px] p-4 md:p-5">
                <SevenNights compact nights={perNight} metricsFor={metricsFor} selected={night} bestNight={bestNight} onSelect={onNight} />
              </div>
              <ul className="week-legend small mt-3 text-ink-2">
                <li><span className="week-legend-bar" aria-hidden />{t.weekBars[mode]}</li>
                <li><span className="week-legend-na !bg-ink/20" aria-hidden />{t.weekIncomplete}</li>
              </ul>
              <Nav back={() => to(1)} next={night && pick ? { label: p.toPlace, onClick: () => to(3) } : undefined} forward={Forward} />
            </div>
          )}

          {step === 3 && data && (
            <div className="mt-4">
              {rows.length === 0 ? (
                <p className="bg-sand-2 p-4">{t.placesNone}</p>
              ) : (
                <fieldset>
                  <legend className="sr-only">{p.placeTitle}</legend>
                  <div className="grid gap-3">
                    {rows.map((r) => {
                      const d = getDestination(r.slug)!;
                      const rt = rating(r.score);
                      return (
                        <label key={r.slug} className="place-option !items-start">
                          <input type="radio" name="home-plan-place" value={r.slug} checked={chosen?.slug === r.slug} onChange={() => onPlace(r.slug)} />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 font-medium">
                              {d.name[locale]}
                              {pick?.slug === r.slug && <span className="small rounded-full bg-sky px-2 py-0.5 text-[var(--accent)]">{t.bestForNight}</span>}
                            </span>
                            <ReasonList className="small mt-1.5" reasons={nightReasons(r, data.metrics[`${r.slug}|${r.date}`], 1)} />
                            <span className="small mt-1.5 block text-ink-2">
                              <bdi className="num">{approxHours(estimateDrive(d).hours, locale)}</bdi> <span className="muted">({t.estimate})</span>
                            </span>
                          </span>
                          <span className="rating-pill" style={{ ["--rating" as string]: RATING_COLOR[rt] }}>{dict.rating[rt]}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <Nav back={() => to(2)} next={chosen ? { label: p.toPlan, onClick: () => { onPlace(chosen.slug); to(4); } } : undefined} forward={Forward} />
            </div>
          )}

          {step === 4 && data && !chosen && <p className="mt-4 bg-sand-2 p-4">{t.placesNone}</p>}
          {step === 4 && data && chosen && chosenDest && (
          <PlanSummary
            mode={mode}
            row={chosen}
            data={data}
            onBack={() => to(3)}
            onRestart={() => {
              // The summary-first homepage must enter the editable flow before showing step 1.
              onEdit?.();
              to(1);
            }}
            helper={helper}
          />
          )}
        </div>

        {/* Beside the decision on wide screens, under it on phones; optional either way. */}
        {step !== 4 && helper}
      </div>
    </div>
  );
}

function Nav({ back, next, forward: Forward }: { back?: () => void; next?: { label: string; onClick: () => void }; forward: typeof ChevronLeft }) {
  const { dict } = useI18n();
  return (
    <div className="plan-nav mt-5 flex flex-wrap items-center gap-3">
      {next && (
        <button type="button" className="btn plan-go" onClick={next.onClick}>
          {next.label}
          <Forward aria-hidden size={18} />
        </button>
      )}
      {back && <button type="button" className="btn-quiet" onClick={back}>{dict.plan.back}</button>}
    </div>
  );
}

/** Same key as the place page's checklist, so ticks made here are still ticked there. */
const checklistKey = (slug: string, date: string) => `kashta:checklist:${slug}:${date}`;

/**
 * The finished plan. The card answers "where and when"; "before you go" gathers what to do:
 * the leave time, the permit, and the first essentials for this activity and this weather.
 */
function PlanSummary({ mode, row, data, onBack, onRestart, helper }: { mode: Experience; row: ScoreRow; data: PlanResponse; onBack: () => void; onRestart: () => void; helper: React.ReactNode }) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const d = getDestination(row.slug)!;
  const m = data.forecasts[row.slug]?.metrics.find((x) => x.date === row.date) ?? null;
  const rt = rating(row.score);
  const prefs = { ...DEFAULT_PREFS, experience: mode, date: row.date };
  const items = buildChecklist({ experience: mode, groupSize: prefs.groupSize, metrics: m, permitStatus: d.permit.status });
  // Lead with what this activity and this night call for; the permit has its own row.
  const order = mode === "stars" ? ["stars", "weather", "camp", "vehicle"] : ["weather", "camp", "vehicle", "stars"];
  const permitItem = items.find((i) => i.id === "permit");
  const essentials = items
    .filter((i) => i.group !== "documents")
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .slice(0, 4);
  const [share, setShare] = useState<"idle" | "copied" | "failed">("idle");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const placeHref = `/destinations/${row.slug}?night=${row.date}&exp=${mode}`;
  const drive = estimateDrive(d);
  // Leave-by: sunset minus the same rounded drive estimate the card shows, down to a quarter hour.
  const leaveBy = (() => {
    if (!m?.sunset) return null;
    const [h, min] = m.sunset.split(":").map(Number);
    const shownHours = Math.max(0.5, Math.round(drive.hours * 2) / 2);
    const total = h * 60 + min - shownHours * 60;
    if (!Number.isFinite(total) || total < 0) return null;
    const q = Math.floor(total / 15) * 15;
    return `${String(Math.floor(q / 60)).padStart(2, "0")}:${String(q % 60).padStart(2, "0")}`;
  })();

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(checklistKey(row.slug, row.date)) ?? "[]");
      // Restore ticks saved on this device (here or on the place page).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setTicked(new Set(saved.filter((x): x is string => typeof x === "string")));
    } catch {
      /* storage unavailable: ticks last for this visit */
    }
  }, [row.slug, row.date]);

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(checklistKey(row.slug, row.date), JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });

  const copy = async () => {
    const link = buildPlanShareUrl(window.location.origin, row.slug, row.date, prefs);
    try {
      if (!link || !navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(link);
      setShare("copied");
    } catch {
      setShare("failed");
    }
  };

  const checkRows = [...(permitItem ? [permitItem] : []), ...essentials];

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
      <div className="min-w-0">
        <article className="rec-card on-night plan-result" data-mode={mode} aria-label={t.summaryTitle}>
          <p className="rec-kicker small">{t.nightChosen} {formatNight(row.date, locale)}</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h4 className="rec-place">{d.name[locale]}</h4>
            <span className="rec-rating" style={{ ["--rating" as string]: RATING_COLOR[rt] }}>{dict.rating[rt]}</span>
          </div>
          <ReasonList className="mt-4" reasons={nightReasons(row, data.metrics[`${row.slug}|${row.date}`], 1)} />
          <ul className="rec-divider small mt-5 grid gap-2 pt-4">
            <li className="flex items-center gap-2" title={dict.common.estimateNote}>
              <Car aria-hidden size={16} />
              <bdi className="num">{approxHours(drive.hours, locale)}</bdi>
              <span className="muted">({t.estimate})</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck aria-hidden size={16} />
              <span className="font-medium">{dict.permit.short[d.permit.status]}</span>
            </li>
          </ul>
        </article>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={`${placeHref}#checklist-heading`} className="btn plan-go">{t.openFull}</Link>
          <button type="button" className="btn-quiet" onClick={copy}>{dict.plan.shareLink}</button>
        </div>
        <p role="status" className="small mt-2 min-h-5 text-ink-2">
          {share === "copied" ? dict.plan.shareCopied : share === "failed" ? dict.plan.shareInvalid : ""}
        </p>
        <div className="flex flex-wrap gap-x-4">
          <button type="button" className="link small min-h-11" onClick={onBack}>{dict.plan.back}</button>
          <button type="button" className="link small min-h-11" onClick={onRestart}>{t.startOver}</button>
          <Link href={`/plan?exp=${mode}&night=${row.date}&place=${row.slug}`} className="link small inline-flex min-h-11 items-center">{t.fullPlanner}</Link>
        </div>
      </div>

      <div className="min-w-0">
        <section className="before-go" aria-labelledby="before-go-title">
          <h4 id="before-go-title" className="font-medium">{t.beforeTitle}</h4>
          {leaveBy && (
            <p className="before-go-time mt-3">
              <Clock aria-hidden size={18} className="shrink-0" />
              <span>
                {t.leaveBy} <bdi dir="ltr" className="num font-semibold">{leaveBy}</bdi>
                <span className="small block before-go-note">{t.leaveByNote}</span>
              </span>
            </p>
          )}
          <ul className="before-go-list mt-3">
            {checkRows.map((i) => (
              <li key={i.id}>
                <label className="before-go-item">
                  <input type="checkbox" checked={ticked.has(i.id)} onChange={() => toggle(i.id)} />
                  <span className="before-go-box" aria-hidden><Check size={14} strokeWidth={3} /></span>
                  <span className="min-w-0">{i.label[locale]}</span>
                </label>
                {i.id === "permit" && d.permit.applyUrl && (
                  <a className="link small before-go-link inline-flex min-h-11 items-center gap-1" href={d.permit.applyUrl} target="_blank" rel="noopener">
                    {dict.permit.apply}
                    <ExternalLink aria-hidden size={12} />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="small mt-3 text-ink-2">{t.packingNote(prefs.groupSize)} {t.beforeSaved}</p>
        </section>
        {helper}
      </div>
    </div>
  );
}

/**
 * The trip helper, beside each decision. Steps 1–2: plain words → the same choices the page
 * offers (activity, a night the forecast covers), with exactly what was understood. Steps 3–4:
 * explain the chosen place and night from the server's own numbers. It never picks a place,
 * changes a score, or speaks for permits.
 */
function TripHelper({ step, mode, night, chosen, data, onMode, onNight }: {
  step: PlanStep;
  mode: Experience;
  night: string | null;
  chosen: ScoreRow | undefined;
  data: PlanResponse | null;
  onMode: (m: Experience) => void;
  onNight: (n: string) => void;
}) {
  const { locale, dict } = useI18n();
  const h = dict.home.helper;
  const ai = useAiStatus();
  const id = useId();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [state, setState] = useState<{ s: "idle" | "loading" } | { s: "error"; code: ClientErrorCode } | { s: "done"; understood: string[]; filled: string[] }>({ s: "idle" });
  const explain = step >= 3;
  // The homepage helper only changes activity and night, so keep its examples within those fields.
  const samples = step === 2 ? h.samples.night : h.samples.activity;

  const run = async () => {
    if (text.trim().length < 4) return setState({ s: "error", code: "invalid_input" });
    setState({ s: "loading" });
    const res = await callApi<{ prefs: InterpretedPrefs }>("/api/ai/interpret", { method: "POST", body: JSON.stringify({ text, locale }) });
    if (!res.ok) return setState({ s: "error", code: res.code });
    const got = res.data.prefs;
    const understood: string[] = [];
    const filled: string[] = [];
    if (got.experience) {
      understood.push(dict.experience[got.experience]);
      if (got.experience !== mode) { onMode(got.experience); filled.push(dict.experience[got.experience]); }
    }
    if (got.date && got.date !== "flexible") {
      understood.push(formatNight(got.date, locale));
      // Only nights the forecast actually covers can be chosen.
      if (data?.nights.includes(got.date) && got.date !== night) { onNight(got.date); filled.push(formatNight(got.date, locale, { short: true })); }
    }
    if (got.priorities?.length) understood.push(got.priorities.map((f) => dict.factor[f]).join(locale === "ar" ? "، " : ", "));
    if (got.windTolerance) understood.push(`${dict.plan.windLabel}: ${dict.wind[got.windTolerance]}`);
    if (got.tempPref) understood.push(`${dict.plan.tempLabel}: ${dict.temp[got.tempPref]}`);
    setState({ s: "done", understood, filled });
  };

  return (
    <aside className="trip-helper" data-mode={mode} aria-labelledby={`${id}-name`}>
      <div className="flex items-center gap-3">
        <span className="helper-mark" aria-hidden />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold" id={`${id}-name`}>{h.name}</span>
            <span className="trip-helper-tag">{h.optional}</span>
          </p>
          <p className="small text-ink-2">{explain ? (step === 3 ? h.explainPlace : h.explainPlan) : h.describeWhat}</p>
        </div>
      </div>

      {explain && chosen ? (
        <div className="mt-3">
          <ExplainPanel
            compact
            label={step === 3 ? h.askPlace : h.askPlan}
            slug={chosen.slug}
            date={chosen.date}
            prefs={{ ...DEFAULT_PREFS, experience: mode, date: chosen.date }}
            forecastKey={JSON.stringify([data?.forecastFetchedAt, chosen.date, chosen.slug])}
          />
          <p className="small mt-3 text-ink-2">{h.limitExplain}</p>
        </div>
      ) : (
        <div className="mt-3">
          <label htmlFor={`${id}-text`} className="sr-only">{h.label}</label>
          <textarea
            ref={inputRef}
            id={`${id}-text`}
            className="field min-h-[4.5rem] resize-y"
            rows={2}
            value={text}
            maxLength={600}
            placeholder={h.placeholder}
            onChange={(e) => {
              setText(e.target.value);
              if (state.s !== "idle") setState({ s: "idle" });
            }}
          />
          <p className="small mt-2 text-ink-2" id={`${id}-try`}>{h.try}</p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-try`}>
            {samples.map((sample) => (
              <button
                key={sample}
                type="button"
                className="helper-chip"
                onClick={() => {
                  setText(sample);
                  setState({ s: "idle" });
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                {sample}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-quiet" onClick={run} disabled={ai !== true || state.s === "loading" || text.trim().length === 0} aria-describedby={ai === false ? `${id}-off` : undefined}>
              {state.s === "loading" && <LoaderCircle aria-hidden size={18} className="animate-spin" />}
              {state.s === "loading" ? dict.plan.describing : h.submit}
            </button>
          </div>
          {ai === false && <p id={`${id}-off`} className="small mt-3 text-ink-2">{dict.errors.ai_not_configured}</p>}
          <div aria-live="polite">
            {state.s === "error" && <ErrorState className="mt-3" code={state.code} />}
            {state.s === "done" && (
              <div className="small mt-3 rounded-xl bg-sand-2 p-3">
                {state.understood.length ? (
                  <p>
                    <span className="font-medium">{h.understood}</span> {state.understood.join(locale === "ar" ? "، " : ", ")}
                    {state.filled.length > 0 && <> <span className="font-medium">{h.filled}</span> {state.filled.join(locale === "ar" ? "، " : ", ")}</>}
                  </p>
                ) : (
                  <p>{dict.home.helperNothing}</p>
                )}
                <p className="mt-1 text-ink-2">
                  {dict.home.helperMore}{" "}
                  <Link href={`/plan?q=${encodeURIComponent(text)}&exp=${mode}`} className="link">{dict.home.fullPlanner}</Link>
                </p>
              </div>
            )}
          </div>
          <p className="small mt-3 text-ink-2">{h.limitDescribe}</p>
        </div>
      )}
    </aside>
  );
}
