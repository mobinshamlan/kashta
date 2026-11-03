"use client";

import Link from "next/link";
import { Car, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Compass, ExternalLink, Flag, LoaderCircle, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { useId, useRef, useState } from "react";
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
}) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const p = dict.plan;
  const Forward = locale === "ar" ? ChevronLeft : ChevronRight;

  const rows: ScoreRow[] = data && night
    ? data.results.filter((r) => r.date === night && r.score !== null).sort((a, b) => b.score! - a.score!).slice(0, 3)
    : [];
  const pick = perNight.find((n) => n.night === night)?.best;
  const chosen = rows.find((r) => r.slug === place) ?? pick ?? rows[0];
  const chosenDest = chosen ? getDestination(chosen.slug) : undefined;
  const metricsFor = (n: string) => {
    if (!data) return undefined;
    const row = perNight.find((x) => x.night === n)?.best ?? data.results.find((r) => r.date === n);
    return row ? data.metrics[`${row.slug}|${n}`] : undefined;
  };

  const steps: { n: 1 | 2 | 3; label: string; value?: string }[] = [
    { n: 1, label: p.steps.activity, value: dict.experience[mode] },
    { n: 2, label: p.steps.night, value: night ? formatNight(night, locale, { short: true }) : undefined },
    { n: 3, label: p.steps.place, value: chosenDest?.name[locale] },
  ];
  const title = { 1: p.activityTitle, 2: p.nightTitle, 3: p.placeTitle, 4: t.summaryTitle }[step];
  // What is already decided, so each step reads in context ("نجوم · الخميس 6 نوفمبر").
  const context = [dict.experience[mode], step > 2 && night ? formatNight(night, locale, { short: true }) : null, step > 3 && chosenDest ? chosenDest.name[locale] : null]
    .filter(Boolean)
    .join(" · ");
  const helper = <Helper key={step} step={step} mode={mode} night={night} chosen={chosen} data={data} onMode={onMode} onNight={onNight} />;

  return (
    <div className="home-planner" data-mode={mode}>
      {/* The journey: three decisions and the destination they lead to. */}
      <ol className="journey" aria-label={p.title}>
        {steps.map((s) => (
          <li key={s.n} aria-current={step === s.n ? "step" : undefined} data-done={s.n < step || undefined}>
            <button
              type="button"
              className="journey-step"
              disabled={step === s.n || (s.n > 1 && !data)}
              onClick={() => onStep(s.n)}
              aria-label={`${s.n}. ${s.label}${s.n < step && s.value ? `: ${s.value}` : ""}`}
            >
              <span className="journey-n num" aria-hidden>{s.n < step ? <Check size={13} /> : s.n}</span>
              <span className="journey-label">{s.label}</span>
              {s.n < step && s.value && <span className="journey-v">{s.value}</span>}
            </button>
          </li>
        ))}
        <li className="journey-end" aria-current={step === 4 ? "step" : undefined}>
          <span className="journey-n" aria-hidden><Flag size={13} /></span>
          <span className="journey-label">{t.journeyEnd}</span>
          <span className="journey-v">{t.journeyEndHint}</span>
        </li>
      </ol>

      <div className="mt-6" aria-live="polite">
        <p className="small text-ink-2">{p.stepOf(step, 4)}{step > 1 && context ? ` · ${context}` : ""}</p>
        <h3 className="lead mt-1 font-medium">{title}</h3>

        {step === 1 && (
          <fieldset className="mt-4">
            <legend className="sr-only">{p.activityTitle}</legend>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {(["kashta", "stars"] as const).map((x) => (
                <label key={x} className="mode-tile" data-mode={x}>
                  <input type="radio" name="home-plan-activity" value={x} checked={mode === x} onChange={() => { onMode(x); onStep(2); }} onClick={() => mode === x && onStep(2)} />
                  <span className="mode-tile-art" aria-hidden><NightScene mode={x} tile /></span>
                  <span className="mode-tile-text">
                    <span className="font-medium">{dict.experience[x]}</span>
                    <span className="small muted hidden sm:block">{x === "kashta" ? dict.experience.kashtaDesc : dict.experience.starsDesc}</span>
                  </span>
                </label>
              ))}
            </div>
            {helper}
            <Nav next={{ label: p.toNight, onClick: () => onStep(2) }} forward={Forward} />
          </fieldset>
        )}

        {step > 1 && !data && <Skeleton className="mt-4 h-40 rounded-xl" />}

        {step === 2 && data && (
          <div className="mt-4">
            <div className="on-night on-dark rounded-[18px] p-4 md:p-5">
              <SevenNights compact nights={perNight} metricsFor={metricsFor} selected={night} bestNight={bestNight} onSelect={onNight} />
            </div>
            {helper}
            <Nav back={() => onStep(1)} next={night && pick ? { label: p.toPlace, onClick: () => onStep(3) } : undefined} forward={Forward} />
          </div>
        )}

        {step === 3 && data && (
          <div className="mt-4">
            {rows.length === 0 ? (
              <p className="bg-sand-2 p-4">{t.placesNone}</p>
            ) : (
              <fieldset>
                <legend className="sr-only">{p.placeTitle}</legend>
                <div className="grid gap-3 md:grid-cols-3">
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
                          <span className="small mt-1.5 block text-ink-2" title={dict.common.estimateNote}>
                            <bdi className="num">{approxHours(estimateDrive(d).hours, locale)}</bdi>
                          </span>
                        </span>
                        <span className="rating-pill" style={{ ["--rating" as string]: RATING_COLOR[rt] }}>{dict.rating[rt]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {helper}
            <Nav back={() => onStep(2)} next={chosen ? { label: p.toPlan, onClick: () => { onPlace(chosen.slug); onStep(4); } } : undefined} forward={Forward} />
          </div>
        )}

        {step === 4 && data && chosen && chosenDest && (
          <>
            <PlanSummary mode={mode} row={chosen} data={data} onBack={() => onStep(3)} onRestart={() => onStep(1)} />
            {helper}
          </>
        )}
      </div>
    </div>
  );
}

function Nav({ back, next, forward: Forward }: { back?: () => void; next?: { label: string; onClick: () => void }; forward: typeof ChevronLeft }) {
  const { dict } = useI18n();
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
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

/** The finished plan: the answer, the drive, the permit and the first things to pack. */
function PlanSummary({ mode, row, data, onBack, onRestart }: { mode: Experience; row: ScoreRow; data: PlanResponse; onBack: () => void; onRestart: () => void }) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const d = getDestination(row.slug)!;
  const m = data.forecasts[row.slug]?.metrics.find((x) => x.date === row.date) ?? null;
  const rt = rating(row.score);
  const prefs = { ...DEFAULT_PREFS, experience: mode, date: row.date };
  // The permit already has its own line; lead with what this night and activity call for.
  const order = mode === "stars" ? ["stars", "weather", "camp", "vehicle"] : ["weather", "camp", "vehicle", "stars"];
  const packing = buildChecklist({ experience: mode, groupSize: prefs.groupSize, metrics: m, permitStatus: d.permit.status })
    .filter((i) => i.group !== "documents")
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .slice(0, 5);
  const [share, setShare] = useState<"idle" | "copied" | "failed">("idle");
  const placeHref = `/destinations/${row.slug}?night=${row.date}&exp=${mode}`;
  // Leave-by: sunset minus the estimated drive, rounded down to a quarter hour. Both inputs are
  // already shown elsewhere; this only combines them, so it is still an estimate.
  const drive = estimateDrive(d);
  const leaveBy = (() => {
    if (!m?.sunset) return null;
    const [h, min] = m.sunset.split(":").map(Number);
    const total = h * 60 + min - Math.round(drive.hours * 60);
    if (!Number.isFinite(total) || total < 0) return null;
    const q = Math.floor(total / 15) * 15;
    return `${String(Math.floor(q / 60)).padStart(2, "0")}:${String(q % 60).padStart(2, "0")}`;
  })();

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

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <article className="rec-card on-night" data-mode={mode} aria-label={t.summaryTitle}>
        <p className="rec-kicker small">{t.nightChosen} {formatNight(row.date, locale)}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h4 className="rec-place">{d.name[locale]}</h4>
          <span className="rec-rating" style={{ ["--rating" as string]: RATING_COLOR[rt] }}>{dict.rating[rt]}</span>
        </div>
        <ReasonList className="mt-4" reasons={nightReasons(row, data.metrics[`${row.slug}|${row.date}`], 1)} />
        <ul className="rec-divider small mt-5 grid gap-2 pt-4">
          {leaveBy && (
            <li className="flex items-start gap-2">
              <Clock aria-hidden size={16} className="mt-0.5 shrink-0" />
              <span>
                {t.leaveBy} <bdi dir="ltr" className="num font-medium">{leaveBy}</bdi>
                <span className="muted block">{t.leaveByNote}</span>
              </span>
            </li>
          )}
          <li className="flex items-center gap-2" title={dict.common.estimateNote}>
            <Car aria-hidden size={16} />
            <bdi className="num">{approxHours(drive.hours, locale)}</bdi>
            <span className="muted">{locale === "ar" ? "(تقدير)" : "(est.)"}</span>
          </li>
          <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ShieldCheck aria-hidden size={16} />
            <span className="font-medium">{dict.permit.short[d.permit.status]}</span>
            {d.permit.applyUrl && (
              <a className="rec-link inline-flex min-h-11 items-center gap-1" href={d.permit.applyUrl} target="_blank" rel="noopener">
                {dict.permit.apply}
                <ExternalLink aria-hidden size={13} />
              </a>
            )}
          </li>
        </ul>
      </article>

      <div className="min-w-0">
        <h4 className="font-medium">{t.packingTitle}</h4>
        <ul className="mt-3 grid gap-2">
          {packing.map((i) => (
            <li key={i.id} className="flex items-start gap-2">
              <Check aria-hidden size={17} className="mt-1 shrink-0 text-olive" />
              <span>{i.label[locale]}</span>
            </li>
          ))}
        </ul>
        <p className="small mt-3 text-ink-2">{t.packingNote(prefs.groupSize)}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`${placeHref}#checklist-heading`} className="btn plan-go">{t.openFull}</Link>
          <button type="button" className="btn-quiet" onClick={copy}>{dict.plan.shareLink}</button>
        </div>
        <p role="status" className="small mt-2 text-ink-2">
          {share === "copied" ? dict.plan.shareCopied : share === "failed" ? dict.plan.shareInvalid : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4">
          <button type="button" className="link small min-h-11" onClick={onBack}>{dict.plan.back}</button>
          <button type="button" className="link small min-h-11" onClick={onRestart}>{t.startOver}</button>
          <Link href={`/plan?exp=${mode}&night=${row.date}&place=${row.slug}`} className="link small inline-flex min-h-11 items-center">{t.fullPlanner}</Link>
        </div>
      </div>
    </div>
  );
}

/**
 * One helper, beside each decision. Steps 1–3: turn plain words into the same choices (activity,
 * a night the forecast covers) and say exactly what was understood. Step 4: explain the plan from
 * the server's own numbers. It never picks a place or adds facts of its own.
 */
function Helper({ step, mode, night, chosen, data, onMode, onNight }: {
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
  const SuggestionArrow = locale === "ar" ? ChevronLeft : ChevronRight;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [state, setState] = useState<{ s: "idle" | "loading" } | { s: "error"; code: ClientErrorCode } | { s: "done"; understood: string[]; filled: string[] }>({ s: "idle" });
  const key = step === 1 ? "activity" : step === 2 ? "night" : step === 3 ? "place" : "plan";
  const sample = key === "activity" ? h.sample.activity[mode] : h.sample[key];

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
    <aside className={`helper-card mt-5${open ? " is-open" : ""}`} data-mode={mode} aria-labelledby={`${id}-name`}>
      <span className="helper-mark" aria-hidden />
      <div className="helper-body">
        <div className="helper-heading">
          <div className="min-w-0">
            <p className="helper-name" id={`${id}-name`}><Compass aria-hidden size={15} />{h.name}</p>
            <p className="helper-line">{h[key]}</p>
          </div>
          <button type="button" className="helper-open" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown aria-hidden size={17} /> : <MessageCircleQuestion aria-hidden size={17} />}
            {open ? h.close : step === 4 ? h.ask : h.open}
          </button>
        </div>
        {!open && step !== 4 && sample && (
          <button
            type="button"
            className="helper-sample"
            onClick={() => {
              setText(sample);
              setState({ s: "idle" });
              setOpen(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <span className="helper-sample-label">{h.try}</span>
            <span>{sample}</span>
            <SuggestionArrow aria-hidden size={15} className="helper-sample-arrow" />
          </button>
        )}
        <div id={`${id}-panel`} hidden={!open} className="mt-3">
          {step === 4 && chosen ? (
            <ExplainPanel slug={chosen.slug} date={chosen.date} prefs={{ ...DEFAULT_PREFS, experience: mode, date: chosen.date }} forecastKey={JSON.stringify([data?.forecastFetchedAt, chosen.date, chosen.slug])} />
          ) : (
            <>
              <label htmlFor={`${id}-text`} className="sr-only">{dict.plan.describeLabel}</label>
              <textarea
                ref={inputRef}
                id={`${id}-text`}
                className="field min-h-20 resize-y"
                value={text}
                maxLength={600}
                placeholder={h.placeholder[key === "plan" ? "place" : key]}
                onChange={(e) => {
                  setText(e.target.value);
                  if (state.s !== "idle") setState({ s: "idle" });
                }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" className="btn-quiet" onClick={run} disabled={ai !== true || state.s === "loading"}>
                  {state.s === "loading" && <LoaderCircle aria-hidden size={18} className="animate-spin" />}
                  {state.s === "loading" ? dict.plan.describing : dict.plan.describeButton}
                </button>
                <Link href={`/plan?q=${encodeURIComponent(text)}&exp=${mode}`} className="link small inline-flex min-h-11 items-center">{dict.home.fullPlanner}</Link>
              </div>
              {ai === false && <p className="small mt-3 text-ink-2">{dict.errors.ai_not_configured}</p>}
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
                    <p className="mt-1 text-ink-2">{dict.home.helperMore}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
