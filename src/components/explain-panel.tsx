"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { getDestination } from "@/lib/destinations";
import { formatNight } from "@/lib/i18n";
import type { Explanation } from "@/lib/schemas";
import type { PlanPrefs } from "@/lib/types";
import { useI18n } from "./locale-provider";
import { ErrorState } from "./ui";

interface ExplainResponse {
  explanation: Omit<Explanation, "summary"> & { summary: string | null };
  droppedForUngroundedNumbers: number;
  model: string;
  provider: string;
}

let statusPromise: Promise<boolean> | null = null;
/** Asks the server once per page load whether a Llama provider is configured. */
export function useAiStatus() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    statusPromise ??= callApi<{ configured: boolean }>("/api/ai/status").then((r) => (r.ok ? r.data.configured : false));
    let live = true;
    statusPromise.then((v) => live && setConfigured(v));
    return () => {
      live = false;
    };
  }, []);
  return configured;
}

export function ExplainPanel({
  slug,
  date,
  prefs,
  onPacking,
  dark = false,
}: {
  slug: string;
  date: string;
  prefs: PlanPrefs;
  onPacking?: (items: string[]) => void;
  dark?: boolean;
}) {
  const { locale, dict } = useI18n();
  const ai = useAiStatus();
  const pending = useRef<AbortController | null>(null);
  const [state, setState] = useState<
    { s: "idle" } | { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: ExplainResponse }
  >({ s: "idle" });

  // A different site or night invalidates the previous explanation.
  const key = `${slug}|${date}|${prefs.experience}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setState({ s: "idle" });
  }

  useEffect(() => () => pending.current?.abort(), []);

  const run = async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState({ s: "loading" });
    const res = await callApi<ExplainResponse>("/api/ai/explain", {
      method: "POST",
      body: JSON.stringify({ slug, date, prefs, locale }),
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    pending.current = null;
    if (res.ok) {
      setState({ s: "ok", data: res.data });
      onPacking?.(res.data.explanation.packing);
    } else {
      setState({ s: "error", code: res.code });
    }
  };

  const muted = dark ? "text-star-2" : "text-ink-2";

  return (
    <div aria-live="polite">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn"
          onClick={run}
          disabled={ai !== true || state.s === "loading"}
          aria-describedby={ai === false ? `ai-off-${slug}` : undefined}
        >
          <Sparkles aria-hidden size={18} />
          {state.s === "loading" ? dict.plan.explaining : dict.plan.explain}
        </button>
        <span className={`text-xs ${muted}`}>{locale === "ar" ? "بمساعدة Llama" : "With Llama"}</span>
      </div>
      {ai === false && (
        <p id={`ai-off-${slug}`} className={`small mt-3 max-w-[56ch] ${muted}`}>
          {dict.plan.aiOff}
        </p>
      )}

      {state.s === "loading" && (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          <div className="skeleton h-5 w-4/5" />
          <div className="skeleton h-5 w-3/5" />
          <div className="skeleton h-5 w-2/3" />
        </div>
      )}
      {state.s === "error" && <ErrorState className="mt-6" code={state.code} onRetry={run} />}
      {state.s === "ok" && <ExplanationView data={state.data} dark={dark} locale={locale} />}
    </div>
  );
}

function ExplanationView({ data, dark, locale }: { data: ExplainResponse; dark: boolean; locale: "ar" | "en" }) {
  const { dict } = useI18n();
  const e = data.explanation;
  const muted = dark ? "text-star-2" : "text-ink-2";
  const alt = e.alternative ? getDestination(e.alternative.slug) : undefined;
  return (
    <article className={`mt-6 p-6 ${dark ? "bg-night-2" : "bg-sand-2"}`} lang={locale}>
      <h3 className="lead font-light">{dict.plan.explainTitle}</h3>
      {e.summary && <p className="lead mt-3 max-w-[56ch]">{e.summary}</p>}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <ExplainList title={dict.plan.reasons} items={e.reasons} />
        <ExplainList title={dict.plan.cautions} items={e.cautions} />
        <ExplainList title={dict.plan.preparations} items={e.preparations} />
        <ExplainList title={dict.plan.packing} items={e.packing} />
      </div>
      {e.alternative && alt && (
        <p className="mt-6">
          <span className="font-medium">{dict.plan.alternative}: </span>
          <Link className="link" href={`/destinations/${alt.slug}?night=${e.alternative.date}`}>
            {alt.name[locale]} — {formatNight(e.alternative.date, locale)}
          </Link>
          {e.alternative.why && <span className="block mt-1">{e.alternative.why}</span>}
        </p>
      )}
      <p className={`small mt-6 ${muted}`}>
        {dict.plan.explainNote} ({data.model})
        {data.droppedForUngroundedNumbers > 0 && <span className="block">{dict.plan.dropped(data.droppedForUngroundedNumbers)}</span>}
      </p>
    </article>
  );
}

function ExplainList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="font-medium">{title}</h4>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 ps-5">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
