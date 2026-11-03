"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpLeft, Compass, LoaderCircle, Minus, Plus, Wand2 } from "lucide-react";
import { rememberPlanForecasts } from "@/lib/forecast-storage";
import { incompleteForecastDates, recommendationHighlights } from "@/lib/recommendation-summary";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { getDestination, estimateDrive } from "@/lib/destinations";
import { formatDayMonth, formatNight, formatWeekday } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/prefs-storage";
import type { InterpretedPrefs } from "@/lib/schemas";
import { rating } from "@/lib/score";
import { upcomingNights } from "@/lib/nights";
import { buildPlanShareUrl, type SharedPlan } from "@/lib/share-link";
import type { Factor, PlanPrefs } from "@/lib/types";
import { ExplainPanel, useAiStatus } from "./explain-panel";
import { useI18n } from "./locale-provider";
import { CoverageNotice, ErrorState, FactorBars, RATING_COLOR, ScoreFigure, Skeleton } from "./ui";

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

export function Planner({ initialText = "", initialExperience, initialShare }: {
  initialText?: string;
  initialExperience?: "kashta" | "stars";
  initialShare?: SharedPlan;
}) {
  const { locale, dict } = useI18n();
  const t = dict.plan;
  const ai = useAiStatus();
  const nights = upcomingNights();
  const formId = useId();

  const [prefs, setPrefs] = useState<PlanPrefs>(initialShare?.prefs ?? DEFAULT_PREFS);
  const [text, setText] = useState(initialText);
  const [applied, setApplied] = useState<Set<Field>>(new Set());
  const [understood, setUnderstood] = useState<{ prefs: InterpretedPrefs; unclear?: string[] | null; unsupported?: string[] } | null>(null);
  const [interpret, setInterpret] = useState<{ s: "idle" | "loading" } | { s: "error"; code: ClientErrorCode }>({ s: "idle" });
  const [groupInput, setGroupInput] = useState(String(initialShare?.prefs.groupSize ?? DEFAULT_PREFS.groupSize));
  const [groupError, setGroupError] = useState(false);
  const [plan, setPlan] = useState<
    { s: "idle" } | { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse; prefs: PlanPrefs; refreshing?: boolean; refreshError?: ClientErrorCode }
  >(initialShare ? { s: "loading" } : { s: "idle" });
  const [selected, setSelected] = useState<string | null>(null);
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
      next.maxDriveHours = Math.min(5, Math.max(1, Math.round(got.maxDriveHours * 2) / 2));
      changed.add("maxDriveHours");
    }
    if (got.date) {
      next.date = got.date;
      changed.add("date");
    }
    if (got.priorities?.length) {
      next.priorities = got.priorities.slice(0, 3);
      changed.add("priorities");
    }
    setPrefs(next);
    savePrefs(next);
    setGroupInput(String(next.groupSize));
    setApplied(changed);
    setUnderstood({ prefs: got, unclear: got.unclear, unsupported: res.data.unsupported });
    setInterpret({ s: "idle" });
  };

  const interpretedSummary = (got: InterpretedPrefs) => {
    const parts: string[] = [];
    if (got.experience) parts.push(t.experienceLabel + ": " + dict.experience[got.experience]);
    if (got.groupSize) parts.push(t.groupLabel + ": " + got.groupSize);
    if (got.date) parts.push(t.dateLabel + ": " + (got.date === "flexible" ? t.flexible : formatNight(got.date, locale)));
    if (got.maxDriveHours) {
      const driveHours = Math.min(5, Math.max(1, Math.round(got.maxDriveHours * 2) / 2));
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
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }));
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
          const first = res.data.results.find((r) => r.score !== null) ?? res.data.results[0];
          setSelected(first ? `${first.slug}|${first.date}` : null);
          setShareNotice(null);
        }
      } else setPlan(previous => previous.s === "ok" ? { ...previous, refreshing: false, refreshError: res.code } : { s: "error", code: res.code });
  }, [setPlan, setSelected, setShareNotice]);

  useEffect(() => {
    const stored = loadPrefs();
    if (initialShare) {
      const key = JSON.stringify([initialShare.slug, initialShare.night, initialShare.prefs]);
      const currentNights = upcomingNights();
      const restoredPrefs = {
        ...initialShare.prefs,
        date: currentNights.includes(initialShare.night) ? initialShare.night : "flexible",
      };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrefs(restoredPrefs);
      setGroupInput(String(restoredPrefs.groupSize));
      if (startedShareRef.current !== key) {
        startedShareRef.current = key;
        savePrefs(restoredPrefs);
        void submit(restoredPrefs, initialShare);
      }
      return;
    }

    const restoredPrefs = initialExperience ? { ...stored, experience: initialExperience } : stored;
    setPrefs(restoredPrefs);
    setGroupInput(String(restoredPrefs.groupSize));
  }, [initialExperience, initialShare, submit]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(groupInput);
    if (!Number.isInteger(n) || n < 1 || n > 40) {
      setGroupError(true);
      document.getElementById(`${formId}-group`)?.focus();
      return;
    }
    setGroupError(false);
    const p = { ...prefs, groupSize: n };
    setPrefs(p);
    savePrefs(p);
    void submit(p);
  };

  const resultSettingsMatch = plan.s === "ok" && samePlanPrefs(plan.prefs, prefs);

  const legend = "mb-3 font-medium";

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
      <form onSubmit={onSubmit} noValidate className="planner-form flex min-w-0 flex-col gap-7" aria-label={t.title}>
        {/* Natural-language description, read by Llama. */}
        <div>
          <label htmlFor={`${formId}-text`} className={`${legend} block`}>
            {t.describeLabel}
          </label>
          <textarea
            id={`${formId}-text`}
            className="field min-h-32 resize-y"
            value={text}
            maxLength={600}
            placeholder={t.describePlaceholder}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={interpret.s === "error" && interpret.code === "invalid_input"}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-quiet"
              onClick={runInterpret}
              disabled={ai !== true || interpret.s === "loading"}
            >
              {interpret.s === "loading" ? <LoaderCircle aria-hidden size={18} className="animate-spin" /> : <Wand2 aria-hidden size={18} />}
              {interpret.s === "loading" ? t.describing : t.describeButton}
            </button>
            <span className="small num text-ink-2">{text.length}/600</span>
          </div>
          {ai === false && <p className="small mt-3 text-ink-2">{dict.errors.ai_not_configured}</p>}
          <div aria-live="polite">
            {interpret.s === "error" && <ErrorState className="mt-4" code={interpret.code} />}
            {understood && (
              <div className="mt-4 bg-sand-2 p-4">
                <p className="small font-medium">{t.understood}</p>
                <p className="mt-1">{interpretedSummary(understood.prefs)}</p>
                {understood.unsupported?.includes("moon_viewing") && <p role="status" className="small mt-2 text-ink-2">{t.moonViewingUnsupported}</p>}
                {!!understood.unclear?.length && (
                  <p className="small mt-2 text-ink-2">
                    {t.unclear} {understood.unclear.join("، ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <fieldset>
          <legend className={legend}>
            {t.experienceLabel}
            <AppliedTag on={applied.has("experience")} label={t.applied} />
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["kashta", "stars"] as const).map((x) => (
              <label key={x} className="choice flex-col !items-start gap-1 !py-4">
                <input type="radio" name="experience" checked={prefs.experience === x} onChange={() => update("experience", x)} />
                <span className="font-medium">{dict.experience[x]}</span>
                <span className="small opacity-80">{x === "kashta" ? dict.experience.kashtaDesc : dict.experience.starsDesc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className={legend} id={`${formId}-city`}>
              {t.cityLabel}
            </p>
            <p aria-labelledby={`${formId}-city`} className="flex min-h-11 items-center bg-sand-2 px-4">
              {t.city}
            </p>
            <p className="small mt-1 text-ink-2">{t.cityNote}</p>
          </div>
          <div>
            <label htmlFor={`${formId}-group`} className={`${legend} block`}>
              {t.groupLabel}
              <AppliedTag on={applied.has("groupSize")} label={t.applied} />
            </label>
            <div className="flex items-stretch">
              <button
                type="button"
                className="btn-quiet !px-3"
                aria-label="-1"
                onClick={() => {
                  const n = Math.max(1, (Number(groupInput) || 1) - 1);
                  setGroupInput(String(n));
                  update("groupSize", n);
                }}
              >
                <Minus aria-hidden size={18} />
              </button>
              <input
                id={`${formId}-group`}
                className="field num !w-full text-center"
                inputMode="numeric"
                value={groupInput}
                aria-invalid={groupError}
                aria-describedby={groupError ? `${formId}-group-err` : undefined}
                onChange={(e) => {
                  setGroupInput(e.target.value.replace(/[^\d٠-٩]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
                  setGroupError(false);
                }}
                onBlur={() => {
                  const n = Number(groupInput);
                  if (Number.isInteger(n) && n >= 1 && n <= 40) update("groupSize", n);
                }}
              />
              <button
                type="button"
                className="btn-quiet !px-3"
                aria-label="+1"
                onClick={() => {
                  const n = Math.min(40, (Number(groupInput) || 0) + 1);
                  setGroupInput(String(n));
                  update("groupSize", n);
                }}
              >
                <Plus aria-hidden size={18} />
              </button>
            </div>
            {groupError && (
              <p id={`${formId}-group-err`} role="alert" className="small mt-2 text-poor">
                {t.validationGroup}
              </p>
            )}
          </div>
        </div>

        <fieldset>
          <legend className={legend}>
            {t.dateLabel}
            <AppliedTag on={applied.has("date")} label={t.applied} />
          </legend>
          <div className="flex flex-wrap gap-2">
            <label className="choice">
              <input type="radio" name="date" checked={prefs.date === "flexible"} onChange={() => update("date", "flexible")} />
              {t.flexible}
            </label>
            {nights.map((n, i) => (
              <label key={n} className="choice">
                <input type="radio" name="date" checked={prefs.date === n} onChange={() => update("date", n)} />
                <span>
                  {i === 0 ? dict.common.tonight : formatWeekday(n, locale)}{" "}
                  <span className="small num opacity-75">{formatDayMonth(n, locale)}</span>
                </span>
              </label>
            ))}
          </div>
          {plan.s === "ok" ? <CoverageNotice nights={incompleteForecastDates(plan.data.forecasts, prefs)} /> : <p className="small mt-3 text-ink-2">{t.coverageHint}</p>}
        </fieldset>

        <div>
          <label htmlFor={`${formId}-drive`} className={`${legend} flex justify-between`}>
            <span>
              {t.driveLabel}
              <AppliedTag on={applied.has("maxDriveHours")} label={t.applied} />
            </span>
            <span className="num">{t.driveValue(prefs.maxDriveHours)}</span>
          </label>
          <input
            id={`${formId}-drive`}
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={prefs.maxDriveHours}
            onChange={(e) => update("maxDriveHours", Number(e.target.value))}
            className="h-11 w-full accent-[var(--color-clay)]"
          />
          <p className="small text-ink-2">{dict.common.driveEstimate}</p>
        </div>

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
          <div className="grid grid-cols-3 gap-2">
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
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={full}
                    onChange={() =>
                      update("priorities", on ? prefs.priorities.filter((p) => p !== f) : [...prefs.priorities, f])
                    }
                  />
                  {dict.factor[f]}
                </label>
              );
            })}
          </div>
          <p id={`${formId}-priorities-hint`} className="small mt-3 text-ink-2" role="status">{prefs.priorities.length === 3 ? t.prioritiesLimit : t.prioritiesCount(prefs.priorities.length)}</p>
        </fieldset>

        <button type="submit" className="btn w-full" disabled={plan.s === "loading" || (plan.s === "ok" && !!plan.refreshing)}>
          {plan.s === "loading" || (plan.s === "ok" && plan.refreshing) ? <LoaderCircle aria-hidden size={19} className="animate-spin" /> : <Compass aria-hidden size={19} />}
          {plan.s === "loading" || (plan.s === "ok" && plan.refreshing) ? t.submitting : t.submit}
        </button>
      </form>

      <div ref={resultsRef} data-state={plan.s} className="planner-results min-w-0 scroll-mt-28" aria-live="polite" aria-busy={plan.s === "loading" || (plan.s === "ok" && !!plan.refreshing)}>
        {plan.s === "idle" && (
          <div className="planner-empty-state mt-6 flex min-h-44 flex-col justify-center border-s-2 border-olive bg-sand-2 p-6 md:p-8" role="status">
            <Compass aria-hidden size={24} className="text-olive" />
            <p className="lead mt-3">{t.emptyTitle}</p>
            <p className="mt-2 max-w-[40ch] text-ink-2">{t.emptyBody}</p>
          </div>
        )}
        {plan.s !== "idle" && <h2 className="planner-step sub"><span className="num" aria-hidden>02</span>{t.resultsTitle}</h2>}
        {plan.s === "loading" && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="small flex items-center gap-2 pb-3 text-olive"><LoaderCircle aria-hidden size={17} className="animate-spin" />{dict.common.loading}</p>
            <Skeleton className="h-40" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {plan.s === "error" && <ErrorState className="mt-6" code={plan.code} onRetry={() => submit(prefs)} />}
        {plan.s === "ok" && (
          <div className="small mt-4 flex flex-wrap items-center justify-between gap-3 text-ink-2" aria-live="polite">
            <p>{plan.data.forecastFetchedAt ? <>{dict.common.updated} <time dateTime={plan.data.forecastFetchedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(plan.data.forecastFetchedAt))}</time></> : t.resultsTimestampMissing}</p>
            <p role="status">{resultSettingsMatch ? t.resultsMatchSettings : t.resultsUsePreviousSettings}</p>
            {plan.refreshing && <p>{dict.detail.refreshing}</p>}
          </div>
        )}
        {plan.s === "ok" && plan.refreshError && <div role="status" className="mt-3"><p className="small mb-2 text-ink-2">{dict.detail.refreshFailed}</p><ErrorState className="!bg-sand-2" code={plan.refreshError} onRetry={() => submit(prefs)} /></div>}
        {plan.s === "ok" && shareNotice?.nightOutsideCoverage && (
          <p role="status" className="small mt-3 border-s-2 border-clay bg-sand-2 p-3">
            {t.shareNightOutsideCoverage(formatNight(shareNotice.night, locale))}
          </p>
        )}
        {plan.s === "ok" && shareNotice?.destinationUnavailable && (
          <p role="status" className="small mt-3 border-s-2 border-clay bg-sand-2 p-3">{t.shareDestinationUnavailable}</p>
        )}
        {plan.s === "ok" && (
          <Results
            data={plan.data}
            prefs={plan.prefs}
            currentPrefs={prefs}
            selected={selected}
            onSelect={setSelected}
            onAdjustDrive={(maxDriveHours) => {
              const next = { ...plan.prefs, maxDriveHours };
              update("maxDriveHours", maxDriveHours);
              void submit(next);
            }}
          />
        )}
      </div>
    </div>
  );
}

function AppliedTag({ on, label }: { on: boolean; label: string }) {
  return on ? <span className="small ms-2 bg-clay px-1.5 py-0.5 text-clay-ink">{label}</span> : null;
}

function BestPick({ row, prefs }: { row: ScoreRow; prefs: PlanPrefs }) {
  const { locale, dict } = useI18n();
  const destination = getDestination(row.slug)!;
  const { strongest, tradeoff } = recommendationHighlights(row.factors);
  return (
    <section className="best-pick mt-6 rounded-md border border-olive/30 bg-sand-2 p-5" aria-label={dict.plan.bestSummary}>
      <p className="small font-medium text-olive">{row.score === null ? dict.plan.availableComparison : dict.plan.bestSummary}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div><h3 className="lead font-medium">{destination.name[locale]}</h3><p className="small mt-1 text-ink-2">{formatNight(row.date, locale)}</p></div>
        <ScoreFigure score={row.score} size="sm" />
      </div>
      {row.score === null ? <p className="mt-4">{dict.plan.incompleteNote} {row.missing.map(factor => dict.factor[factor]).join("، ")}</p> : <>
        {strongest && <p className="mt-4">{dict.plan.summaryFactor} {dict.factor[strongest.factor]}: <bdi className="num">{strongest.value}</bdi>.</p>}
        <p className="small mt-2 text-ink-2">{dict.plan.summaryTradeoff} {tradeoff ? <>{dict.factor[tradeoff.factor]}: <bdi className="num">{tradeoff.value}</bdi> ({tradeoff.score}/100).</> : dict.plan.summaryDrive(estimateDrive(destination).hours)}</p>
      </>}
      {row.dealbreakers.length > 0 && <p className="small mt-3 text-poor">{dict.plan.dealbreaker}: {row.dealbreakers.map(factor => dict.factor[factor]).join("، ")}</p>}
      <Link href={`/destinations/${row.slug}?night=${row.date}&exp=${prefs.experience}`} className="link mt-4 inline-flex min-h-11 items-center font-medium">{dict.common.viewDestination}</Link>
    </section>
  );
}

function Results({
  data,
  prefs,
  currentPrefs,
  selected,
  onSelect,
  onAdjustDrive,
}: {
  data: PlanResponse;
  prefs: PlanPrefs;
  currentPrefs: PlanPrefs;
  selected: string | null;
  onSelect: (k: string) => void;
  onAdjustDrive: (hours: number) => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.plan;
  const prefsMatch = samePlanPrefs(prefs, currentPrefs);

  if (data.considered.length === 0) {
    return (
      <div className="mt-6 bg-sand-2 p-6">
        <p className="lead">{t.noneInRange}</p>
        {prefsMatch && prefs.maxDriveHours <= 1 && <p className="small mt-2 text-ink-2">{t.closerMinimum}</p>}
      </div>
    );
  }

  const nightsShown = prefs.date === "flexible" ? data.nights : [prefs.date];
  const top = data.results.slice(0, 6);
  const sel = data.results.find((r) => `${r.slug}|${r.date}` === selected) ?? top[0];
  const selMetrics = sel ? data.metrics[`${sel.slug}|${sel.date}`] : undefined;
  const selDest = sel ? getDestination(sel.slug) : undefined;

  return (
    <div className="results-enter mt-4">
      <p className="text-ink-2">
        {t.resultsLead(data.considered.length, nightsShown.length)}{" "}
        {data.excludedByDistance.length > 0 && t.excluded(data.excludedByDistance.length)}
      </p>
      {!data.airQuality.available && <p className="mt-2 bg-sand-2 p-3">{t.airDown}</p>}
      <CoverageNotice nights={incompleteForecastDates(data.forecasts, prefs)} />
      {top[0] && <BestPick row={top[0]} prefs={prefs} />}
      {prefsMatch ? (
        <CloserOption data={data} prefs={prefs} onConfirm={onAdjustDrive} />
      ) : (
        <p className="small mt-4 text-ink-2">{t.closerNeedsPlan}</p>
      )}

      <h3 className="mt-10 mb-3 font-medium">{t.topPicks}</h3>
      <ol role="list" className="recommendation-list">
        {top.map((r, i) => {
          const d = getDestination(r.slug)!;
          const k = `${r.slug}|${r.date}`;
          const on = sel && k === `${sel.slug}|${sel.date}`;
          const rt = rating(r.score);
          return (
            <li key={k}>
              <button
                type="button"
                aria-pressed={!!on}
                onClick={() => onSelect(k)}
                className={`recommendation-choice grid min-h-16 w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-start transition-colors ${
                  on ? "bg-olive text-sand" : "hover:bg-sand-2"
                }`}
              >
                <span className="num opacity-70">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.name[locale]}</span>
                  <span className={`small block ${on ? "opacity-80" : "text-ink-2"}`}>
                    {formatNight(r.date, locale, { short: true })} · ~{estimateDrive(d).hours} {dict.common.hours}
                  </span>
                </span>
                <span className="text-end">
                  <span className="num block lead font-light leading-none">{r.score ?? "—"}</span>
                  <span className="small block font-medium" style={on ? undefined : { color: RATING_COLOR[rt] }}>
                    {dict.rating[rt]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {sel && selDest && (
        <section key={`${sel.slug}|${sel.date}`} className="recommendation-detail results-enter mt-8 bg-sand-2 p-5 md:p-8" aria-labelledby="sel-heading">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <h3 id="sel-heading" className="sub">
                {selDest.name[locale]}
              </h3>
              <p className="text-ink-2">{formatNight(sel.date, locale)}</p>
            </div>
            <ScoreFigure score={sel.score} size="md" />
          </div>
          {sel.assessment === "incomplete" && (
            <p className="mt-4 bg-sand p-3">
              {t.incompleteNote} {sel.missing.map((m) => dict.factor[m]).join("، ")}
            </p>
          )}
          {sel.dealbreakers.length > 0 && <p className="small mt-4 text-poor">{t.dealbreakerNote}</p>}
          <h4 className="mt-8 mb-4 font-medium">{t.breakdown}</h4>
          <FactorBars factors={sel.factors} dealbreakers={sel.dealbreakers} />
          {selMetrics?.sunset && (
            <p className="small mt-6 text-ink-2">
              {dict.detail.sunset} <span className="num" dir="ltr">{selMetrics.sunset}</span> · {dict.detail.dusk}{" "}
              <span className="num" dir="ltr">{selMetrics.duskAstro}</span> · {dict.detail.moon}{" "}
              {dict.detail.moonLit(Math.round(selMetrics.moonIllumination * 100))}
            </p>
          )}
          <div className="mt-8">
            {prefsMatch
              ? <ExplainPanel slug={sel.slug} date={sel.date} prefs={prefs} forecastKey={JSON.stringify([data.forecastFetchedAt, selMetrics])} />
              : <p className="small text-ink-2">{t.explainNeedsPlan}</p>}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={`/destinations/${sel.slug}?night=${sel.date}&exp=${prefs.experience}`}
              className="btn inline-flex min-h-11 items-center font-medium"
            >
              {t.openChecklist}
              <ArrowUpLeft aria-hidden size={18} className="direction-arrow" />
            </Link>
            <SharePlanButton slug={sel.slug} night={sel.date} prefs={prefs} />
          </div>
        </section>
      )}

      {prefs.date === "flexible" && <Matrix data={data} onSelect={onSelect} />}
    </div>
  );
}

function CloserOption({
  data,
  prefs,
  onConfirm,
}: {
  data: PlanResponse;
  prefs: PlanPrefs;
  onConfirm: (hours: number) => void;
}) {
  const { dict } = useI18n();
  const t = dict.plan;
  const [open, setOpen] = useState(false);
  const proposedHours = Math.max(1, Math.round((prefs.maxDriveHours - 1) * 2) / 2);
  const hasCloserDestinations = data.considered.some((slug) => {
    const destination = getDestination(slug);
    return destination && estimateDrive(destination).hours <= proposedHours;
  });
  const minimumReached = prefs.maxDriveHours <= 1;
  const panelId = useId();

  return (
    <section className="mt-4">
      <button
        type="button"
        className="btn-quiet disabled:opacity-50"
        disabled={minimumReached}
        aria-expanded={!minimumReached && open}
        aria-controls={!minimumReached ? panelId : undefined}
        onClick={() => setOpen((shown) => !shown)}
      >
        {t.closerAction}
      </button>
      {minimumReached && <p className="small mt-2 text-ink-2">{t.closerMinimum}</p>}
      {!minimumReached && open && (
        <div id={panelId} className="mt-3 border border-olive/20 bg-sand-2 p-4" aria-live="polite">
          <p>{t.closerPrompt(prefs.maxDriveHours, proposedHours)}</p>
          {!hasCloserDestinations && <p className="small mt-2 text-ink-2">{t.closerNone(proposedHours)}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {hasCloserDestinations && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setOpen(false);
                  onConfirm(proposedHours);
                }}
              >
                {t.closerConfirm}
              </button>
            )}
            <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>
              {t.closerCancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SharePlanButton({ slug, night, prefs }: { slug: string; night: string; prefs: PlanPrefs }) {
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
      <button type="button" className="btn-quiet min-h-11" onClick={copyLink}>
        {dict.plan.shareLink}
      </button>
      {status === "copied" && <p role="status" className="small text-olive">{dict.plan.shareCopied}</p>}
      {status === "manual" && (
        <div className="w-full basis-full">
          <p className="small mb-2 text-ink-2">{dict.plan.shareManual}</p>
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
      {status === "invalid" && <p role="alert" className="small text-poor">{dict.plan.shareInvalid}</p>}
    </>
  );
}

function Matrix({ data, onSelect }: { data: PlanResponse; onSelect: (k: string) => void }) {
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
    <section className="mt-14" aria-labelledby="matrix-heading">
      <h3 id="matrix-heading" className="font-medium">
        {dict.plan.matrixTitle}
      </h3>
      <p className="small mt-1 text-ink-2">{dict.plan.matrixCaption}</p>
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
                    return (
                      <td key={n} className="p-0">
                        <button
                          type="button"
                          onClick={() => r && onSelect(`${s}|${n}`)}
                          disabled={!r}
                          aria-label={`${d.name[locale]} ${formatNight(n, locale)}: ${r?.score ?? dict.rating.unknown}`}
                          className="small h-10 w-full transition-opacity hover:opacity-80"
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {r?.score ?? "·"}
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
