"use client";

import { ChevronDown, LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { DRIVE_MAX_HOURS, DRIVE_MIN_HOURS, getDestination } from "@/lib/destinations";
import { formatNight } from "@/lib/i18n";
import { nightReasons, type NightPick } from "@/lib/reasons";
import type { Explanation, InterpretedPrefs } from "@/lib/schemas";
import { rating } from "@/lib/score";
import type { Experience, PlanPrefs } from "@/lib/types";
import { tuneKey, type Tune } from "@/lib/tune";
import { useAiStatus } from "./explain-panel";
import { useI18n } from "./locale-provider";
import { ReasonList } from "./recommendation-card";
import { ErrorState } from "./ui";

type ExplainData = { explanation: Omit<Explanation, "summary"> & { summary: string | null }; droppedForUngroundedNumbers: number };
type Msg =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "bot"; kind: "text"; text: string; notes?: string[] }
  | { id: number; from: "bot"; kind: "answer"; text: string | null; why?: boolean; slug?: string; date?: string }
  | { id: number; from: "bot"; kind: "set"; changed: string[]; notes: string[] }
  | { id: number; from: "bot"; kind: "result"; slug: string; date: string; key: string }
  | { id: number; from: "bot"; kind: "explain"; slug: string; date: string; data: ExplainData }
  | { id: number; from: "bot"; kind: "error"; code: ClientErrorCode; retry?: string };

/** A message without its id (distributes Omit over the union so each kind keeps its fields). */
type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, "id"> : never) : never;

export type ChatApply = { experience?: Experience; night?: string | null; groupSize?: number; tune?: Partial<Tune> };

/**
 * مساعد الطلعة: a persistent chat beside the place and plan steps. It answers questions about the
 * plan on screen from the server's numbers, and only when asked clearly reads plain words into the
 * planner's own settings (activity, night, group, drive limit, warmth, wind, priorities). Recommendations always come from the app's scoring:
 * after a change, the reply quotes the app's new pick, never the model's.
 */
export function TripChat({ mode, prefs, data, dataKey, perNight, chosen, explainSignal, openSignal, onApply, onUse, onPick }: {
  mode: Experience;
  /** The full preferences the page is scoring with right now. */
  prefs: PlanPrefs;
  data: PlanResponse | null;
  /** Identifies the scored data set, so a reply can wait for the re-ranked result. */
  dataKey: string;
  perNight: NightPick[];
  chosen: ScoreRow | undefined;
  night: string | null;
  /** Bumped by the plan's "explain" button: open the chat and explain the current plan. */
  explainSignal: number;
  /** Bumped by "ask the assistant" elsewhere on the page: open the chat and focus the input. */
  openSignal: number;
  onApply: (c: ChatApply) => void;
  onUse: () => void;
  /** Choose a specific place and night (the better option offered after a "not suitable" pick). */
  onPick: (slug: string, date: string) => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.home.chat;
  const sep = locale === "ar" ? "، " : ", ";
  const ai = useAiStatus();
  const id = useId();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "interpret" | "explain">(null);
  const [open, setOpen] = useState(false);
  // Long examples lead an empty chat; once it's going they fold behind one button.
  const [showExamples, setShowExamples] = useState(true);
  const waiting = useRef<{ key: string } | null>(null);
  // Bumped on every apply, so the reply is checked after the page has re-rendered with the change.
  const [applied, setApplied] = useState(0);
  const seq = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const push = (m: NewMsg) => setMsgs((list) => [...list, { ...m, id: ++seq.current } as Msg]);

  // Keep the newest message in view inside the log (never scrolls the page).
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [msgs, busy]);

  // After a change, report the app's re-ranked pick once the matching data has arrived.
  useEffect(() => {
    if (!waiting.current || waiting.current.key !== dataKey || !data) return;
    waiting.current = null;
    push(chosen ? { from: "bot", kind: "result", slug: chosen.slug, date: chosen.date, key: dataKey } : { from: "bot", kind: "text", text: t.noneInRange });
  }, [data, dataKey, chosen, applied, t.noneInRange]);

  const send = async (input: string) => {
    const msg = input.trim();
    if (msg.length < 4 || busy) return;
    push({ from: "user", text: msg });
    setText("");
    setShowExamples(false);
    setBusy("interpret");
    // The plan on screen goes along, so a question is answered from it (the server recomputes the numbers).
    const context = chosen ? { slug: chosen.slug, date: chosen.date, prefs: { ...prefs, date: chosen.date } } : null;
    const res = await callApi<{ prefs?: InterpretedPrefs; unsupported?: string[]; redirect?: string; answer?: string | null; why?: boolean }>("/api/ai/interpret", { method: "POST", body: JSON.stringify({ text: msg, locale, context }) });
    setBusy(null);
    if (!res.ok) return push({ from: "bot", kind: "error", code: res.code, retry: msg });
    if (res.data.redirect) return push({ from: "bot", kind: "text", text: res.data.redirect });
    // A question is answered and nothing in the plan changes.
    if ("answer" in res.data) return push({ from: "bot", kind: "answer", text: res.data.answer ?? null, why: res.data.why, slug: chosen?.slug, date: chosen?.date });
    const got = res.data.prefs;
    if (!got) return push({ from: "bot", kind: "text", text: t.nothingChanged });
    const changed: string[] = [];
    const notes: string[] = [];
    const c: ChatApply = {};
    if (got.experience) {
      c.experience = got.experience;
      changed.push(dict.experience[got.experience]);
    }
    if (got.date && got.date !== "flexible") {
      // Only a night the forecast fully scores can be chosen; otherwise say why.
      const target = perNight.find((n) => n.night === got.date);
      if (target?.best) {
        c.night = got.date;
        changed.push(formatNight(got.date, locale, { short: true }));
      } else {
        notes.push(`${formatNight(got.date, locale, { short: true })}: ${target ? dict.home.helper.nightUnscored : dict.home.helper.nightOutside}`);
      }
    } else if (got.date === "flexible") {
      c.night = null;
      changed.push(t.anyNight);
    }
    if (got.groupSize) {
      c.groupSize = got.groupSize;
      changed.push(`${dict.home.forPeople}: ${got.groupSize}`);
    }
    const tune: Partial<Tune> = {};
    if (got.city && got.city !== prefs.city) {
      tune.city = got.city;
      changed.push(`${dict.plan.cityLegend} ${dict.common.cities[got.city]}`);
    }
    if (got.maxDriveHours) {
      // The same range the planner offers (1.5–12 h, half-hour steps).
      tune.maxDriveHours = Math.min(DRIVE_MAX_HOURS, Math.max(DRIVE_MIN_HOURS, Math.round(got.maxDriveHours * 2) / 2));
      if (tune.maxDriveHours !== got.maxDriveHours) notes.push(t.driveClamped(dict.plan.driveValue(tune.maxDriveHours)));
      changed.push(`${dict.plan.driveLabel}: ${dict.plan.driveValue(tune.maxDriveHours)}`);
    }
    if (got.tempPref) {
      tune.tempPref = got.tempPref;
      changed.push(`${dict.plan.tempLabel}: ${dict.temp[got.tempPref]}`);
    }
    if (got.windTolerance) {
      tune.windTolerance = got.windTolerance;
      changed.push(`${dict.plan.windLabel}: ${dict.wind[got.windTolerance]}`);
    }
    if (got.priorities?.length) {
      tune.priorities = got.priorities.slice(0, 3);
      changed.push(`${dict.plan.prioritiesLabel}: ${tune.priorities.map((f) => dict.factor[f]).join(sep)}`);
    }
    if (Object.keys(tune).length) c.tune = tune;
    const unclear = [...(got.unclear ?? []), ...(res.data.unsupported ?? [])];
    if (unclear.length) notes.push(`${t.notSet} ${unclear.join(sep)}`);

    if (!changed.length) return push({ from: "bot", kind: "text", text: t.nothingChanged, notes });
    push({ from: "bot", kind: "set", changed, notes });
    // Wait for the app to re-rank with the new settings, then quote its pick.
    const key = tuneKey(c.experience ?? mode, { city: prefs.city, maxDriveHours: prefs.maxDriveHours, tempPref: prefs.tempPref, windTolerance: prefs.windTolerance, priorities: prefs.priorities, ...c.tune });
    waiting.current = { key };
    onApply(c);
    setApplied((n) => n + 1);
  };

  const explain = async () => {
    if (!chosen || busy) return;
    const place = getDestination(chosen.slug)?.name[locale] ?? "";
    push({ from: "user", text: `${t.explain}: ${place}` });
    setBusy("explain");
    const res = await callApi<ExplainData>("/api/ai/explain", {
      method: "POST",
      body: JSON.stringify({ slug: chosen.slug, date: chosen.date, prefs: { ...prefs, date: chosen.date }, locale }),
    });
    setBusy(null);
    if (!res.ok) return push({ from: "bot", kind: "error", code: res.code });
    push({ from: "bot", kind: "explain", slug: chosen.slug, date: chosen.date, data: res.data });
  };

  const lastOpen = useRef(openSignal);
  useEffect(() => {
    if (openSignal === lastOpen.current) return;
    lastOpen.current = openSignal;
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, [openSignal]);

  // The plan's "explain" button: open the conversation and ask.
  const lastSignal = useRef(explainSignal);
  useEffect(() => {
    if (explainSignal === lastSignal.current) return;
    lastSignal.current = explainSignal;
    setOpen(true);
    void explain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainSignal]);

  const disabled = ai !== true || busy !== null;
  const last = [...msgs].reverse().find((m) => m.from === "bot");

  return (
    <aside className="trip-chat" data-open={open} data-mode={mode} aria-labelledby={`${id}-title`}>
      {/* Phones: a docked bar that opens the conversation; desktops always show it. */}
      <button type="button" className="trip-chat-dock" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }}>
        <span className="trip-chat-mark" aria-hidden><Sparkles size={16} /></span>
        <span className="min-w-0 flex-1 text-start">
          <span className="block font-semibold">{t.title}</span>
          <span className="block truncate small muted">{busy ? t.thinking : last && last.kind === "result" ? t.resultShort(getDestination(last.slug)?.name[locale] ?? "") : t.dockHint}</span>
        </span>
        <MessageCircle aria-hidden size={20} />
      </button>

      <div id={`${id}-panel`} className="trip-chat-panel">
        <header className="trip-chat-head">
          <span className="trip-chat-mark" aria-hidden><Sparkles size={16} /></span>
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="font-semibold">{t.title}</h2>
          </div>
          <button type="button" className="trip-chat-close" aria-label={t.close} onClick={() => setOpen(false)}><X aria-hidden size={18} /></button>
        </header>

        <div ref={logRef} className="trip-chat-log" role="log" aria-live="polite" aria-relevant="additions" aria-label={t.title} tabIndex={0}>
          <div className="chat-msg chat-msg--bot"><p>{t.hello}</p></div>
          {msgs.map((m) => (m.from === "user" ? (
            <div key={m.id} className="chat-msg chat-msg--user"><p dir="auto">{m.text}</p></div>
          ) : (
            <div key={m.id} className="chat-msg chat-msg--bot">
              {m.kind === "text" && <><p dir="auto">{m.text}</p>{m.notes?.map((n) => <p key={n} className="small muted mt-1">{n}</p>)}</>}
              {m.kind === "answer" && <AnswerMsg text={m.text} why={m.why} slug={m.slug} date={m.date} plan={data} />}
              {m.kind === "set" && (
                <>
                  <p className="font-medium">{t.changed}</p>
                  <ul className="chat-chips mt-1.5">{m.changed.map((c) => <li key={c}>{c}</li>)}</ul>
                  {m.notes.map((n) => <p key={n} className="small muted mt-1.5">{n}</p>)}
                </>
              )}
              {m.kind === "result" && <ResultMsg slug={m.slug} date={m.date} current={chosen?.slug === m.slug && chosen.date === m.date} data={data} onUse={onUse} onPick={onPick} />}
              {m.kind === "explain" && <ExplainMsg slug={m.slug} date={m.date} data={m.data} plan={data} />}
              {m.kind === "error" && <ErrorState code={m.code} className="!bg-transparent !p-0" onRetry={m.retry ? () => { setMsgs((list) => list.filter((x) => x.id !== m.id)); void send(m.retry!); } : () => { setMsgs((list) => list.filter((x) => x.id !== m.id)); void explain(); }} />}
            </div>
          )))}
          {busy && (
            <div className="chat-msg chat-msg--bot" aria-busy="true">
              <p className="flex items-center gap-2 muted"><LoaderCircle aria-hidden size={15} className="animate-spin" />{t.thinking}</p>
            </div>
          )}
        </div>

        {ai === false && <p className="small px-4 pb-2 text-[#f2b8a4]">{dict.errors.ai_not_configured}</p>}

        <div className="trip-chat-foot">
          <div className="trip-chat-examples" role="group" aria-label={t.examplesLabel}>
            {chosen && (
              <button type="button" className="chat-example chat-example--action" disabled={disabled} onClick={explain}>{t.explain}</button>
            )}
            {showExamples ? t.examples.map((ex) => (
              <button key={ex} type="button" className="chat-example" disabled={disabled} onClick={() => send(ex)}>{ex}</button>
            )) : (
              <button type="button" className="chat-example chat-example--action" aria-expanded={false} onClick={() => setShowExamples(true)}>{t.examplesLabel}</button>
            )}
          </div>
          <form className="trip-chat-form" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <label htmlFor={`${id}-input`} className="sr-only">{t.placeholder}</label>
            <textarea
              ref={inputRef}
              id={`${id}-input`}
              rows={1}
              maxLength={600}
              value={text}
              placeholder={t.placeholder}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
            />
            <button type="submit" className="trip-chat-send" aria-label={t.send} disabled={disabled || text.trim().length < 4}><Send aria-hidden size={18} className="rtl:-scale-x-100" /></button>
          </form>
        </div>
      </div>
    </aside>
  );
}

/** The app's own pick after a change: place, night, rating and one reason, all from the scores. */
function ResultMsg({ slug, date, current, data, onUse, onPick }: { slug: string; date: string; current: boolean; data: PlanResponse | null; onUse: () => void; onPick: (slug: string, date: string) => void }) {
  const { locale, dict } = useI18n();
  const t = dict.home.chat;
  const d = getDestination(slug);
  const row = data?.results.find((r) => r.slug === slug && r.date === date);
  // Not suitable: the best scored option in the same data (same activity, drive limit and
  // preferences), any night this week, offered in one tap. Never invented: it's the app's score.
  const poor = row ? rating(row.score) === "poor" : false;
  const better = poor && data
    ? data.results.filter((r) => r.score !== null && rating(r.score) !== "poor").sort((a, b) => b.score! - a.score! || a.date.localeCompare(b.date))[0]
    : undefined;
  if (!d) return null;
  return (
    <>
      <p>{t.result(d.name[locale], formatNight(date, locale, { short: true }), row ? dict.rating[rating(row.score)] : "")}</p>
      {row && data && <ReasonList className="small mt-1.5" reasons={nightReasons(row, data.metrics[`${slug}|${date}`], 1)} />}
      {poor && better ? (
        <>
          <p className="small mt-1.5">{t.betterOption(getDestination(better.slug)!.name[locale], formatNight(better.date, locale, { short: true }), dict.rating[rating(better.score)])}</p>
          <button type="button" className="chat-use mt-2" onClick={() => onPick(better.slug, better.date)}>{t.tryBetter}</button>
          {current && <button type="button" className="chat-more ms-3" onClick={onUse}>{t.useAnyway}</button>}
        </>
      ) : (
        <>
          {poor && <p className="small muted mt-1.5">{t.poorPick}</p>}
          {current && <button type="button" className={poor ? "chat-more mt-1" : "chat-use mt-2"} onClick={onUse}>{poor ? t.useAnyway : t.usePlan}</button>}
        </>
      )}
    </>
  );
}

/** A short explanation: the main reason, one caution, and the forecast facts behind it; the rest on request. */
function ExplainMsg({ slug, date, data, plan }: { slug: string; date: string; data: ExplainData; plan: PlanResponse | null }) {
  const { locale, dict } = useI18n();
  const t = dict.home.chat;
  const [more, setMore] = useState(false);
  const e = data.explanation;
  const row = plan?.results.find((r) => r.slug === slug && r.date === date);
  // The main reason leads (the first grounded reason if the summary was dropped); the checklist,
  // not the model, covers packing, so only reasons and preparations sit behind "more".
  // A night the app rates "not suitable" leads with the app's own verdict; the model's prose could
  // contradict the numbers, so it isn't shown for such a pick.
  const poor = row ? rating(row.score) === "poor" : false;
  const main = poor ? null : e.summary ?? e.reasons[0] ?? null;
  const extra = poor ? [] : [...e.reasons.filter((r) => r !== main).slice(0, 3), ...e.preparations.slice(0, 2)];
  return (
    <div lang={locale}>
      {poor && <p className="font-medium">{t.poorVerdict}</p>}
      {main && <p>{main}</p>}
      {!poor && e.cautions[0] && <p className="chat-caution mt-2"><span className="font-medium">{t.caution}</span> {e.cautions[0]}</p>}
      {row && plan && (
        <div className="mt-2">
          <p className="small muted">{t.factsUsed}</p>
          <ReasonList className="small mt-1" reasons={nightReasons(row, plan.metrics[`${slug}|${date}`], 3)} />
        </div>
      )}
      {extra.length > 0 && (
        <>
          <button type="button" className="chat-more mt-2" aria-expanded={more} onClick={() => setMore((v) => !v)}>
            {more ? t.less : t.more}
            <ChevronDown aria-hidden size={15} className={more ? "rotate-180" : ""} />
          </button>
          {more && <ul className="chat-list small mt-1.5">{extra.map((x) => <li key={x}>{x}</li>)}</ul>}
        </>
      )}
    </div>
  );
}

/** A grounded answer; if the model's reply didn't pass the checks, the app's own reasons stand in. */
function AnswerMsg({ text, why, slug, date, plan }: { text: string | null; why?: boolean; slug?: string; date?: string; plan: PlanResponse | null }) {
  const { locale, dict } = useI18n();
  const t = dict.home.chat;
  const row = slug && date ? plan?.results.find((r) => r.slug === slug && r.date === date) : undefined;
  if (text) return <p dir="auto" lang={/[\u0600-\u06FF]/u.test(text) ? "ar" : "en"}>{text}</p>;
  return (
    <div lang={locale}>
      <p>{row ? (why ? t.whyPicked : t.answerFallback)(getDestination(row.slug)?.name[locale] ?? "", formatNight(row.date, locale, { short: true })) : t.answerNoPlan}</p>
      {row && plan && <ReasonList className="small mt-1.5" reasons={nightReasons(row, plan.metrics[`${row.slug}|${row.date}`], 3)} />}
    </div>
  );
}
