"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Car, ChevronDown, Cloud, CloudFog, CloudRain, Map as MapIcon, Moon, ShieldAlert, ShieldCheck, Thermometer, TriangleAlert, Wind } from "lucide-react";
import type { NightSummary, PlanResponse, ScoreRow } from "@/lib/api-types";
import { callApi, type ClientErrorCode } from "@/lib/client-api";
import { DESTINATIONS, estimateDrive, getDestination } from "@/lib/destinations";
import { approxHours, formatNight, ltr, arHoursOf } from "@/lib/i18n";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/lib/prefs-storage";
import { nightReasons, type Reason } from "@/lib/reasons";
import { rating } from "@/lib/score";
import type { Destination, Experience } from "@/lib/types";
import { CoverageMap } from "./coverage-map";
import { useI18n } from "./locale-provider";
import { ModeSwitch } from "./mode-switch";
import { ErrorState, RATING_COLOR, Skeleton } from "./ui";

type Load = { s: "loading" } | { s: "error"; code: ClientErrorCode } | { s: "ok"; data: PlanResponse };
type Row = { d: Destination; hours: number; best?: ScoreRow; m?: NightSummary };

const SHORT_LIST = 4;
/** Same default reach as the homepage and planner; the toggle widens it to the planner's maximum. */
const NEAR_HOURS = DEFAULT_PREFS.maxDriveHours;
const FAR_HOURS = 5;

const REASON_ICON = { temp: Thermometer, wind: Wind, rain: CloudRain, dust: CloudFog, clouds: Cloud, moon: Moon } as const;

function ReasonIcon({ reason }: { reason: Reason }) {
  const Icon = reason.tone === "caution" ? TriangleAlert : REASON_ICON[reason.factor];
  return <Icon aria-hidden size={18} className="shrink-0" style={{ color: reason.tone === "caution" ? "var(--color-poor)" : "var(--color-olive)" }} />;
}

/** Best night per place: highest score; a tie goes to the earlier night. */
function bestNights(data: PlanResponse): Row[] {
  return data.considered.flatMap((slug) => {
    const d = getDestination(slug);
    if (!d) return [];
    const rows = data.results.filter((r) => r.slug === slug && r.score !== null);
    const best = rows.sort((a, b) => b.score! - a.score! || a.date.localeCompare(b.date))[0];
    return [{ d, hours: estimateDrive(d).hours, best, m: best ? data.metrics[`${slug}|${best.date}`] : undefined }];
  });
}

/** A short, light list of places for the chosen activity: name, suitability, one reason. Details on request. */
export function DestinationIndex({ initialMode }: { initialMode?: Experience }) {
  const { locale, dict } = useI18n();
  const ar = locale === "ar";
  const [mode, setMode] = useState<Experience>(initialMode ?? "kashta");
  const [loads, setLoads] = useState<Partial<Record<Experience, Load>>>({});
  const [farther, setFarther] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [mapOpen, setMapOpen] = useState(false);
  const started = useRef(new Set<Experience>());

  const load = useCallback(async (experience: Experience, force = false) => {
    if (started.current.has(experience) && !force) return;
    started.current.add(experience);
    setLoads((l) => ({ ...l, [experience]: { s: "loading" } }));
    const res = await callApi<PlanResponse>("/api/plan", {
      method: "POST",
      body: JSON.stringify({ ...DEFAULT_PREFS, experience, date: "flexible", maxDriveHours: FAR_HOURS }),
    });
    setLoads((l) => ({ ...l, [experience]: res.ok ? { s: "ok", data: res.data } : { s: "error", code: res.code } }));
  }, []);

  useEffect(() => {
    const start = initialMode ?? loadPrefs().experience;
    if (initialMode) savePrefs({ ...loadPrefs(), experience: initialMode });
    // Start in the linked mode, or the one used last; fetch it once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(start);
    void load(start);
  }, [initialMode, load]);

  const choose = (next: Experience) => {
    setMode(next);
    savePrefs({ ...loadPrefs(), experience: next });
    const url = new URL(window.location.href);
    url.searchParams.set("mode", next);
    window.history.replaceState(null, "", url);
    void load(next);
  };

  const state = loads[mode] ?? { s: "loading" };
  const data = state.s === "ok" ? state.data : null;
  // Fetched once up to 5 h; the default view keeps to the same ~3 h as the rest of the app.
  const all = (data ? bestNights(data) : []).filter((r) => farther || r.hours <= NEAR_HOURS);
  const sorted = [...all].sort((a, b) => (b.best?.score ?? -1) - (a.best?.score ?? -1) || a.hours - b.hours);
  const byScore = sorted;
  const rows = showAll ? sorted : sorted.slice(0, SHORT_LIST);
  const bestScores = Object.fromEntries(all.map((r) => [r.d.slug, r.best?.score ?? null]));
  const topSlug = byScore[0]?.best ? byScore[0].d.slug : undefined;
  const unverified = DESTINATIONS.filter((d) => d.permit.status === "unverified");

  const dash = "—";
  const gust = (m?: NightSummary) => (m?.maxGust == null ? dash : `${Math.round(m.maxGust)} ${ar ? "كم/س" : "km/h"}`);
  const temp = (m?: NightSummary) => (m?.eveningTemp == null ? dash : ltr(`${Math.round(m.eveningTemp)}°`));
  const cloud = (m?: NightSummary) => (m?.meanCloud == null ? dash : ltr(`${Math.round(m.meanCloud)}%`));
  const moonless = (m?: NightSummary) =>
    !m ? dash : ar ? arHoursOf(m.moonFreeDarkHours, m.darkHours) : `${Math.round(m.moonFreeDarkHours)} of ${Math.round(m.darkHours)} h`;

  // Mode decides which facts lead: the sky for stargazing, wind and warmth for a kashta.
  const facts =
    mode === "stars"
      ? [
          { head: ar ? "الغيم" : "Cloud", value: cloud },
          { head: ar ? "ظلام بلا قمر" : "Moonless dark", value: moonless },
        ]
      : [
          { head: ar ? "أقوى هبة" : "Strongest gust", value: gust },
          { head: ar ? "أول الليل" : "Evening", value: temp },
        ];
  const reasonHead = (re: Reason) => (re.tone === "caution" ? dict.reasons.caution[re.factor] : dict.reasons.good[re.factor][re.tier === "high" ? "high" : "ok"]);
  const noWeek = ar ? "ما فيه تقييم مكتمل هالأسبوع." : "No complete score this week.";
  const href = (r: Row) => `/destinations/${r.d.slug}?${r.best ? `night=${r.best.date}&` : ""}exp=${mode}`;
  const toggleDetails = (slug: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  return (
    <div data-mode={mode}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <ModeSwitch tone="sand" value={mode} onChange={choose} legend={dict.home.modeLegend} />
        <button
          type="button"
          className="choice min-h-11"
          aria-pressed={farther}
          onClick={() => { setFarther((v) => !v); setShowAll(false); }}
          style={farther ? { background: "var(--color-olive)", color: "var(--color-sand)" } : undefined}
        >
          {ar ? "ضمّن الأبعد (حتى 5 ساعات تقريبًا)" : "Include farther places (up to ~5 h)"}
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
        <section aria-label={ar ? "الأماكن" : "Places"} aria-live="polite" aria-busy={state.s === "loading"} className="min-w-0">
          {state.s === "loading" && (
            <div className="grid gap-3 md:grid-cols-2" aria-hidden>
              {Array.from({ length: SHORT_LIST }, (_, i) => <Skeleton key={i} className="h-40 !rounded-xl" />)}
            </div>
          )}
          {state.s === "error" && <ErrorState code={state.code} onRetry={() => load(mode, true)} />}
          {data && !data.airQuality.available && <p className="mb-4 bg-sand-2 p-3">{dict.plan.airDown}</p>}

          {data && rows.length > 0 && (
            <>
              <ol className="grid gap-3 md:grid-cols-2">
                {rows.map((r) => {
                  const reason = r.best ? nightReasons(r.best, r.m, 1) : [];
                  const rt = rating(r.best?.score ?? null);
                  const isOpen = open.has(r.d.slug);
                  const detailsId = `place-more-${r.d.slug}`;
                  const PermitIcon = r.d.permit.status === "permit_required" || r.d.permit.status === "verified_permitted" ? ShieldCheck : ShieldAlert;
                  return (
                    <li key={r.d.slug} className="flex flex-col rounded-xl border border-ink/15 bg-sand p-4">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <Link href={href(r)} className="link inline-flex min-h-11 items-center font-medium">{r.d.name[locale]}</Link>
                        <span
                          className="small shrink-0 rounded-full px-2.5 py-0.5 font-medium"
                          style={r.best ? { background: RATING_COLOR[rt], color: "#fff" } : { border: "1px solid var(--color-ink-2)", color: "var(--color-ink-2)" }}
                        >
                          {r.best ? dict.rating[rt] : dict.rating.unknown}
                        </span>
                      </div>

                      {r.best && reason[0] ? (
                        <p className="mt-2 flex items-center gap-2">
                          <ReasonIcon reason={reason[0]} />
                          <span>{reasonHead(reason[0])}</span>
                        </p>
                      ) : !r.best ? (
                        <p className="small mt-2 text-ink-2">{noWeek}</p>
                      ) : null}

                      <p className="small mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2">
                        <span className="inline-flex items-center gap-1.5" title={dict.common.estimateNote}>
                          <Car aria-hidden size={15} />
                          <bdi className="num">{approxHours(r.hours, locale)}</bdi>
                          <span>{ar ? "(تقدير)" : "(est.)"}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <PermitIcon aria-hidden size={15} />
                          {dict.permit.short[r.d.permit.status]}
                        </span>
                      </p>

                      <div className="mt-auto pt-1">
                        <button
                          type="button"
                          className="small inline-flex min-h-11 items-center gap-1 font-medium"
                          aria-expanded={isOpen}
                          aria-controls={detailsId}
                          onClick={() => toggleDetails(r.d.slug)}
                        >
                          {ar ? "التفاصيل" : "More details"}
                          <ChevronDown aria-hidden size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        <div id={detailsId} hidden={!isOpen} className="small border-t border-ink/10 pt-3">
                          {r.best && (
                            <>
                              <p>
                                <span className="text-ink-2">{ar ? "أحسن ليلة: " : "Best night: "}</span>
                                <span className="font-medium">{formatNight(r.best.date, locale)}</span>
                              </p>
                              <p className="mt-1">
                                <span className="font-medium">{ar ? <>التقييم <bdi className="num">{r.best.score}</bdi> من 100</> : <>Score <bdi className="num">{r.best.score}</bdi> of 100</>}</span>
                                <span className="block text-ink-2">{ar ? "يُحسب من توقعات الطقس والقمر لهالليلة." : "Calculated from that night's weather and moon forecast."}</span>
                              </p>
                              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                {facts.map((f) => (
                                  <div key={f.head}>
                                    <dt className="text-ink-2">{f.head}</dt>
                                    <dd className="num whitespace-nowrap font-medium">{f.value(r.m)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </>
                          )}
                          <Link href={href(r)} className="link mt-2 inline-flex min-h-11 items-center font-medium">{dict.common.viewDestination}</Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <p className="small mt-4 text-ink-2">
                {farther
                  ? ar ? "تشوف الحين الأماكن اللي مشوارها حتى 5 ساعات تقريبًا." : "Now showing places up to ~5 h away."
                  : ar ? "نعرض الأماكن اللي مشوارها حوالي 3 ساعات أو أقل، مثل الصفحة الرئيسية والمخطط." : "We show places about 3 h away or less, same as the homepage and planner."}
              </p>
              {sorted.length > SHORT_LIST && (
                <button type="button" className="btn-quiet mt-5" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                  {showAll
                    ? ar ? `اعرض أول ${SHORT_LIST} بس` : `Show top ${SHORT_LIST} only`
                    : ar ? `اعرض كل الأماكن (${sorted.length})` : `Show all ${sorted.length} places`}
                </button>
              )}
            </>
          )}

          {unverified.length > 0 && (
            <p className="small mt-8 text-ink-2">
              {unverified.map((d, i) => (
                <span key={d.slug}>
                  {i > 0 && (ar ? "، " : ", ")}
                  <Link className="link" href={`/destinations/${d.slug}`}>{d.name[locale]}</Link>
                </span>
              ))}
              {": "}
              {dict.permit.excluded}
            </p>
          )}
        </section>

        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <button
            type="button"
            className="btn-quiet w-full justify-center lg:hidden"
            aria-expanded={mapOpen}
            aria-controls="places-map"
            onClick={() => setMapOpen((v) => !v)}
          >
            <MapIcon aria-hidden size={17} />
            {mapOpen ? (ar ? "أخفِ الخريطة" : "Hide map") : ar ? "على الخريطة" : "Show on map"}
          </button>
          {/* One map: always shown on large screens, opened on request on small ones. */}
          <div id="places-map" className={`${mapOpen ? "mt-4 block" : "hidden"} lg:mt-0 lg:block`}>
            <CoverageMap legendText={ar ? "لون النقطة = أنسب ليلة للمكان هالأسبوع" : "Dot colour = the place's best night this week"} compact legend={false} scores={data ? bestScores : undefined} pick={topSlug} mode={mode} />
          </div>
        </div>
      </div>
    </div>
  );
}
