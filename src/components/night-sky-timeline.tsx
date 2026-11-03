"use client";

import { useMemo, useState } from "react";
import type { NightMetrics } from "@/lib/types";
import { calculateSkyTimeline } from "@/lib/sky-timeline";
import { useI18n } from "./locale-provider";

function forecastEpoch(time: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/.exec(time);
  if (!match) return null;
  const epoch = Date.parse(`${match[1]}:00+03:00`);
  return Number.isFinite(epoch) ? epoch : null;
}

function clockLabel(epoch: number, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Riyadh",
  }).format(new Date(epoch));
}

function numberLabel(value: number | null, locale: string, unit: string) {
  if (value === null) return "—";
  const number = new Intl.NumberFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    maximumFractionDigits: 1,
  }).format(value);
  return `${number}${unit}`;
}

function WeatherValue({ label, value, locale, unit }: { label: string; value: number | null; locale: string; unit: string }) {
  return (
    <div className="min-w-0">
      <dt className="small truncate text-star-2">{label}</dt>
      <dd className="num mt-0.5 font-medium" dir="ltr">{numberLabel(value, locale, unit)}</dd>
    </div>
  );
}

export function NightSkyTimeline({ metrics, lat, lon }: { metrics: NightMetrics; lat: number; lon: number }) {
  const { locale, dict } = useI18n();
  const t = dict.detail;
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const calculation = useMemo(() => calculateSkyTimeline(metrics.date, lat, lon), [metrics.date, lat, lon]);
  const readings = useMemo(() => metrics.hours.flatMap((point) => {
    const epoch = forecastEpoch(point.time);
    if (epoch === null) return [];
    if (calculation && (epoch < calculation.sunset || epoch > calculation.astronomicalDawn)) return [];
    return [{ point, epoch }];
  }), [metrics.hours, calculation]);
  const selected = readings.find(({ point }) => point.time === selectedTime) ?? readings[0] ?? null;

  const start = calculation?.sunset ?? 0;
  const dusk = calculation?.astronomicalDusk ?? 0;
  const dawn = calculation?.astronomicalDawn ?? 1;
  const mapX = (time: number) => 24 + ((time - start) / Math.max(1, dawn - start)) * 672;
  const selectedX = selected && calculation ? mapX(selected.epoch) : null;
  const ariaLabel = `${t.timelineLead}. ${t.twilightBand}, ${t.darkBand}, ${t.moonAbove}.`;
  const tempUnit = locale === "ar" ? "°م" : "°C";
  const windUnit = locale === "ar" ? " كم/س" : " km/h";
  const cloudUnit = locale === "ar" ? "٪" : "%";

  return (
    <div className="on-dark mt-5 min-w-0 bg-night p-4 text-star sm:p-6">
      <p className="lead font-light">{t.timelineLead}</p>
      <div className="small mt-2 flex flex-wrap gap-x-5 gap-y-2 text-star-2">
        <span>{t.forecastLegend} · Open-Meteo</span>
        <span>{t.calculatedLegend}</span>
      </div>

      {calculation ? (
        <figure className="mt-6 min-w-0">
          <div className="min-w-0" dir="ltr">
            <svg viewBox="0 0 720 132" className="h-auto w-full" role="img" aria-label={ariaLabel}>
              <rect x="24" y="34" width="672" height="29" rx="4" fill="var(--color-night-2)" />
              <rect x="24" y="34" width={Math.max(0, mapX(dusk) - 24)} height="29" rx="4" fill="var(--color-clay)" opacity="0.82" />
              <rect x={mapX(dusk)} y="34" width={Math.max(0, 696 - mapX(dusk))} height="29" rx="4" fill="var(--color-olive)" />

              {readings.map(({ point, epoch }) => {
                const x = mapX(epoch);
                const active = selected?.point.time === point.time;
                return (
                  <g key={point.time}>
                    <line x1={x} x2={x} y1="27" y2="34" stroke="var(--color-star-2)" strokeWidth="1.5" />
                    <circle cx={x} cy="20" r={active ? 5 : 3.2} fill={active ? "var(--color-star)" : "var(--color-star-2)"} />
                  </g>
                );
              })}

              <line x1="24" x2="24" y1="28" y2="113" stroke="var(--color-star-2)" strokeWidth="1" />
              <line x1={mapX(dusk)} x2={mapX(dusk)} y1="28" y2="113" stroke="var(--color-star-2)" strokeWidth="1" strokeDasharray="3 4" opacity="0.75" />
              <line x1="696" x2="696" y1="28" y2="113" stroke="var(--color-star-2)" strokeWidth="1" />

              <rect x="24" y="88" width="672" height="12" rx="6" fill="var(--color-night-3)" />
              {calculation.moonAboveHorizon.map((window) => (
                <rect
                  key={`${window.start}-${window.end}`}
                  x={mapX(window.start)}
                  y="88"
                  width={Math.max(0, mapX(window.end) - mapX(window.start))}
                  height="12"
                  rx="6"
                  fill="var(--color-star)"
                />
              ))}
              {selectedX !== null && <line x1={selectedX} x2={selectedX} y1="15" y2="106" stroke="var(--color-star)" strokeWidth="1" opacity="0.55" />}
            </svg>
          </div>

          <figcaption className="small mt-3 flex flex-wrap gap-x-5 gap-y-2 text-star-2">
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-2 rounded-full bg-star" />{t.forecastLegend}</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 bg-clay" />{t.twilightBand}</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 bg-olive" />{t.darkBand}</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="h-1 w-5 rounded-full bg-star" />{t.moonAbove}</span>
          </figcaption>

          <dl className="small num mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
            <div>
              <dt className="text-star-2">{dict.detail.sunset}</dt>
              <dd className="mt-1" dir="ltr">{clockLabel(calculation.sunset, locale)}</dd>
            </div>
            <div>
              <dt className="text-star-2">{t.twilightBand}</dt>
              <dd className="mt-1" dir="ltr">{clockLabel(calculation.astronomicalDusk, locale)}</dd>
            </div>
            <div>
              <dt className="text-star-2">{dict.detail.dawn}</dt>
              <dd className="mt-1" dir="ltr">{clockLabel(calculation.astronomicalDawn, locale)}</dd>
            </div>
          </dl>
          <p className="small mt-4 text-star-2">{t.calculatedLegend}. {t.moonAbove}; {calculation.moonAboveHorizon.length === 0 ? t.moonBelow : t.moonCaveat}</p>
        </figure>
      ) : (
        <p role="status" className="small mt-5 border-s-2 border-star-2 bg-night-2 p-3 text-star-2">{t.skyCalculationUnavailable}</p>
      )}

      <div className="mt-6 border-t border-white/15 pt-5">
        <p className="small text-star-2">
          {t.forecastLegend} · {dict.factor.temp} {tempUnit} · {dict.factor.wind} {windUnit.trim()} · {dict.factor.clouds} {cloudUnit}
        </p>
        {selected && (
          <div aria-live="polite" className="small mt-3">
            <p>{t.forecastHour}: <time className="num font-medium" dateTime={selected.point.time} dir="ltr">{clockLabel(selected.epoch, locale)}</time></p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-star-2">
              <div className="flex gap-1"><dt>{dict.factor.temp}:</dt><dd className="num" dir="ltr">{numberLabel(selected.point.temp, locale, tempUnit)}</dd></div>
              <div className="flex gap-1"><dt>{dict.factor.wind}:</dt><dd className="num" dir="ltr">{numberLabel(selected.point.wind, locale, windUnit)}</dd></div>
              <div className="flex gap-1"><dt>{dict.factor.clouds}:</dt><dd className="num" dir="ltr">{numberLabel(selected.point.cloud, locale, cloudUnit)}</dd></div>
            </dl>
          </div>
        )}
        {readings.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {readings.map(({ point, epoch }) => {
              const active = selected?.point.time === point.time;
              const label = `${clockLabel(epoch, locale)}. ${dict.factor.temp}: ${numberLabel(point.temp, locale, tempUnit)}. ${dict.factor.wind}: ${numberLabel(point.wind, locale, windUnit)}. ${dict.factor.clouds}: ${numberLabel(point.cloud, locale, cloudUnit)}.`;
              return (
                <button
                  key={point.time}
                  type="button"
                  aria-label={label}
                  aria-pressed={active}
                  className={`min-w-0 border p-3 text-start transition-colors ${active ? "border-star bg-olive text-star" : "border-white/15 bg-night-2 text-star hover:border-star-2"}`}
                  onClick={() => setSelectedTime(point.time)}
                >
                  <time className="num block text-start font-medium" dateTime={point.time} dir="ltr">{clockLabel(epoch, locale)}</time>
                  <dl className="mt-2 grid grid-cols-3 gap-1 text-start">
                    <WeatherValue label={dict.factor.temp} value={point.temp} locale={locale} unit={tempUnit} />
                    <WeatherValue label={dict.factor.wind} value={point.wind} locale={locale} unit={windUnit} />
                    <WeatherValue label={dict.factor.clouds} value={point.cloud} locale={locale} unit={cloudUnit} />
                  </dl>
                </button>
              );
            })}
          </div>
        ) : (
          <p role="status" className="small mt-3 border-s-2 border-star-2 bg-night-2 p-3 text-star-2">{t.noHourlyReadings}</p>
        )}
        <p className="small mt-3 text-star-2">{t.missingHourlyValue}</p>
      </div>
    </div>
  );
}
