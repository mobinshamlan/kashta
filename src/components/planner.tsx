"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Minus, Plus, Wand2 } from "lucide-react";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { getDestination, estimateDrive } from "@/lib/destinations";
import { formatDayMonth, formatNight, formatWeekday } from "@/lib/i18n";
import { PHOTOS } from "@/lib/photos";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/prefs-storage";
import type { InterpretedPrefs } from "@/lib/schemas";
import { rating } from "@/lib/score";
import { upcomingNights } from "@/lib/nights";
import type { Factor, PlanPrefs } from "@/lib/types";
import { ExplainPanel, useAiStatus } from "./explain-panel";
import { useI18n } from "./locale-provider";
import { ErrorState, FactorBars, RATING_COLOR, ScoreFigure, Skeleton } from "./ui";

type Field = keyof Omit<PlanPrefs, "city">;

const PRIORITY_OPTIONS: Factor[] = ["temp", "wind", "rain", "dust", "clouds", "moon"];

export function Planner({ initialText = "", initialExperience }: { initialText?: string; initialExperience?: "kashta" | "stars" }) {
  const { locale, dict } = useI18n();
  const t = dict.plan;
  const ai = useAiStatus();
  const nights = upcomingNights();
  const formId = useId();

  const [prefs, setPrefs] = useState<PlanPrefs>(DEFAULT_PREFS);
  const [text, setText] = useState(initialText);
  const [applied, setApplied] = useState<Set<Field>>(new Set());
  const [understood, setUnderstood] = useState<{ summary?: string | null; unclear?: string[] | null } | null>(null);
  const [interpret, setInterpret] = useState<{ s: "idle" | "loading" } | { s: "error"; code: ClientErrorCode }>({ s: "idle" });
  const [groupInput, setGroupInput] = useState(String(DEFAULT_PREFS.groupSize));
  const [groupError, setGroupError] = useState(false);
  const [plan, setPlan] = useState<
    { s: "idle" } | { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse; prefs: PlanPrefs }
  >({ s: "idle" });
  const [selected, setSelected] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore the last preferences used on this device.
    const stored = loadPrefs();
    const p = initialExperience ? { ...stored, experience: initialExperience } : stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(p);
    setGroupInput(String(p.groupSize));
  }, [initialExperience]);

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
    const res = await callApi<{ prefs: InterpretedPrefs }>("/api/ai/interpret", {
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
    setUnderstood({ summary: got.summary, unclear: got.unclear });
    setInterpret({ s: "idle" });
  };

  const submit = async (p: PlanPrefs) => {
      setPlan({ s: "loading" });
      setSelected(null);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      const res = await callApi<PlanResponse>("/api/plan", { method: "POST", body: JSON.stringify(p) });
      if (res.ok) {
        setPlan({ s: "ok", data: res.data, prefs: p });
        const first = res.data.results.find((r) => r.score !== null) ?? res.data.results[0];
        setSelected(first ? `${first.slug}|${first.date}` : null);
      } else setPlan({ s: "error", code: res.code });
  };

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


  const legend = "mb-3 font-medium";

  return (
    <div className="grid gap-16 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-10" aria-label={t.title}>
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
              <Wand2 aria-hidden size={18} />
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
                {understood.summary && <p className="mt-1">{understood.summary}</p>}
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

        <fieldset>
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
        </fieldset>

        <button type="submit" className="btn w-full" disabled={plan.s === "loading"}>
          {plan.s === "loading" ? t.submitting : t.submit}
        </button>
      </form>

      <div ref={resultsRef} className="min-w-0 scroll-mt-6" aria-live="polite" aria-busy={plan.s === "loading"}>
        <h2 className="sub">{t.resultsTitle}</h2>
        {plan.s === "idle" && (
          <div className="mt-6">
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={PHOTOS["dahna-crest"].src}
                alt={PHOTOS["dahna-crest"].alt[locale]}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <p className="lead mt-6">{t.emptyTitle}</p>
            <p className="mt-2 max-w-[48ch] text-ink-2">{t.emptyBody}</p>
          </div>
        )}
        {plan.s === "loading" && (
          <div className="mt-6 flex flex-col gap-3">
            <span className="sr-only">{dict.common.loading}</span>
            <Skeleton className="h-40" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {plan.s === "error" && <ErrorState className="mt-6" code={plan.code} onRetry={() => submit(prefs)} />}
        {plan.s === "ok" && (
          <Results data={plan.data} prefs={plan.prefs} selected={selected} onSelect={setSelected} />
        )}
      </div>
    </div>
  );
}

function AppliedTag({ on, label }: { on: boolean; label: string }) {
  return on ? <span className="small ms-2 bg-clay px-1.5 py-0.5 text-clay-ink">{label}</span> : null;
}

function Results({
  data,
  prefs,
  selected,
  onSelect,
}: {
  data: PlanResponse;
  prefs: PlanPrefs;
  selected: string | null;
  onSelect: (k: string) => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.plan;

  if (data.considered.length === 0) {
    return <p className="lead mt-6 bg-sand-2 p-6">{t.noneInRange}</p>;
  }

  const nightsShown = prefs.date === "flexible" ? data.nights : [prefs.date];
  const top = data.results.slice(0, 6);
  const sel = data.results.find((r) => `${r.slug}|${r.date}` === selected) ?? top[0];
  const selMetrics = sel ? data.metrics[`${sel.slug}|${sel.date}`] : undefined;
  const selDest = sel ? getDestination(sel.slug) : undefined;

  return (
    <div className="mt-4">
      <p className="text-ink-2">
        {t.resultsLead(data.considered.length, nightsShown.length)}{" "}
        {data.excludedByDistance.length > 0 && t.excluded(data.excludedByDistance.length)}
      </p>
      {!data.airQuality.available && <p className="mt-2 bg-sand-2 p-3">{t.airDown}</p>}

      <h3 className="mt-10 mb-3 font-medium">{t.topPicks}</h3>
      <ol role="list">
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
                className={`grid min-h-16 w-full grid-cols-[2rem_1fr_auto] items-center gap-4 px-3 py-3 text-start transition-colors ${
                  on ? "bg-ink text-sand" : "hover:bg-sand-2"
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
        <section className="mt-10 bg-sand-2 p-6 md:p-8" aria-labelledby="sel-heading">
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
            <ExplainPanel key={`${sel.slug}|${sel.date}|${prefs.experience}|${locale}`} slug={sel.slug} date={sel.date} prefs={prefs} />
          </div>
          <Link
            href={`/destinations/${sel.slug}?night=${sel.date}&exp=${prefs.experience}`}
            className="link mt-8 inline-flex min-h-11 items-center font-medium"
          >
            {t.openChecklist}
          </Link>
        </section>
      )}

      {prefs.date === "flexible" && <Matrix data={data} onSelect={onSelect} />}
    </div>
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
