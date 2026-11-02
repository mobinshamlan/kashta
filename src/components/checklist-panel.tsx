"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { buildChecklist, type ChecklistGroup } from "@/lib/checklist";
import { getDestination } from "@/lib/destinations";
import type { Experience, NightMetrics } from "@/lib/types";
import { useI18n } from "./locale-provider";

const GROUP_ORDER: ChecklistGroup[] = ["documents", "vehicle", "camp", "weather", "stars"];

function storageKey(slug: string, date: string) {
  return `kashta:checklist:${slug}:${date}`;
}

export function ChecklistPanel({
  slug,
  date,
  nightLabel,
  experience,
  groupSize,
  metrics,
  aiItems = [],
  dark = false,
}: {
  slug: string;
  date: string;
  nightLabel: string;
  experience: Experience;
  groupSize: number;
  metrics: NightMetrics | null;
  aiItems?: string[];
  dark?: boolean;
}) {
  const { locale, dict } = useI18n();
  const items = useMemo(() => buildChecklist({ experience, groupSize, metrics, permitStatus: getDestination(slug)?.permit.status }), [experience, groupSize, metrics, slug]);
  const allIds = [...items.map((i) => i.id), ...aiItems.map((_, i) => `ai-${i}`)];
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Restore ticks saved on this device for this site and night.
    let saved: string[] = [];
    try {
      saved = JSON.parse(window.localStorage.getItem(storageKey(slug, date)) ?? "[]");
    } catch {
      saved = [];
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(new Set(Array.isArray(saved) ? saved : []));
  }, [slug, date]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(storageKey(slug, date), JSON.stringify([...next]));
      } catch {
        /* storage unavailable: ticks last for this visit only */
      }
      return next;
    });
  };

  const reset = () => {
    setChecked(new Set());
    try {
      window.localStorage.removeItem(storageKey(slug, date));
    } catch {
      /* ignore */
    }
  };

  const done = allIds.filter((id) => checked.has(id)).length;
  const muted = dark ? "text-star-2" : "text-ink-2";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className={`max-w-[52ch] ${muted}`}>{dict.detail.checklistLead(groupSize, nightLabel)}</p>
        <div className="flex items-center gap-4">
          <span className="num font-medium" aria-live="polite">
            {dict.detail.progress(done, allIds.length)}
          </span>
          <button type="button" onClick={reset} className="link small min-h-11" disabled={done === 0}>
            {dict.detail.reset}
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-2">
        {GROUP_ORDER.map((g) => {
          const groupItems = items.filter((i) => i.group === g);
          if (!groupItems.length) return null;
          return (
            <section key={g} aria-label={dict.detail.groups[g]}>
              <h3 className={`small mb-1 font-medium ${muted}`}>{dict.detail.groups[g]}</h3>
              <ul>
                {groupItems.map((i) => (
                  <ChecklistRow key={i.id} label={i.label[locale]} why={i.why?.[locale]} on={checked.has(i.id)} onToggle={() => toggle(i.id)} dark={dark} />
                ))}
              </ul>
            </section>
          );
        })}
        {aiItems.length > 0 && (
          <section aria-label={dict.detail.aiItems}>
            <h3 className={`small mb-1 font-medium ${muted}`}>{dict.detail.aiItems}</h3>
            <ul>
              {aiItems.map((text, i) => (
                <ChecklistRow key={`ai-${i}`} label={text} on={checked.has(`ai-${i}`)} onToggle={() => toggle(`ai-${i}`)} dark={dark} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({
  label,
  why,
  on,
  onToggle,
  dark,
}: {
  label: string;
  why?: string;
  on: boolean;
  onToggle: () => void;
  dark: boolean;
}) {
  const muted = dark ? "text-star-2" : "text-ink-2";
  const rowHover = dark ? "hover:bg-night-2" : "hover:bg-sand-2";
  const box = on ? (dark ? "bg-star text-night" : "bg-ink text-sand") : dark ? "bg-night-3" : "bg-sand-3";
  return (
    <li>
      <label className={`flex min-h-12 cursor-pointer items-start gap-3 py-2.5 transition-colors ${rowHover}`}>
        <input type="checkbox" className="peer sr-only" checked={on} onChange={onToggle} />
        <span
          aria-hidden
          className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-clay ${box}`}
        >
          {on && <Check size={16} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className={on ? "line-through decoration-1 opacity-70" : ""}>{label}</span>
          {why && <span className={`small mt-0.5 block ${muted}`}>{why}</span>}
        </span>
      </label>
    </li>
  );
}
