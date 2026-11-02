"use client";

import type { HourPoint } from "@/lib/types";
import { useI18n } from "./locale-provider";

/**
 * Hour-by-hour chart for one night (18:00–05:00): temperature as a line, gusts as bars.
 * Time runs left to right in both languages, like a clock face; a data table follows for
 * screen readers and anyone who prefers numbers.
 */
export function NightChart({ hours, dark = false }: { hours: HourPoint[]; dark?: boolean }) {
  const { dict } = useI18n();
  if (hours.length === 0) return null;

  const W = 640;
  const H = 240;
  const pad = { l: 34, r: 12, t: 26, b: 40 };
  const temps = hours.map((h) => h.temp).filter((v): v is number => v !== null);
  const gusts = hours.map((h) => h.gust).filter((v): v is number => v !== null);
  const tMin = Math.floor(Math.min(...temps, 40) - 1);
  const tMax = Math.ceil(Math.max(...temps, -10) + 1);
  const gMax = Math.max(40, ...gusts);
  const step = (W - pad.l - pad.r) / hours.length;
  const x = (i: number) => pad.l + step * i + step / 2;
  const tempTop = pad.t;
  const tempBottom = H * 0.55;
  const y = (t: number) => tempBottom - ((t - tMin) / Math.max(1, tMax - tMin)) * (tempBottom - tempTop);
  const barBase = H - pad.b;
  const barTop = H * 0.62;
  const barH = (g: number) => (g / gMax) * (barBase - barTop);

  const line = hours
    .map((h, i) => (h.temp === null ? null : `${x(i).toFixed(1)},${y(h.temp).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");

  const ink = dark ? "#e8e7e4" : "#1f1d1a";
  const soft = dark ? "#b9b3a7" : "#4b453d";
  const bar = dark ? "#6b7280" : "#a4492a";

  return (
    <figure data-ui>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" direction="ltr" role="img" aria-label={`${dict.detail.tempLine} / ${dict.detail.gustBars}`}>
        {hours.map((h, i) =>
          h.gust === null ? null : (
            <g key={`g${h.time}`}>
              <rect x={x(i) - step * 0.3} y={barBase - barH(h.gust)} width={step * 0.6} height={barH(h.gust)} fill={bar} opacity={0.85} />
              {i % 2 === 0 && (
                <text x={x(i)} y={barBase - barH(h.gust) - 5} textAnchor="middle" fontSize="12" fill={soft}>
                  {Math.round(h.gust)}
                </text>
              )}
            </g>
          ),
        )}
        <polyline points={line} fill="none" stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />
        {hours.map((h, i) =>
          h.temp === null ? null : (
            <g key={`t${h.time}`}>
              <circle cx={x(i)} cy={y(h.temp)} r={3.5} fill={ink} />
              {i % 2 === 0 && (
                <text x={x(i)} y={y(h.temp) - 10} textAnchor="middle" fontSize="13" fill={ink} fontWeight={500}>
                  {Math.round(h.temp)}°
                </text>
              )}
            </g>
          ),
        )}
        {hours.map((h, i) =>
          i % 2 === 0 ? (
            <text key={`x${h.time}`} x={x(i)} y={H - 14} textAnchor="middle" fontSize="12" fill={soft}>
              {h.time.slice(11, 16)}
            </text>
          ) : null,
        )}
        <text x={4} y={tempTop - 8} fontSize="12" fill={soft}>°C</text>
        <text x={4} y={barTop - 4} fontSize="12" fill={soft}>km/h</text>
      </svg>
      <figcaption className={`small mt-2 flex flex-wrap gap-x-6 gap-y-1 ${dark ? "text-star-2" : "text-ink-2"}`}>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-0.5 w-5" style={{ background: ink }} />
          {dict.detail.tempLine} (°C)
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block size-3" style={{ background: bar }} />
          {dict.detail.gustBars} (km/h)
        </span>
      </figcaption>
      <details className="small mt-3">
        <summary className="inline-flex min-h-11 items-center font-medium">{dict.common.showNumbers}</summary>
        <div className="overflow-x-auto">
          <table className="num mt-2 w-full min-w-[34rem] text-start">
            <thead>
              <tr className={dark ? "text-star-2" : "text-ink-2"}>
                <th className="py-1 text-start font-normal">⏱</th>
                <th className="py-1 text-start font-normal">{dict.factor.temp} °C</th>
                <th className="py-1 text-start font-normal">{dict.factor.wind} km/h</th>
                <th className="py-1 text-start font-normal">{dict.factor.rain} %</th>
                <th className="py-1 text-start font-normal">{dict.factor.clouds} %</th>
                <th className="py-1 text-start font-normal">{dict.factor.dust} μg/m³</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h.time}>
                  <td className="py-1" dir="ltr">{h.time.slice(11, 16)}</td>
                  <td className="py-1">{h.temp ?? "—"} / {h.feels ?? "—"}</td>
                  <td className="py-1">{h.wind ?? "—"} / {h.gust ?? "—"}</td>
                  <td className="py-1">{h.precipProb ?? "—"}</td>
                  <td className="py-1">{h.cloud ?? "—"}</td>
                  <td className="py-1">{h.dust ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
