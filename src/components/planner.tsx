"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpLeft, ChevronDown, ChevronLeft, ChevronRight, Compass, Flame, LoaderCircle, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { rememberPlanForecasts } from "@/lib/forecast-storage";
import type { NightSummary, PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { DRIVE_MAX_HOURS, DRIVE_MIN_HOURS, RECOMMENDABLE, getDestination, estimateDrive } from "@/lib/destinations";
import { formatNight, formatWeekday, approxHours, arHoursOf, ltr } from "@/lib/i18n";
import { bestPerNight, nightReasons, rankNight } from "@/lib/reasons";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/prefs-storage";
import type { InterpretedPrefs } from "@/lib/schemas";
import { rating } from "@/lib/score";
import { buildPlanShareUrl, type SharedPlan } from "@/lib/share-link";
import type { CityId, Experience, Factor, PlanPrefs } from "@/lib/types";
import { ExplainPanel, useAiStatus } from "./explain-panel";
import { useI18n } from "./locale-provider";
import { CityPicker } from "./city-picker";
import { PlacesMap } from "./places-map";
import { NightScene } from "./night-scene";
import { NightWindow } from "./night-window";
import { PlanRail } from "./plan-rail";
import { RecommendationCard, ReasonList } from "./recommendation-card";
import { SevenNights, WeekLegend } from "./seven-nights";
import { ErrorState, FactorBars, RATING_COLOR, Skeleton } from "./ui";

type Field = keyof PlanPrefs;

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
  const [interpretReply, setInterpretReply] = useState<string | null>(null);
  const [interpret, setInterpret] = useState<{ s: "idle" | "loading" } | { s: "error"; code: ClientErrorCode }>({ s: "idle" });
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [plan, setPlan] = useState<
    { s: "idle" } | { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse; prefs: PlanPrefs; refreshing?: boolean; refreshError?: ClientErrorCode }
  >(initialShare ? { s: "loading" } : { s: "idle" });
  const [selected, setSelected] = useState<string | null>(null);
  const [mapHover, setMapHover] = useState<string | null>(null);
  // The sequence: activity → night → place → plan. Fetching always covers all seven nights.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialShare || (initialNight && initialPlace) ? 4 : initialExperience ? 2 : 1);
  const [night, setNight] = useState<string | null>(initialShare?.night ?? initialNight ?? null);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const [shareNotice, setShareNotice] = useState<{ night: string; nightOutsideCoverage: boolean; nightUnscored: boolean; destinationUnavailable: boolean } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const startedShareRef = useRef<string | null>(null);
  const handedUsed = useRef(false);

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
    setInterpretReply(null);
    setUnderstood(null);
    const res = await callApi<{ prefs?: InterpretedPrefs; unsupported?: string[]; redirect?: string }>("/api/ai/interpret", {
      method: "POST",
      body: JSON.stringify({ text, locale }),
    });
    if (!res.ok) {
      setInterpret({ s: "error", code: res.code });
      return;
    }
    if (res.data.redirect) {
      setUnderstood(null);
      setInterpretReply(res.data.redirect);
      setInterpret({ s: "idle" });
      return;
    }
    const got = res.data.prefs;
    if (!got) {
      setInterpret({ s: "idle" });
      return;
    }
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
    if (got.city) {
      next.city = got.city;
      changed.add("city");
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
      next.maxDriveHours = Math.min(DRIVE_MAX_HOURS, Math.max(DRIVE_MIN_HOURS, Math.round(got.maxDriveHours * 2) / 2));
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
      case "city": return dict.common.cities[prefs.city];
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
    if (got.city) parts.push(t.cityLegend + " " + dict.common.cities[got.city]);
    if (got.groupSize) parts.push(t.groupLabel + ": " + got.groupSize);
    if (got.date) parts.push(t.dateLabel + ": " + (got.date === "flexible" ? t.flexible : formatNight(got.date, locale)));
    if (got.maxDriveHours) {
      const driveHours = Math.min(DRIVE_MAX_HOURS, Math.max(DRIVE_MIN_HOURS, Math.round(got.maxDriveHours * 2) / 2));
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
          // Only a scored night can be the plan; otherwise the same place's best scored night.
          const exactScored = exactRow?.score != null ? exactRow : undefined;
          const sameDestinationRow = destinationRows.filter((row) => row.score !== null).sort((a, b) => b.score! - a.score! || a.date.localeCompare(b.date))[0];
          const first = exactScored ?? sameDestinationRow ?? res.data.results.find((row) => row.score !== null);
          setSelected(first ? `${first.slug}|${first.date}` : null);
          if (first) setNight(first.date);
          setShareNotice({ night: share.night, nightOutsideCoverage, nightUnscored: !!exactRow && !exactScored, destinationUnavailable: destinationRows.length === 0 });
        } else {
          // A place handed over from the homepage stays chosen while it is still ranked.
          // Used once: a later re-rank (Start over, new preferences) must not bring it back.
          const handed = !handedUsed.current && initialPlace && initialNight ? res.data.results.find((row) => row.slug === initialPlace && row.date === initialNight && row.score !== null) : undefined;
          handedUsed.current = true;
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
        // A shared link shows the sender's settings without replacing the visitor's own saved ones.
        void submit(restoredPrefs, initialShare);
      }
      return;
    }

    const restored = { ...(initialExperience ? { ...stored, experience: initialExperience } : stored), date: "flexible" };
    // The drive slider starts at 1.5 h: below that no listed place is reachable.
    const restoredPrefs = { ...restored, maxDriveHours: Math.max(DRIVE_MIN_HOURS, restored.maxDriveHours) };
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
  const perNight = data ? bestPerNight(data, prefs.city) : [];
  const bestNight = perNight.reduce<string | null>((top, n) => {
    if (!n.best) return top;
    const current = perNight.find((x) => x.night === top)?.best?.score ?? -1;
    return (n.best.score ?? -1) > current ? n.night : top;
  }, null);
  // A night only counts while the forecast scores it (an address, share or helper may name another).
  const chosenNight = night && perNight.some((n) => n.night === night && n.best) ? night : bestNight;
  const nightRows: ScoreRow[] = data && chosenNight
    ? rankNight(data, chosenNight, prefs.city)
    : [];
  const pickForNight = perNight.find((n) => n.night === chosenNight)?.best;
  const selectedRow = data?.results.find((r) => `${r.slug}|${r.date}` === selected && r.date === chosenNight);
  const chosenRow = selectedRow ?? pickForNight ?? nightRows[0];
  const chosenDest = chosenRow ? getDestination(chosenRow.slug) : undefined;
  // The short list the cards and the map share: the top four, plus the chosen place if it ranks lower.
  const placeRows = chosenRow && !nightRows.slice(0, 4).some((r) => r.slug === chosenRow.slug) ? [...nightRows.slice(0, 4), chosenRow] : nightRows.slice(0, 4);
  const placeRank = (slug: string) => nightRows.findIndex((r) => r.slug === slug) + 1;
  const metricsFor = (n: string) => {
    if (!data) return undefined;
    const row = perNight.find((x) => x.night === n)?.best ?? data.results.find((r) => r.date === n);
    return row ? data.metrics[`${row.slug}|${n}`] : undefined;
  };
  const hoursFor = (row: ScoreRow) => data?.forecasts[row.slug]?.metrics.find((m) => m.date === row.date)?.hours;
  // The address follows the plan, so reload and Back from a place page reopen these choices, and a
  // used share link or description isn't applied again over later changes.
  useEffect(() => {
    if (!data) return;
    // An opened share link stays in the address until the visitor changes a setting, so a reload
    // shows the sender's trip and not the visitor's own saved preferences.
    if (initialShare && samePlanPrefs({ ...initialShare.prefs, date: "flexible" }, prefs) && (!chosenRow || (chosenRow.slug === initialShare.slug && chosenRow.date === initialShare.night))) return;
    // Edited after opening a share: the address becomes a share link for the edited trip, so a
    // reload keeps the edits instead of falling back to the visitor's saved preferences.
    if (initialShare && chosenRow) {
      const link = buildPlanShareUrl(window.location.origin, chosenRow.slug, chosenRow.date, prefs);
      if (link && link !== window.location.href) window.history.replaceState(window.history.state, "", link);
      if (link) return;
    }
    const url = new URL(window.location.href);
    ["share", "q", "destination", "night", "place", "exp"].forEach((k) => url.searchParams.delete(k));
    [...url.searchParams.keys()].filter((k) => k !== "exp").forEach((k) => url.searchParams.delete(k));
    url.searchParams.set("exp", prefs.experience);
    if (step === 4 && chosenRow) {
      url.searchParams.set("night", chosenRow.date);
      url.searchParams.set("place", chosenRow.slug);
    }
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [data, prefs, step, chosenRow, initialShare]);
  const placeHref = (row: ScoreRow) => `/destinations/${row.slug}?night=${row.date}&exp=${prefs.experience}&city=${prefs.city}`;

  /** "Start over": default preferences (the current activity stays selected), no night, place or
   *  description, back to step 1. Checklist ticks and fetched forecasts are untouched. */
  const startOver = () => {
    const next = { ...DEFAULT_PREFS, experience: prefs.experience };
    setPrefs(next);
    savePrefs(next);
    setNight(null);
    setSelected(null);
    setText("");
    setApplied(new Set());
    setUnderstood(null);
    setShareNotice(null);
    setAdjustOpen(false);
    if (!samePlanPrefs(next, plan.s === "ok" ? plan.prefs : DEFAULT_PREFS)) void submit(next);
    goTo(1);
  };

  const goTo = (next: 1 | 2 | 3 | 4) => {
    setStep(next);
    requestAnimationFrame(() => stepRef.current?.focus());
  };
  /** A new start city changes every drive, so the week is scored again; the night stays if it still can. */
  const changeCity = (city: CityId) => {
    const next = { ...prefs, city };
    setPrefs(next);
    savePrefs(next);
    setSelected(null);
    void submit(next);
  };
  const pickMode = (experience: Experience) => {
    if (experience !== prefs.experience) {
      setSelected(null);
      changeMode(experience);
    }
    goTo(2);
  };

  const STEPS = [
    { n: 1, label: t.steps.activity, value: `${dict.experience[prefs.experience]} · ${dict.common.cities[prefs.city]}` },
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
  // The helper: one visible, optional panel that follows the step. Steps 1–2 read a description
  // into the same settings this page offers; steps 3–4 explain the chosen place and night from the
  // server's own numbers. It never picks a place, changes a score or speaks for permits.
  const h = dict.home.helper;
  const helperId = `${formId}-helper`;
  const explainStep = step >= 3;
  const samples = step === 2 ? h.prompts.night : h.prompts.activity;
  const helper = (
    <aside className="trip-helper mt-6" data-mode={prefs.experience} aria-labelledby={helperId}>
      <div className="flex items-center gap-3">
        <span className="helper-mark" aria-hidden />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold" id={helperId}>{h.name}</span>
            <span className="trip-helper-tag">{h.optional}</span>
          </p>
          <p className="small text-ink-2">{explainStep ? (step === 3 ? h.explainPlace : h.explainPlan) : h.describeWhatFull}</p>
        </div>
      </div>
      {explainStep ? (
        data && chosenRow ? (
          <div className="mt-3">
            {resultSettingsMatch
              ? <ExplainPanel compact label={step === 3 ? h.askPlace : h.askPlan} slug={chosenRow.slug} date={chosenRow.date} prefs={prefs} forecastKey={JSON.stringify([data.forecastFetchedAt, data.metrics[`${chosenRow.slug}|${chosenRow.date}`]])} />
              : <p className="small text-ink-2">{t.explainNeedsPlan}</p>}
            <p className="small mt-3 text-ink-2">{h.limitExplain}</p>
          </div>
        ) : null
      ) : (
        <div className="mt-3">
          <label htmlFor={`${formId}-text`} className="sr-only">{h.label}</label>
          <textarea
            id={`${formId}-text`}
            className="field min-h-[4.5rem] resize-y"
            rows={2}
            value={text}
            maxLength={600}
            placeholder={h.placeholder}
            onChange={(e) => { setText(e.target.value); setInterpretReply(null); setUnderstood(null); }}
            aria-invalid={interpret.s === "error" && interpret.code === "invalid_input"}
          />
          <p className="small mt-2 text-ink-2">{h.try}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {samples.map((sample) => (
              <button key={sample} type="button" className="helper-chip" onClick={() => setText(sample)}>{sample}</button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-quiet" onClick={runInterpret} disabled={ai !== true || interpret.s === "loading" || text.trim().length === 0}>
              {interpret.s === "loading" ? <LoaderCircle aria-hidden size={18} className="animate-spin" /> : <Wand2 aria-hidden size={18} />}
              {interpret.s === "loading" ? t.describing : h.submit}
            </button>
          </div>
          {ai === false && <p className="small mt-3 text-ink-2">{dict.errors.ai_not_configured}</p>}
          <div aria-live="polite">
            {interpret.s === "error" && <ErrorState className="mt-4" code={interpret.code} />}
            {interpretReply && <p role="status" className="small mt-3 rounded-xl bg-sand-2 p-3">{interpretReply}</p>}
            {understood && (
              <div className="small mt-3 rounded-xl bg-sand-2 p-3">
                <p><span className="font-medium">{h.understood}</span> {interpretedSummary(understood.prefs)}</p>
                {applied.size > 0 && (
                  <p className="mt-1">
                    <span className="font-medium">{h.filled}</span>{" "}
                    {[...applied].map((f) => appliedLabel(f)).filter(Boolean).join(locale === "ar" ? "، " : ", ")}
                  </p>
                )}
                {understood.unsupported?.includes("moon_viewing") && <p role="status" className="mt-2 text-ink-2">{t.moonViewingUnsupported}</p>}
                {!!understood.unclear?.length && <p className="mt-2 text-ink-2">{t.unclear} {understood.unclear.join(locale === "ar" ? "، " : ", ")}</p>}
                <button type="button" className="btn-quiet mt-3" onClick={() => { savePrefs(prefs); void submit(prefs); goTo(understood.prefs.date && understood.prefs.date !== "flexible" ? 3 : 2); }}>{t.apply}</button>
              </div>
            )}
          </div>
          <p className="small mt-3 text-ink-2">{h.limitDescribe}</p>
        </div>
      )}
    </aside>
  );

  return (
    <div data-mode={prefs.experience}>
      {/* Where you are, and how to step back. */}
      <PlanRail
          label={t.title}
          step={step}
          onStep={goTo}
          steps={[
            { n: 1, label: t.steps.activity, value: STEPS[0].value, reachable: true },
            { n: 2, label: t.steps.night, value: STEPS[1].value, reachable: true },
            { n: 3, label: t.steps.place, value: STEPS[2].value, reachable: !!data },
            { n: 4, label: t.steps.plan, reachable: !!data && !!chosenRow },
          ]}
        />
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-quiet" aria-expanded={adjustOpen} aria-controls={panelId} onClick={() => setAdjustOpen((v) => !v)}>
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
            min={DRIVE_MIN_HOURS}
            max={DRIVE_MAX_HOURS}
            step={0.5}
            value={prefs.maxDriveHours}
            aria-valuetext={approxHours(prefs.maxDriveHours, locale)}
            onChange={(e) => update("maxDriveHours", Number(e.target.value))}
            className="h-11 w-full accent-[var(--color-clay)]"
          />
          <p className="small text-ink-2">{t.driveFrom(dict.common.cities[prefs.city])}. {dict.common.estimateNote}.</p>
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
        {plan.s === "ok" && shareNotice?.nightUnscored && (
          <p role="status" className="small mt-3 border-s-2 border-clay bg-sand-2 p-3">{t.shareNightUnscored(formatNight(shareNotice.night, locale))}</p>
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
                  </span>
                </label>
              ))}
            </div>
            <CityPicker className="mt-5" tone="sand" value={prefs.city} onChange={changeCity} experience={prefs.experience} maxDriveHours={prefs.maxDriveHours} />
            {/* The main way forward comes first; the helper is optional. */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn plan-go" onClick={() => goTo(2)}>{t.toNight}</button>
              {data && pickForNight && rating(pickForNight.score) !== "poor" && <button type="button" className="btn-quiet" onClick={() => goTo(4)}>{t.takeBest}</button>}
            </div>
            {helper}
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
              <SevenNights compact nights={perNight} metricsFor={metricsFor} selected={chosenNight} bestNight={bestNight && rating(perNight.find((n) => n.night === bestNight)?.best?.score ?? null) !== "poor" ? bestNight : null} onSelect={(n) => { setNight(n); setSelected(null); }} />
              {chosenNight && <p className="small mt-4 muted">{formatNight(chosenNight, locale)}</p>}
            </div>
            {/* Same legend as the homepage: what a tall bar and "incomplete" mean. */}
            <WeekLegend className="mt-3 text-ink-2" nights={perNight} mode={prefs.experience} />
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
                  {placeRows.map((r) => {
                    const d = getDestination(r.slug)!;
                    const rt = rating(r.score);
                    const on = chosenRow?.slug === r.slug;
                    const reason = nightReasons(r, data.metrics[`${r.slug}|${r.date}`], 1);
                    return (
                      <label key={r.slug} className="place-option !items-start">
                        <input type="radio" name="plan-place" value={r.slug} checked={on} onChange={() => setSelected(`${r.slug}|${r.date}`)} />
                        <span className="place-num num" aria-hidden data-rating={rt}>{placeRank(r.slug)}</span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {d.name[locale]}
                            {pickForNight?.slug === r.slug && <span className="small rounded-full bg-sky px-2 py-0.5 text-[var(--accent)]">{dict.home.bestForNight}</span>}
                          </span>
                          <ReasonList className="small mt-2" reasons={reason} />
                          <span className="small mt-2 flex flex-wrap gap-x-3 text-ink-2">
                            <span title={dict.common.estimateNote}><bdi className="num">{approxHours(estimateDrive(d, prefs.city).hours, locale)}</bdi></span>
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
                  <PlacesMap
                    city={prefs.city}
                    mode={prefs.experience}
                    scores={Object.fromEntries(nightRows.map((r) => [r.slug, r.score]))}
                    numbered={placeRows.map((r) => r.slug)}
                    ranks={Object.fromEntries(placeRows.map((r) => [r.slug, placeRank(r.slug)]))}
                    selected={chosenRow?.slug ?? null}
                    hovered={mapHover}
                    onSelect={(slug) => chosenNight && setSelected(`${slug}|${chosenNight}`)}
                    onHover={setMapHover}
                    label={t.onMap}
                  />
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
              kicker={dict.experience[prefs.experience]}
              hours={hoursFor(chosenRow)}
              actions={
                <>
                  <Link href={`${placeHref(chosenRow)}#checklist-heading`} className="btn btn-accent">
                    {dict.home.openFull}
                    <ArrowUpLeft aria-hidden size={18} className="direction-arrow" />
                  </Link>
                  <SharePlanButton slug={chosenRow.slug} night={chosenRow.date} prefs={prefs} dark />
                </>
              }
            />
            <div className="min-w-0">
              <details className="faq-item border-t border-ink/15">
                <summary>{t.scoreBreakdown}</summary>
                <div className="pb-5">
                  {chosenRow.assessment === "incomplete" && <p className="mb-4 bg-sand-2 p-3">{t.incompleteNote} {chosenRow.missing.map((m) => dict.factor[m]).join(locale === "ar" ? "، " : ", ")}</p>}
                  <FactorBars factors={chosenRow.factors} dealbreakers={chosenRow.dealbreakers} />
                </div>
              </details>
              {helper}
              <button type="button" className="link small mt-4 min-h-11" onClick={startOver}>{dict.home.startOver}</button>
            </div>
          </div>
        )}
        {step === 4 && data && !chosenRow && data.considered.length > 0 && <p className="mt-6 bg-sand-2 p-4">{dict.home.placesNone}</p>}

        {data && (
          <p className="small mt-10 text-ink-2">
            {data.forecastFetchedAt ? <>{dict.common.updated} <time className="num" dateTime={data.forecastFetchedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(data.forecastFetchedAt))}</time></> : t.resultsTimestampMissing}
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
  const reachable = RECOMMENDABLE.filter((d) => d.experiences.includes(prefs.experience)).map((d) => estimateDrive(d, prefs.city).hours);
  const nearestRaw = reachable.length ? Math.ceil(Math.min(...reachable) * 2) / 2 : null;
  const nearestHours = nearestRaw !== null && nearestRaw > prefs.maxDriveHours && nearestRaw <= DRIVE_MAX_HOURS ? Math.max(DRIVE_MIN_HOURS, nearestRaw) : null;
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
