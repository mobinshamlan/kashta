"use client";

import Link from "next/link";
import { Car, Check, Clock, ExternalLink, Flame, Link2, Minus, Plus, RotateCcw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlanResponse, ScoreRow } from "@/lib/api-types";
import { buildChecklist } from "@/lib/checklist";
import { estimateDrive, getDestination } from "@/lib/destinations";
import { approxHours, formatNight } from "@/lib/i18n";
import { DEFAULT_PREFS } from "@/lib/prefs-storage";
import { rating } from "@/lib/score";
import type { Experience } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { RATING_COLOR } from "./ui";

/** Same key as the place page's checklist, so ticks made here are still ticked there. */
const checklistKey = (slug: string, date: string) => `kashta:checklist:${slug}:${date}`;

/**
 * The finished plan: what, when, where, why, how far and the permit, then a short list to tick.
 * Everything else (full checklist, hourly forecast, sources) is on the place page.
 */
export function HomePlan({ mode, row, data, groupSize, onGroupSize, onStartOver, onChangePlace, onExplain, carry = "" }: {
  mode: Experience;
  row: ScoreRow;
  data: PlanResponse;
  groupSize: number;
  onGroupSize: (n: number) => void;
  onStartOver: () => void;
  onChangePlace: () => void;
  /** Ask the assistant (in the chat beside the plan) to explain this plan. */
  onExplain: () => void;
  carry?: string;
}) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const ar = locale === "ar";
  const d = getDestination(row.slug)!;
  const m = data.forecasts[row.slug]?.metrics.find((x) => x.date === row.date) ?? null;
  const rt = rating(row.score);
  const drive = estimateDrive(d);
  const items = buildChecklist({ experience: mode, groupSize, metrics: m, permitStatus: d.permit.status });
  // Lead with what this activity and this night call for; the permit has its own row.
  const order = mode === "stars" ? ["stars", "weather", "camp", "vehicle"] : ["weather", "camp", "vehicle", "stars"];
  const permitItem = items.find((i) => i.id === "permit");
  const essentials = items.filter((i) => i.group !== "documents").sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group)).slice(0, 4);
  const checkRows = [...(permitItem ? [permitItem] : []), ...essentials];
  const permitOk = d.permit.status === "permit_required" || d.permit.status === "verified_permitted";
  const PermitIcon = permitOk ? ShieldCheck : ShieldAlert;
  const ModeIcon = mode === "kashta" ? Flame : Sparkles;
  const placeHref = `/destinations/${row.slug}?night=${row.date}&exp=${mode}${carry ? `&${carry}` : ""}`;
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [share, setShare] = useState<"idle" | "copied" | "failed">("idle");

  // Leave-by: sunset minus the same rounded drive estimate the card shows, down to a quarter hour.
  const leaveBy = (() => {
    if (!m?.sunset) return null;
    const [h, min] = m.sunset.split(":").map(Number);
    const total = h * 60 + min - Math.max(0.5, Math.round(drive.hours * 2) / 2) * 60;
    if (!Number.isFinite(total) || total < 0) return null;
    const q = Math.floor(total / 15) * 15;
    return `${String(Math.floor(q / 60)).padStart(2, "0")}:${String(q % 60).padStart(2, "0")}`;
  })();

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(checklistKey(row.slug, row.date)) ?? "[]");
      // Restore ticks saved on this device (here or on the place page).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTicked(new Set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : []));
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
    // The page the sender sees: its address pins the plan (mode, night, place, group, tuned
    // preferences) at step 4. Older /plan share links still work.
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    url.searchParams.set("night", row.date);
    url.searchParams.set("place", row.slug);
    url.searchParams.set("step", "4");
    if (groupSize !== DEFAULT_PREFS.groupSize) url.searchParams.set("group", String(groupSize));
    url.hash = "plan";
    const link = url.href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(link);
      setShare("copied");
    } catch {
      setShare("failed");
    }
  };

  return (
    <div className="plan-done plan-step-in grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
      <div className="min-w-0">
        <article className="rec-card on-night plan-result" data-mode={mode} aria-labelledby="plan-place">
          <p className="plan-result-state small"><Check aria-hidden size={15} />{t.journeyEnd}<span className="rec-kicker">{ModeIcon && <ModeIcon aria-hidden size={15} />}{dict.experience[mode]} · {formatNight(row.date, locale)}</span></p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h3 id="plan-place" className="rec-place">{d.name[locale]}</h3>
            <span className="rec-rating" style={{ ["--rating" as string]: RATING_COLOR[rt] }}>{dict.rating[rt]}</span>
          </div>
          <ul className="rec-divider small mt-5 grid gap-2 pt-4">
            <li className="flex items-center gap-2" title={dict.common.estimateNote}>
              <Car aria-hidden size={16} />
              <bdi className="num">{approxHours(drive.hours, locale)}</bdi>
            </li>
            <li className="flex flex-wrap items-center gap-x-2">
              <PermitIcon aria-hidden size={16} />
              <span className="font-medium">{dict.permit.short[d.permit.status]}</span>
            </li>
          </ul>
        </article>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn plan-go" onClick={copy}><Link2 aria-hidden size={17} />{dict.plan.shareLink}</button>
          <button type="button" className="btn-quiet plan-explain" onClick={onExplain}><Sparkles aria-hidden size={16} />{dict.home.chat.explain}</button>
        </div>
        <p role="status" className="small mt-2 min-h-5 text-ink-2">
          {share === "copied" ? dict.plan.shareCopied : share === "failed" ? dict.plan.shareInvalid : ""}
        </p>
        <div className="flex flex-wrap gap-x-5">
          <button type="button" className="link small inline-flex min-h-11 items-center" onClick={onChangePlace}>{t.changePlace}</button>
          <Link href={placeHref} className="link small inline-flex min-h-11 items-center">{t.placeDetails}</Link>
          <button type="button" className="link small inline-flex min-h-11 items-center gap-1.5" onClick={onStartOver}>
            <RotateCcw aria-hidden size={15} />{t.startOver}
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <section className="before-go" aria-labelledby="before-go-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="before-go-title" className="font-medium">{t.beforeTitle}</h3>
            {/* The list is sized for this many people; changing it is optional. */}
            <div className="group-step" role="group" aria-labelledby="group-label">
              <span id="group-label" className="small text-ink-2">{t.forPeople}</span>
              <button type="button" aria-label={ar ? "أنقص شخص" : "One fewer person"} disabled={groupSize <= 1} onClick={() => onGroupSize(groupSize - 1)}><Minus aria-hidden size={16} /></button>
              <output className="num" aria-live="polite">{groupSize}</output>
              <button type="button" aria-label={ar ? "زد شخص" : "One more person"} disabled={groupSize >= 40} onClick={() => onGroupSize(groupSize + 1)}><Plus aria-hidden size={16} /></button>
            </div>
          </div>
          {leaveBy && (
            <p className="before-go-time mt-3">
              <Clock aria-hidden size={18} className="shrink-0" />
              <span>{t.leaveBy} <bdi dir="ltr" className="num font-semibold">{leaveBy}</bdi><span className="small block before-go-note">{t.leaveByNote}</span></span>
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
        </section>
      </div>
    </div>
  );
}

/**
 * The plan before a place is used: the current choice shown as a suggestion (or as the visitor's
 * pick, if they picked it), never as a finished plan. One action makes it the plan.
 */
export function PlanSuggestion({ mode, row, picked, onUse, onChange }: {
  mode: Experience;
  row: ScoreRow;
  /** The visitor picked this place on the map or list (vs. our suggestion). */
  picked: boolean;
  onUse: () => void;
  onChange: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = dict.home;
  const d = getDestination(row.slug)!;
  const ModeIcon = mode === "kashta" ? Flame : Sparkles;
  return (
    <article className="rec-card on-night plan-suggest" data-mode={mode} aria-labelledby="suggest-place">
      <div className="plan-suggest-body">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="plan-suggest-tag">{picked ? t.yourPick : t.ourSuggestion}</span>
            <span className="rec-kicker small"><ModeIcon aria-hidden size={15} />{dict.experience[mode]} · {formatNight(row.date, locale, { short: true })}</span>
          </p>
          <h3 id="suggest-place" className="rec-place mt-2">{d.name[locale]}</h3>
        </div>
        <div className="plan-suggest-actions">
          <button type="button" className="btn btn-accent" onClick={onUse}>{t.usePlan}</button>
          <button type="button" className="rec-link small min-h-11" onClick={onChange}>{t.changePlace}</button>
        </div>
      </div>
    </article>
  );
}
