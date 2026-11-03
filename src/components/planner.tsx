"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, Flag, Flame, LoaderCircle, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { rememberPlanForecasts } from "@/lib/forecast-storage";
import type { NightSummary, PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { RECOMMENDABLE, getDestination, estimateDrive } from "@/lib/destinations";
import { formatNight, formatWeekday, approxHours, arHoursOf, ltr } from "@/lib/i18n";
import { bestPerNight, nightReasons } from "@/lib/reasons";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/prefs-storage";
import type { InterpretedPrefs } from "@/lib/schemas";
import { rating } from "@/lib/score";
import { buildPlanShareUrl, type SharedPlan } from "@/lib/share-link";
import type { Experience, Factor, PlanPrefs } from "@/lib/types";
import { ExplainPanel, useAiStatus } from "./explain-panel";
import { useI18n } from "./locale-provider";
import { CoverageMap } from "./coverage-map";
import { NightScene } from "./night-scene";
import { NightWindow } from "./night-window";
import { RecommendationCard, ReasonList } from "./recommendation-card";
import { SevenNights } from "./seven-nights";
import { ErrorState, FactorBars, RATING_COLOR, Skeleton } from "./ui";

type Field = keyof Omit<PlanPrefs, "city">;

const PRIORITY_OPTIONS: Factor[] = ["temp", "wind", "rain", "dust", "clouds", "moon"];

function samePlanPrefs(a: PlanPrefs, b: PlanPrefs) {
  return a.city === b.city &&
    a.experience === b.experience &&
    a.date === b.date &&
    a.groupSize === b.groupSize &&
    a.maxDriveHours === b.maxDriveHours &&
    a.tempPref === b.tempPref &&
    a.windTolerance === b.windTolerance &&
    a.priorities.length === b.priorities.length &&
    a.priorities.every((factor) => b.priorities.includes(factor));
}

export function Planner({ initialText = "", initialExperience, initialShare, initialNight, initialPlace }: {
  initialText?: string;
  initialExperience?: "kashta" | "stars";
  initialShare?: SharedPlan;
  /** From the homepage card: open straight at the plan for this night and place. */
  initialNight?: string;
  initialPlace?: string;
}) {
  const { locale, dict } = useI18n();
  const t = dict.plan;
  const ai = useAiStatus();
  const formId = useId();

  const [prefs, setPrefs] = useState<PlanPrefs>(initialShare?.prefs ?? DEFAULT_PREFS);
  const [text, setText] = useState(initialText);
  const [applied, setApplied] = useState<Set<Field>>(new Set());
  const [understood, setUnderstood] = useState<{ prefs: InterpretedPrefs; unclear?: string[] | null; unsupported?: string[] } | null>(null);
  const [interpret, setInterpret] = useState<{ s: "idle" | "loading" } | { s: "error"; code: ClientErrorCode }>({ s: "idle" });
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [plan, setPlan] = useState<
    { s: "idle" } | { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse; prefs: PlanPrefs; refreshing?: boolean; refreshError?: ClientErrorCode }
  >(initialShare ? { s: "loading" } : { s: "idle" });
  const [selected, setSelected] = useState<string | null>(null);
  // The sequence: activity → night → place → plan. Fetching always covers all seven nights.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialShare || (initialNight && initialPlace) ? 4 : initialExperience ? 2 : 1);
  const [night, setNight] = useState<string | null>(initialShare?.night ?? initialNight ?? null);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const [helperOpen, setHelperOpen] = useState(!!initialText);
  const [shareNotice, setShareNotice] = useState<{ night: string; nightOutsideCoverage: boolean; destinationUnavailable: boolean } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const startedShareRef = useRef<string | null>(null);

  const update = <K extends Field>(key: K, value: PlanPrefs[K]) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      savePrefs(next);
      return next;
    });
    setApplied((s) => {
      if (!s.has(key)) return s;
      const n = new Set(s);
      n.delete(key);
      return n;
    });
  };

  const runInterpret = async () => {
    if (text.trim().length < 4) {
      setInterpret({ s: "error", code: "invalid_input" });
      return;
    }
    setInterpret({ s: "loading" });
    const res = await callApi<{ prefs: InterpretedPrefs; unsupported?: string[] }>("/api/ai/interpret", {
      method: "POST",
      body: JSON.stringify({ text, locale }),
    });
    if (!res.ok) {
      setInterpret({ s: "error", code: res.code });
      return;
    }
    const got = res.data.prefs;
    const changed = new Set<Field>();
    const next = { ...prefs };
    if (got.experience) {
      next.experience = got.experience;
      changed.add("experience");
    }
    if (got.groupSize) {
      next.groupSize = got.groupSize;
      changed.add("groupSize");
    }
    if (got.tempPref) {
      next.tempPref = got.tempPref;
      changed.add("tempPref");
    }
    if (got.windTolerance) {
      next.windTolerance = got.windTolerance;
      changed.add("windTolerance");
    }
    if (got.maxDriveHours) {
      next.maxDriveHours = Math.min(5, Math.max(1.5, Math.round(got.maxDriveHours * 2) / 2));
      changed.add("maxDriveHours");
    }
    if (got.date) {
      if (got.date !== "flexible") setNight(got.date);
      changed.add("date");
    }
    if (got.priorities?.length) {
      next.priorities = got.priorities.slice(0, 3);
      changed.add("priorities");
    }
    setPrefs(next);
    savePrefs(next);
    setApplied(changed);
    setUnderstood({ prefs: got, unclear: got.unclear, unsupported: res.data.unsupported });
    setInterpret({ s: "idle" });
  };

  /** The current value of a field the description filled in, for the "and chose for you" line. */
  const appliedLabel = (f: Field): string => {
    switch (f) {
      case "experience": return dict.experience[prefs.experience];
      case "date": return night ? formatNight(night, locale) : t.flexible;
      case "groupSize": return `${t.groupLabel}: ${prefs.groupSize}`;
      case "maxDriveHours": return t.driveValue(prefs.maxDriveHours);
      case "tempPref": return dict.temp[prefs.tempPref];
      case "windTolerance": return dict.wind[prefs.windTolerance];
      case "priorities": return prefs.priorities.map((x) => dict.factor[x]).join(locale === "ar" ? "، " : ", ");
    }
  };

  const interpretedSummary = (got: InterpretedPrefs) => {
    const parts: string[] = [];
    if (got.experience) parts.push(t.experienceLabel + ": " + dict.experience[got.experience]);
    if (got.groupSize) parts.push(t.groupLabel + ": " + got.groupSize);
    if (got.date) parts.push(t.dateLabel + ": " + (got.date === "flexible" ? t.flexible : formatNight(got.date, locale)));
    if (got.maxDriveHours) {
      const driveHours = Math.min(5, Math.max(1.5, Math.round(got.maxDriveHours * 2) / 2));
      parts.push(t.driveLabel + ": " + t.driveValue(driveHours));
    }
    if (got.tempPref) parts.push(t.tempLabel + ": " + dict.temp[got.tempPref]);
    if (got.windTolerance) parts.push(t.windLabel + ": " + dict.wind[got.windTolerance]);
    if (got.priorities?.length) parts.push(t.prioritiesLabel + ": " + got.priorities.map((factor) => dict.factor[factor]).join(locale === "ar" ? "، " : ", "));
    return parts.length
      ? t.interpretedSettings + ": " + parts.join(locale === "ar" ? "، " : "; ")
      : t.interpretedNone;
  };

  const submit = useCallback(async (p: PlanPrefs, share?: SharedPlan) => {
      setPlan(previous => previous.s === "ok" ? { ...previous, refreshing: true, refreshError: undefined } : { s: "loading" });
      setSelected(null);
      const res = await callApi<PlanResponse>("/api/plan", { method: "POST", body: JSON.stringify(p) });
      if (res.ok) {
        rememberPlanForecasts(res.data, p);
        setPlan({ s: "ok", data: res.data, prefs: p });
        if (share) {
          const nightOutsideCoverage = !res.data.nights.includes(share.night);
          const destinationRows = res.data.results.filter((row) => row.slug === share.slug);
          const exactRow = nightOutsideCoverage ? undefined : destinationRows.find((row) => row.date === share.night);
          const sameDestinationRow = destinationRows.find((row) => row.score !== null) ?? destinationRows[0];
          const first = exactRow ?? sameDestinationRow ?? res.data.results.find((row) => row.score !== null) ?? res.data.results[0];
          setSelected(first ? `${first.slug}|${first.date}` : null);
          setShareNotice({ night: share.night, nightOutsideCoverage, destinationUnavailable: destinationRows.length === 0 });
        } else {
          // A place handed over from the homepage stays chosen while it is still ranked.
          const handed = initialPlace && initialNight ? res.data.results.find((row) => row.slug === initialPlace && row.date === initialNight && row.score !== null) : undefined;
          setSelected((previous) => previous ?? (handed ? `${handed.slug}|${handed.date}` : null));
          setShareNotice(null);
        }
      } else setPlan(previous => previous.s === "ok" ? { ...previous, refreshing: false, refreshError: res.code } : { s: "error", code: res.code });
  }, [setPlan, setSelected, setShareNotice, initialPlace, initialNight]);

  useEffect(() => {
    const stored = loadPrefs();
    if (initialShare) {
      const key = JSON.stringify([initialShare.slug, initialShare.night, initialShare.prefs]);
      const restoredPrefs = { ...initialShare.prefs, date: "flexible" };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs(restoredPrefs);
      if (startedShareRef.current !== key) {
        startedShareRef.current = key;
        savePrefs(restoredPrefs);
        void submit(restoredPrefs, initialShare);
      }
      return;
    }

    const restored = { ...(initialExperience ? { ...stored, experience: initialExperience } : stored), date: "flexible" };
    // The drive slider starts at 1.5 h: below that no listed place is reachable.
    const restoredPrefs = { ...restored, maxDriveHours: Math.max(1.5, restored.maxDriveHours) };
    setPrefs(restoredPrefs);
    // Show a useful result straight away; every preference already has a default.
    if (startedShareRef.current !== "auto") {
      startedShareRef.current = "auto";
      void submit(restoredPrefs);
    }
  }, [initialExperience, initialShare, submit]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    savePrefs(prefs);
    void submit(prefs);
  };

  const changeMode = (experience: Experience) => {
    const next = { ...prefs, experience };
    setPrefs(next);
    savePrefs(next);
    setApplied((s) => {
      if (!s.has("experience")) return s;
      const n = new Set(s);
      n.delete("experience");
      return n;
    });
    void submit(next);
  };

  const resultSettingsMatch = plan.s === "ok" && samePlanPrefs(plan.prefs, prefs);
  const busy = plan.s === "loading" || (plan.s === "ok" && !!plan.refreshing);
  const legend = "mb-3 font-medium";
  const panelId = `${formId}-adjust`;

  // Derived for the steps: nights compared, the chosen night, the places for it, the chosen place.
  const data = plan.s === "ok" ? plan.data : null;
  const perNight = data ? bestPerNight(data) : [];
  const bestNight = perNight.reduce<string | null>((top, n) => {
    if (!n.best) return top;
    const current = perNight.find((x) => x.night === top)?.best?.score ?? -1;
    return (n.best.score ?? -1) > current ? n.night : top;
  }, null);
  const chosenNight = night && data?.nights.includes(night) ? night : bestNight;
  const nightRows: ScoreRow[] = data && chosenNight
    ? data.results.filter((r) => r.date === chosenNight && r.score !== null).sort((a, b) => b.score! - a.score!)
    : [];
  const pickForNight = perNight.find((n) => n.night === chosenNight)?.best;
  const selectedRow = data?.results.find((r) => `${r.slug}|${r.date}` === selected && r.date === chosenNight);
  const chosenRow = selectedRow ?? pickForNight ?? nightRows[0];
  const chosenDest = chosenRow ? getDestination(chosenRow.slug) : undefined;
  const metricsFor = (n: string) => {
    if (!data) return undefined;
    const row = perNight.find((x) => x.night === n)?.best ?? data.results.find((r) => r.date === n);
    return row ? data.metrics[`${row.slug}|${n}`] : undefined;
  };
  const hoursFor = (row: ScoreRow) => data?.forecasts[row.slug]?.metrics.find((m) => m.date === row.date)?.hours;
  const placeHref = (row: ScoreRow) => `/destinations/${row.slug}?night=${row.date}&exp=${prefs.experience}`;

  const goTo = (next: 1 | 2 | 3 | 4) => {
    setStep(next);
    requestAnimationFrame(() => stepRef.current?.focus());
  };
  const pickMode = (experience: Experience) => {
    if (experience !== prefs.experience) {
      setSelected(null);
      changeMode(experience);
    }
    goTo(2);
  };

  const STEPS = [
    { n: 1, label: t.steps.activity, value: dict.experience[prefs.experience] },
    { n: 2, label: t.steps.night, value: chosenNight ? formatNight(chosenNight, locale, { short: true }) : "—" },
    { n: 3, label: t.steps.place, value: chosenDest?.name[locale] ?? "—" },
  ] as const;
  const stepTitle = { 1: t.activityTitle, 2: t.nightTitle, 3: t.placeTitle, 4: t.planReady }[step];
  // What is already chosen, shown under the step counter so the context never has to be remembered.
  const sep = " · ";
  const context = [
    step > 1 ? dict.experience[prefs.experience] : null,
    step > 2 && chosenNight ? formatNight(chosenNight, locale, { short: true }) : null,
    step > 3 && chosenDest ? chosenDest.name[locale] : null,
  ].filter(Boolean).join(sep);
  const helperKey = step === 1 ? "activity" : step === 2 ? "night" : step === 3 ? "place" : "plan";

  // The helper: one card that follows the step. Steps 1–3 read a description into the same
  // choices; step 4 explains the plan from the server's own numbers.
  const helperId = `${formId}-helper`;
  const helper = (
    <aside className="helper-card mt-5" data-mode={prefs.experience} aria-labelledby={helperId}>
      <span className="helper-mark" aria-hidden />
      <div className="helper-body">
        <p className="helper-name" id={helperId}>{dict.home.helper.name}</p>
        <p className="helper-line">{dict.home.helper[helperKey]}</p>
        <button type="button" className="helper-open" aria-expanded={helperOpen} aria-controls={`${helperId}-panel`} onClick={() => setHelperOpen((v) => !v)}>
          {step === 4 ? dict.home.helper.ask : dict.home.helper.open}
        </button>
        <div id={`${helperId}-panel`} hidden={!helperOpen} className="mt-3">
          {step === 4 ? (
            data && chosenRow ? (
              resultSettingsMatch
                ? <ExplainPanel slug={chosenRow.slug} date={chosenRow.date} prefs={prefs} forecastKey={JSON.stringify([data.forecastFetchedAt, data.metrics[`${chosenRow.slug}|${chosenRow.date}`]])} />
                : <p className="small text-ink-2">{t.explainNeedsPlan}</p>
            ) : null
          ) : (
            <>
              <label htmlFor={`${formId}-text`} className="sr-only">{t.describeLabel}</label>
              <textarea
                id={`${formId}-text`}
                className="field min-h-24 resize-y"
                value={text}
                maxLength={600}
                placeholder={dict.home.helper.placeholder[helperKey as "activity" | "night" | "place"]}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={interpret.s === "error" && interpret.code === "invalid_input"}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" className="btn plan-go" onClick={runInterpret} disabled={ai !== true || interpret.s === "loading"}>
                  {interpret.s === "loading" ? <LoaderCircle aria-hidden size={18} className="animate-spin" /> : <Wand2 aria-hidden size={18} />}
                  {interpret.s === "loading" ? t.describing : t.describeButton}
                </button>
                <span className="small num text-ink-2">{text.length}/600</span>
              </div>
              {ai === false && <p className="small mt-3 text-ink-2">{dict.errors.ai_not_configured}</p>}
              <div aria-live="polite">
                {interpret.s === "error" && <ErrorState className="mt-4" code={interpret.code} />}
                {understood && (
                  <div className="mt-4 rounded-xl bg-sand-2 p-4">
                    <p className="small font-medium">{dict.home.helper.understood}</p>
                    <p className="mt-1">{interpretedSummary(understood.prefs)}</p>
                    {applied.size > 0 && (
                      <p className="small mt-2">
                        <span className="font-medium">{dict.home.helper.filled}</span>{" "}
                        {[...applied].map((f) => appliedLabel(f)).filter(Boolean).join(locale === "ar" ? "، " : ", ")}
                      </p>
                    )}
                    {understood.unsupported?.includes("moon_viewing") && <p role="status" className="small mt-2 text-ink-2">{t.moonViewingUnsupported}</p>}
                    {!!understood.unclear?.length && <p className="small mt-2 text-ink-2">{t.unclear} {understood.unclear.join(locale === "ar" ? "، " : ", ")}</p>}
                    <button type="button" className="btn-quiet mt-3" onClick={() => { savePrefs(prefs); void submit(prefs); goTo(understood.prefs.date && understood.prefs.date !== "flexible" ? 3 : 2); }}>{t.apply}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div data-mode={prefs.experience}>
      {/* Where you are, and how to step back. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <ol className="journey" aria-label={t.title}>
          {STEPS.map((s) => {
            const reachable = s.n <= 2 || (s.n === 3 && !!data);
            return (
              <li key={s.n} aria-current={step === s.n ? "step" : undefined} data-done={s.n < step || undefined}>
                <button type="button" className="journey-step" disabled={!reachable || step === s.n} onClick={() => goTo(s.n)} aria-label={`${s.n}. ${s.label}${s.n < step && s.value ? `: ${s.value}` : ""}`}>
                  <span className="journey-n num" aria-hidden>{s.n < step ? <Check size={13} /> : s.n}</span>
                  <span className="journey-label">{s.label}</span>
                  {s.n < step && s.value && <span className="journey-v">{s.value}</span>}
                </button>
              </li>
            );
          })}
          {/* The destination: not a step to click, the thing the steps lead to. */}
          <li className="journey-end" aria-current={step === 4 ? "step" : undefined}>
            <span className="journey-n" aria-hidden><Flag size={13} /></span>
            <span className="journey-label">{dict.home.journeyEnd}</span>
            <span className="journey-v">{dict.home.journeyEndHint}</span>
          </li>
        </ol>
        <button type="button" className="btn-quiet self-start md:self-auto" aria-expanded={adjustOpen} aria-controls={panelId} onClick={() => setAdjustOpen((v) => !v)}>
          <SlidersHorizontal aria-hidden size={18} />
          {t.more}
          <ChevronDown aria-hidden size={16} className={`transition-transform ${adjustOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      <form id={panelId} hidden={!adjustOpen} onSubmit={onSubmit} noValidate className="adjust-panel mt-5 flex flex-col gap-7 p-5 md:p-7" aria-label={t.adjustTitle}>
        <div>
          <label htmlFor={`${formId}-drive`} className={`${legend} flex justify-between gap-4`}>
            <span>
              {t.driveLabel}
              <AppliedTag on={applied.has("maxDriveHours")} label={t.applied} />
            </span>
            <span className="num">{approxHours(prefs.maxDriveHours, locale)}</span>
          </label>
          <input
            id={`${formId}-drive`}
            type="range"
            min={1.5}
            max={5}
            step={0.5}
            value={prefs.maxDriveHours}
            aria-valuetext={approxHours(prefs.maxDriveHours, locale)}
            onChange={(e) => update("maxDriveHours", Number(e.target.value))}
            className="h-11 w-full accent-[var(--color-clay)]"
          />
          <p className="small text-ink-2">{t.from}. {dict.common.estimateNote}.</p>
        </div>

        <details className="faq-item" open={applied.has("tempPref") || applied.has("windTolerance") || applied.has("priorities") || undefined}>
          <summary>{t.more}</summary>
          <div className="flex flex-col gap-7 pb-5 pt-3">
            <fieldset>
              <legend className={legend}>
                {t.tempLabel}
                <AppliedTag on={applied.has("tempPref")} label={t.applied} />
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(["cool", "mild", "warm"] as const).map((x) => (
                  <label key={x} className="choice justify-center">
                    <input type="radio" name="temp" checked={prefs.tempPref === x} onChange={() => update("tempPref", x)} />
                    {dict.temp[x]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={legend}>
                {t.windLabel}
                <AppliedTag on={applied.has("windTolerance")} label={t.applied} />
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["low", "medium", "high"] as const).map((x) => (
                  <label key={x} className="choice justify-center text-center">
                    <input type="radio" name="wind" checked={prefs.windTolerance === x} onChange={() => update("windTolerance", x)} />
                    {dict.wind[x]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset aria-describedby={`${formId}-priorities-hint`}>
              <legend className={legend}>
                {t.prioritiesLabel}
                <AppliedTag on={applied.has("priorities")} label={t.applied} />
              </legend>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((f) => {
                  const on = prefs.priorities.includes(f);
                  const full = !on && prefs.priorities.length >= 3;
                  return (
                    <label key={f} className={`choice ${full ? "opacity-50" : ""}`}>
                      <input type="checkbox" checked={on} disabled={full} onChange={() => update("priorities", on ? prefs.priorities.filter((p) => p !== f) : [...prefs.priorities, f])} />
                      {dict.factor[f]}
                    </label>
                  );
                })}
              </div>
              <p id={`${formId}-priorities-hint`} className="small mt-3 text-ink-2" role="status">{prefs.priorities.length === 3 ? t.prioritiesLimit : t.prioritiesCount(prefs.priorities.length)}</p>
            </fieldset>
          </div>
        </details>

        <button type="submit" className="btn w-full sm:w-auto sm:self-start" disabled={busy}>
          {busy ? <LoaderCircle aria-hidden size={19} className="animate-spin" /> : <Compass aria-hidden size={19} />}
          {busy ? t.submitting : t.apply}
        </button>
      </form>


      <div ref={resultsRef} data-state={plan.s} className="planner-results mt-8 min-w-0" aria-live="polite" aria-busy={busy}>
        <p className="small flex flex-wrap items-center gap-x-3 text-ink-2">
          {t.stepOf(step, 4)}
          {context && <span className="text-ink">{context}</span>}
          {step > 1 && <button type="button" className="link min-h-11" onClick={() => goTo((step - 1) as 1 | 2 | 3)}>{t.back}</button>}
        </p>
        <h2 ref={stepRef} tabIndex={-1} className="sub mt-1 outline-none">{stepTitle}</h2>

        {plan.s === "ok" && shareNotice?.nightOutsideCoverage && (
          <p role="status" className="small mt-3 border-s-2 border-clay bg-sand-2 p-3">{t.shareNightOutsideCoverage(formatNight(shareNotice.night, locale))}</p>
        )}
        {plan.s === "ok" && shareNotice?.destinationUnavailable && (
          <p role="status" className="small mt-3 border-s-2 border-clay bg-sand-2 p-3">{t.shareDestinationUnavailable}</p>
        )}
        {plan.s === "ok" && plan.refreshError && <div role="status" className="mt-3"><p className="small mb-2 text-ink-2">{dict.detail.refreshFailed}</p><ErrorState className="!bg-sand-2" code={plan.refreshError} onRetry={() => submit(prefs)} /></div>}

        {/* 1 · Activity: two scenes, not two paragraphs. */}
        {step === 1 && (
          <fieldset className="mt-6">
            <legend className="sr-only">{t.activityTitle}</legend>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {(["kashta", "stars"] as const).map((x) => (
                <label key={x} className="mode-tile" data-mode={x}>
                  <input type="radio" name="plan-activity" value={x} checked={prefs.experience === x} onChange={() => pickMode(x)} onClick={() => prefs.experience === x && goTo(2)} />
                  <span className="mode-tile-art" aria-hidden><NightScene mode={x} tile /></span>
                  <span className="mode-tile-text">
                    <span className="flex items-center gap-2 lead font-medium">
                      {x === "kashta" ? <Flame aria-hidden size={20} /> : <Sparkles aria-hidden size={20} />}
                      {dict.experience[x]}
                    </span>
                    <span className="small muted hidden sm:block">{x === "kashta" ? dict.experience.kashtaDesc : dict.experience.starsDesc}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="small mt-3 text-ink-2">{dict.home.illustration}</p>
            {helper}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" className="btn plan-go" onClick={() => goTo(2)}>{t.toNight}</button>
              {data && pickForNight && <button type="button" className="btn-quiet" onClick={() => goTo(4)}>{t.takeBest}</button>}
            </div>
          </fieldset>
        )}

        {step > 1 && !data && plan.s !== "error" && (
          <div className="mt-6 grid gap-2" aria-hidden>
            <p className="small flex items-center gap-2 text-olive"><LoaderCircle aria-hidden size={17} className="animate-spin" />{dict.common.loading}</p>
            <Skeleton className="h-44 !rounded-[18px]" />
          </div>
        )}
        {step > 1 && plan.s === "error" && <ErrorState className="mt-6" code={plan.code} onRetry={() => submit(prefs)} />}
        {step > 1 && data && data.considered.length === 0 && (
          <NoneInRange prefs={plan.s === "ok" ? plan.prefs : prefs} currentPrefs={prefs} onAdjustDrive={(maxDriveHours) => {
            const next = { ...prefs, maxDriveHours };
            update("maxDriveHours", maxDriveHours);
            void submit(next);
          }} />
        )}

        {/* 2 · Night: the week as bars; numbers only for the chosen night's pick. */}
        {step === 2 && data && data.considered.length > 0 && (
          <div className="mt-6">
            <div className="on-night on-dark rounded-[18px] p-4 md:p-6">
              <SevenNights compact nights={perNight} metricsFor={metricsFor} selected={chosenNight} bestNight={bestNight} onSelect={(n) => { setNight(n); setSelected(null); }} />
              {chosenNight && <p className="small mt-4 muted">{formatNight(chosenNight, locale)}</p>}
            </div>
            {/* Same legend as the homepage: what a tall bar and "incomplete" mean. */}
            <ul className="week-legend small mt-3 text-ink-2" data-mode={prefs.experience}>
              <li><span className="week-legend-bar" aria-hidden />{dict.home.weekBars[prefs.experience]}</li>
              <li><span className="week-legend-na !bg-ink/20" aria-hidden />{dict.home.weekIncomplete}</li>
            </ul>
            {!data.airQuality.available && <p className="small mt-3 text-ink-2">{t.airDown}</p>}
            {helper}
            <StepNav onBack={() => goTo(1)} backLabel={t.back} next={chosenNight ? { label: t.toPlace, onClick: () => goTo(3) } : undefined} />
            <details className="faq-item mt-8">
              <summary>{t.matrixToggle}</summary>
              <Matrix data={data} selected={selected} onSelect={(k) => { setSelected(k); setNight(k.split("|")[1]); }} />
            </details>
          </div>
        )}

        {/* 3 · Place: a short set, one reason each; details and map on request. */}
        {step === 3 && data && data.considered.length > 0 && (
          <div className="mt-6">
            {nightRows.length === 0 && <p className="bg-sand-2 p-4">{dict.home.placesNone}</p>}
            {nightRows.length > 0 && (
              <fieldset>
                <legend className="sr-only">{t.placeTitle}</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  {nightRows.slice(0, 4).map((r) => {
                    const d = getDestination(r.slug)!;
                    const rt = rating(r.score);
                    const on = chosenRow?.slug === r.slug;
                    const reason = nightReasons(r, data.metrics[`${r.slug}|${r.date}`], 1);
                    return (
                      <label key={r.slug} className="place-option !items-start">
                        <input type="radio" name="plan-place" value={r.slug} checked={on} onChange={() => setSelected(`${r.slug}|${r.date}`)} />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {d.name[locale]}
                            {pickForNight?.slug === r.slug && <span className="small rounded-full bg-sky px-2 py-0.5 text-[var(--accent)]">{dict.home.bestForNight}</span>}
                          </span>
                          <ReasonList className="small mt-2" reasons={reason} />
                          <span className="small mt-2 flex flex-wrap gap-x-3 text-ink-2">
                            <span title={dict.common.estimateNote}><bdi className="num">{approxHours(estimateDrive(d).hours, locale)}</bdi></span>
                            <span>{dict.permit.short[d.permit.status]}</span>
                          </span>
                        </span>
                        <span className="rating-pill" style={{ ["--rating" as string]: RATING_COLOR[rt] }}>{dict.rating[rt]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {chosenRow && (
              <details className="faq-item mt-5">
                <summary>{dict.home.nightDetails}: {chosenDest?.name[locale]}</summary>
                <div className="on-night grid gap-5 rounded-[14px] p-4 md:grid-cols-2 md:p-5" data-mode={prefs.experience}>
                  {chosenDest && hoursFor(chosenRow) && <NightWindow date={chosenRow.date} lat={chosenDest.lat} lon={chosenDest.lon} hours={hoursFor(chosenRow)!} mode={prefs.experience} />}
                  <ul className="grid content-start gap-2">
                    {modeFacts(prefs.experience, data.metrics[`${chosenRow.slug}|${chosenRow.date}`], locale).map((f) => (
                      <li key={f.label} className="flex justify-between gap-4"><span className="muted">{f.label}</span><bdi className="num font-medium">{f.value}</bdi></li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
            {nightRows.length > 0 && (
              <details className="faq-item">
                <summary>{t.onMap}</summary>
                <div className="pb-5">
                  <CoverageMap compact legend={false} scores={Object.fromEntries(RECOMMENDABLE.map((d) => [d.slug, nightRows.find((r) => r.slug === d.slug)?.score ?? null]))} pick={chosenRow?.slug} mode={prefs.experience} />
                </div>
              </details>
            )}
            {helper}
            <StepNav onBack={() => goTo(2)} backLabel={t.back} next={chosenRow ? { label: t.toPlan, onClick: () => { setSelected(`${chosenRow.slug}|${chosenRow.date}`); goTo(4); } } : undefined} />
          </div>
        )}

        {/* 4 · Plan: the answer, the next action, and the rest folded away. */}
        {step === 4 && data && chosenRow && chosenDest && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12">
            <RecommendationCard
              row={chosenRow}
              metrics={data.metrics[`${chosenRow.slug}|${chosenRow.date}`]}
              experience={prefs.experience}
              kicker={t.planReady}
              hours={hoursFor(chosenRow)}
              actions={
                <>
                  <Link href={`${placeHref(chosenRow)}#checklist-heading`} className="btn btn-accent">
                    {t.openPlan}
                    <ArrowUpLeft aria-hidden size={18} className="direction-arrow" />
                  </Link>
                  <SharePlanButton slug={chosenRow.slug} night={chosenRow.date} prefs={prefs} dark />
                </>
              }
            />
            <div className="min-w-0">
              <details className="faq-item border-t border-ink/15">
                <summary>{t.scoreBreakdown} <span className="num font-normal text-ink-2">({chosenRow.score ?? "—"}/100)</span></summary>
                <div className="pb-5">
                  {chosenRow.assessment === "incomplete" && <p className="mb-4 bg-sand-2 p-3">{t.incompleteNote} {chosenRow.missing.map((m) => dict.factor[m]).join(locale === "ar" ? "، " : ", ")}</p>}
                  <FactorBars factors={chosenRow.factors} dealbreakers={chosenRow.dealbreakers} />
                </div>
              </details>
              {helper}
              <StepNav onBack={() => goTo(3)} backLabel={t.back} />
            </div>
          </div>
        )}
        {step === 4 && data && !chosenRow && data.considered.length > 0 && <p className="mt-6 bg-sand-2 p-4">{dict.home.placesNone}</p>}

        {data && (
          <p className="small mt-10 text-ink-2">
            {data.forecastFetchedAt ? <>{dict.common.forecastBy} · {dict.common.updated} <time className="num" dateTime={data.forecastFetchedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(data.forecastFetchedAt))}</time></> : t.resultsTimestampMissing}
            {plan.s === "ok" && !resultSettingsMatch && <> · {t.resultsUsePreviousSettings}</>}
          </p>
        )}
      </div>
    </div>
  );
}

function AppliedTag({ on, label }: { on: boolean; label: string }) {
  return on ? <span className="small ms-2 bg-clay px-1.5 py-0.5 text-clay-ink">{label}</span> : null;
}

function StepNav({ onBack, backLabel, next }: { onBack?: () => void; backLabel?: string; next?: { label: string; onClick: () => void } }) {
  const { locale } = useI18n();
  // Forward points along the reading direction: left in Arabic, right in English.
  const Forward = locale === "ar" ? ChevronLeft : ChevronRight;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {next && (
        <button type="button" className="btn plan-go" onClick={next.onClick}>
          {next.label}
          <Forward aria-hidden size={18} />
        </button>
      )}
      {onBack && <button type="button" className="btn-quiet" onClick={onBack}>{backLabel}</button>}
    </div>
  );
}

/** Two facts that matter most for the activity, from the forecast summary only. */
function modeFacts(mode: Experience, m: NightSummary | undefined, locale: "ar" | "en") {
  const ar = locale === "ar";
  if (!m) return [];
  return mode === "stars"
    ? [
        { label: ar ? "غيم" : "Cloud", value: m.meanCloud === null ? "—" : ltr(`${Math.round(m.meanCloud)}%`) },
        { label: ar ? "ظلام بلا قمر" : "Moonless", value: ar ? arHoursOf(m.moonFreeDarkHours, m.darkHours) : `${Math.round(m.moonFreeDarkHours)} of ${Math.round(m.darkHours)} h` },
        { label: ar ? "القمر" : "Moon", value: ltr(`${Math.round(m.moonIllumination * 100)}%`) },
      ]
    : [
        { label: ar ? "أقوى هبة" : "Gust", value: m.maxGust === null ? "—" : `${Math.round(m.maxGust)} ${ar ? "كم/س" : "km/h"}` },
        { label: ar ? "أول الليل" : "Evening", value: m.eveningTemp === null ? "—" : ltr(`${Math.round(m.eveningTemp)}°`) },
        { label: ar ? "أبرد إحساس" : "Coldest feel", value: m.minFeels === null ? "—" : ltr(`${Math.round(m.minFeels)}°`) },
      ];
}

function NoneInRange({ prefs, currentPrefs, onAdjustDrive }: { prefs: PlanPrefs; currentPrefs: PlanPrefs; onAdjustDrive: (hours: number) => void }) {
  const { dict } = useI18n();
  const t = dict.plan;
  // Smallest half-hour step (within the slider's 1.5–5 h) that reaches at least one recommendable place.
  const reachable = RECOMMENDABLE.filter((d) => d.experiences.includes(prefs.experience)).map((d) => estimateDrive(d).hours);
  const nearestRaw = reachable.length ? Math.ceil(Math.min(...reachable) * 2) / 2 : null;
  const nearestHours = nearestRaw !== null && nearestRaw > prefs.maxDriveHours && nearestRaw <= 5 ? Math.max(1.5, nearestRaw) : null;
  return (
    <div className="mt-6 bg-sand-2 p-6" role="status">
      <p className="lead">{t.noneInRange}</p>
      {samePlanPrefs(prefs, currentPrefs) && nearestHours !== null && (
        <button type="button" className="btn mt-5" onClick={() => onAdjustDrive(nearestHours)}>{t.widenDrive(nearestHours)}</button>
      )}
    </div>
  );
}

function SharePlanButton({ slug, night, prefs, dark = false }: { slug: string; night: string; prefs: PlanPrefs; dark?: boolean }) {
  const { dict } = useI18n();
  const [status, setStatus] = useState<"idle" | "copied" | "manual" | "invalid">("idle");
  const [url, setUrl] = useState("");

  const copyLink = async () => {
    const link = buildPlanShareUrl(window.location.origin, slug, night, prefs);
    if (!link) {
      setStatus("invalid");
      return;
    }
    setUrl(link);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  };

  return (
    <>
      <button type="button" className={dark ? "btn-ghost-night" : "btn-quiet min-h-11"} onClick={copyLink}>
        {dict.plan.shareLink}
      </button>
      {status === "copied" && <p role="status" className={`small ${dark ? "muted" : "text-olive"}`}>{dict.plan.shareCopied}</p>}
      {status === "manual" && (
        <div className="w-full basis-full">
          <p className={`small mb-2 ${dark ? "muted" : "text-ink-2"}`}>{dict.plan.shareManual}</p>
          <input
            aria-label={dict.plan.shareManual}
            className="field min-w-0 w-full text-start"
            type="text"
            dir="ltr"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
      {status === "invalid" && <p role="alert" className="small" style={{ color: dark ? "#f2b8a4" : "var(--color-poor)" }}>{dict.plan.shareInvalid}</p>}
    </>
  );
}

function Matrix({ data, selected, onSelect }: { data: PlanResponse; selected: string | null; onSelect: (k: string) => void }) {
  const { locale, dict } = useI18n();
  const byKey = new Map(data.results.map((r) => [`${r.slug}|${r.date}`, r] as const));
  const sites = [...data.considered].sort((a, b) => {
    const best = (s: string) => Math.max(...data.nights.map((n) => byKey.get(`${s}|${n}`)?.score ?? -1));
    return best(b) - best(a);
  });
  const cell = (r: ScoreRow | undefined) => {
    if (!r || r.score === null) return { bg: "transparent", fg: "var(--color-ink-2)" };
    const rt = rating(r.score);
    if (rt === "excellent") return { bg: "var(--color-ink)", fg: "var(--color-sand)" };
    if (rt === "good") return { bg: "var(--color-sand-3)", fg: "var(--color-ink)" };
    return { bg: "transparent", fg: "var(--color-ink-2)" };
  };
  return (
    <section className="pb-6" aria-labelledby="matrix-heading">
      <h3 id="matrix-heading" className="sr-only">
        {dict.plan.matrixTitle}
      </h3>
      <p className="small text-ink-2">{dict.plan.matrixCaption}</p>
      {data.results.some((r) => r.dealbreakers.length > 0) && (
        <p className="small mt-1 text-ink-2">{dict.plan.matrixCapLegend}</p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="num w-full min-w-[40rem] border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              <th className="sr-only">{dict.nav.destinations}</th>
              {data.nights.map((n, i) => (
                <th key={n} scope="col" className="small px-1 font-normal text-ink-2">
                  {i === 0 ? dict.common.tonight : formatWeekday(n, locale)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => {
              const d = getDestination(s)!;
              return (
                <tr key={s}>
                  <th scope="row" className="small max-w-[12rem] truncate pe-3 text-start font-normal">
                    {d.name[locale]}
                  </th>
                  {data.nights.map((n) => {
                    const r = byKey.get(`${s}|${n}`);
                    const c = cell(r);
                    const key = `${s}|${n}`;
                    const isSelected = key === selected;
                    const capped = !!r?.dealbreakers.length;
                    return (
                      <td key={n} className="p-0">
                        <button
                          type="button"
                          onClick={() => r && onSelect(key)}
                          disabled={!r}
                          aria-pressed={isSelected}
                          aria-label={`${d.name[locale]} ${formatNight(n, locale)}: ${r?.score ?? dict.rating.unknown}${capped ? `, ${dict.plan.matrixCapped}` : ""}`}
                          className="night-matrix-choice small h-10 w-full transition-opacity hover:opacity-80"
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {r?.score ?? "·"}{capped && <sup aria-hidden="true">†</sup>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
