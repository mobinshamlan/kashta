"use client";

import { useId } from "react";
import type { Experience } from "@/lib/types";

/**
 * Decorative night over the dunes, composed per activity.
 * Kashta: the bayt al-sha'r and its fire lead. Stargazing: the sky and the Milky Way lead.
 * An illustration only: no moon is drawn, so nothing in it can be read as tonight's forecast.
 */

type Star = { x: number; y: number; r: number; o: number; twinkle: boolean };

// Deterministic stars so server and client render the same sky.
function stars(count: number, seed: number, maxY: number, rMin: number, rRange: number): Star[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => {
    const y = Math.pow(rand(), 1.25) * maxY;
    return { x: rand() * 1440, y, r: rMin + rand() * rRange, o: 0.3 + rand() * 0.65, twinkle: i % 9 === 0 };
  });
}

/** Extra stars packed along the Milky Way band (a line from lower-left to upper-right). */
function bandStars(count: number, seed: number): Star[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, () => {
    const t = rand();
    const spread = (rand() + rand() + rand() - 1.5) * 120; // roughly normal across the band
    const x = -60 + t * 1560 + spread * 0.45;
    const y = 640 - t * 620 + spread;
    return { x, y, r: 0.35 + rand() * 0.8, o: 0.35 + rand() * 0.55, twinkle: false };
  }).filter((st) => st.y > 0 && st.y < 600 && st.x > 0 && st.x < 1440);
}

const KASHTA_SKY = stars(150, 20261103, 560, 0.5, 1.2);
const STARS_FIELD = stars(330, 7041447, 600, 0.35, 0.9);
const STARS_BAND = bandStars(260, 91722);
const BRIGHT = [
  [190, 120], [362, 268], [540, 92], [688, 210], [812, 330], [930, 150],
  [1090, 260], [1196, 96], [1318, 196], [260, 420], [1000, 420], [1380, 380],
] as const;

function StarDots({ list, fill }: { list: Star[]; fill: string }) {
  return (
    <g fill={fill}>
      {list.map((st, i) => (
        <circle key={i} className={st.twinkle ? "twinkle" : undefined} cx={st.x.toFixed(1)} cy={st.y.toFixed(1)} r={st.r.toFixed(2)} opacity={st.o.toFixed(2)} />
      ))}
    </g>
  );
}

/** Bayt al-sha'r: low, wide, flat ridge on several poles, front open toward the fire. */
function Tent({ lit }: { lit: boolean }) {
  return (
    <g>
      <path d="M0 62 L 14 20 L 52 8 L 92 14 L 132 6 L 172 14 L 212 8 L 246 22 L 262 62 Z" fill="#0d0b0c" />
      <path d="M14 20 L 52 8 L 92 14 L 132 6 L 172 14 L 212 8 L 246 22" stroke="#2b2426" strokeWidth="1.5" fill="none" />
      <path d="M30 62 L 30 30 M 236 62 L 236 30" stroke="#2b2426" strokeWidth="1.2" />
      <path d="M6 50 L 256 50" stroke="#94482f" strokeWidth="2.2" strokeDasharray="6 4" opacity="0.8" />
      <path d="M70 62 L 82 30 L 150 30 L 160 62 Z" fill="#3b2418" />
      {lit && <path d="M70 62 L 82 30 L 150 30 L 160 62 Z" fill="#e8894a" opacity="0.32" />}
      <path d="M14 20 L -26 64 M 246 22 L 290 64" stroke="#3a3236" strokeWidth="1" />
    </g>
  );
}

/**
 * One world, two framings. The camp, the sky and the dunes are always drawn; switching mode moves
 * a camera (CSS transform on `.ns-camera`) between a close shot of the camp (kashta) and the wide
 * sky (stargazing), while the sky tint, the Milky Way and the fire light cross-fade. The framing
 * comes from `data-scene` on the svg itself, so a planner tile can show the other mode.
 */
/** `tile`: a short, wide frame (planner choices) where stargazing must show sky, not ground. */
export function NightScene({ className = "", mode, tile = false }: { className?: string; mode?: Experience; tile?: boolean }) {
  // Several scenes can share a page (hero + planner tiles): gradient and filter ids must be unique.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `ns-${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <svg className={`night-scene ${className}`} data-scene={mode === "stars" ? "stars" : "kashta"} viewBox="0 0 1440 900" preserveAspectRatio={tile && mode === "stars" ? "xMidYMid slice" : "xMidYMax slice"} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id("sky-cool")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05080f" />
          <stop offset="0.55" stopColor="#0e1530" />
          <stop offset="0.8" stopColor="#1a2140" />
        </linearGradient>
        <linearGradient id={id("sky-warm")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1424" />
          <stop offset="0.5" stopColor="#1a1a2e" />
          <stop offset="0.85" stopColor="#3a2630" />
        </linearGradient>
        <linearGradient id={id("band")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#a9c4e8" stopOpacity="0.05" />
          <stop offset="0.35" stopColor="#c9d6f0" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#efe2cf" stopOpacity="0.42" />
          <stop offset="0.75" stopColor="#c9d6f0" stopOpacity="0.28" />
          <stop offset="1" stopColor="#a9c4e8" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id={id("core")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f6e6cc" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#d9c7b0" stopOpacity="0.18" />
          <stop offset="1" stopColor="#d9c7b0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("glint")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#cfe0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("glow")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e8894a" stopOpacity="0.65" />
          <stop offset="0.45" stopColor="#e8894a" stopOpacity="0.18" />
          <stop offset="1" stopColor="#e8894a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("horizon")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a4232" stopOpacity="0" />
          <stop offset="1" stopColor="#6a4232" stopOpacity="0.55" />
        </linearGradient>
        <filter id={id("blur-wide")} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="38" />
        </filter>
        <filter id={id("blur-mid")} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={id("blur-lane")} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* The sky itself does not move; its tint cross-fades between the two moods. */}
      <rect width="1440" height="900" fill={url("sky-cool")} />
      <rect className="ns-warm" width="1440" height="900" fill={url("sky-warm")} />

      <g className="ns-camera">
        {/* The deep sky: Milky Way, dense field, bright glints. Faint from the camp, full when wide. */}
        <g className="ns-deep">
          <path d="M-80 690 C 260 520, 640 380, 1520 30 L 1520 230 C 900 430, 420 600, -80 860 Z" fill={url("band")} filter={url("blur-wide")} />
          <path d="M-40 680 C 300 540, 700 400, 1500 70 L 1500 150 C 860 400, 380 590, -40 760 Z" fill={url("band")} filter={url("blur-mid")} />
          <ellipse cx="760" cy="350" rx="260" ry="110" transform="rotate(-24 760 350)" fill={url("core")} filter={url("blur-mid")} />
          <path d="M120 640 C 380 540, 640 440, 900 340 C 1040 290, 1180 240, 1340 170" stroke="#05080f" strokeWidth="22" fill="none" opacity="0.55" filter={url("blur-lane")} />
          <path d="M520 470 C 640 420, 760 380, 880 330" stroke="#05080f" strokeWidth="12" fill="none" opacity="0.5" filter={url("blur-lane")} />
          <StarDots list={STARS_FIELD} fill="#e6edf9" />
          <StarDots list={STARS_BAND} fill="#f3eee4" />
          <g>
            {BRIGHT.map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`} className={i % 3 === 0 ? "twinkle" : undefined}>
                <circle r="7" fill={url("glint")} opacity="0.55" />
                <path d="M0 -9 L 0.9 0 L 0 9 L -0.9 0 Z M -9 0 L 0 0.9 L 9 0 L 0 -0.9 Z" fill="#ffffff" opacity="0.75" />
                <circle r="1.6" fill="#ffffff" />
              </g>
            ))}
          </g>
        </g>
        <StarDots list={KASHTA_SKY} fill="#f1efe9" />
        <rect className="ns-warm" x="0" y="480" width="1440" height="230" fill={url("horizon")} />

        {/* Escarpment and dunes. */}
        <path d="M0 640 L 140 628 L 210 610 L 420 606 L 470 618 L 700 612 L 760 598 L 1010 596 L 1060 612 L 1300 606 L 1440 616 L 1440 900 L 0 900 Z" fill="#141a2e" />
        <path d="M0 696 C 180 668, 340 668, 520 684 C 690 700, 820 678, 980 668 C 1130 658, 1290 676, 1440 688 L 1440 900 L 0 900 Z" fill="#1b1a28" />

        {/* The camp: one place in the world. Close up it fills the frame; wide, it is a speck. */}
        <ellipse className="ns-fireglow" cx="650" cy="716" rx="230" ry="70" fill={url("glow")} />
        <g transform="translate(500 668) scale(0.55)">
          <Tent lit />
        </g>
        <g transform="translate(700 712) scale(0.55)">
          <path d="M-16 14 L 16 6 M -16 6 L 16 14" stroke="#4a2c1f" strokeWidth="3" strokeLinecap="round" />
          <g className="ns-flame">
            <path className="fire" d="M0 -22 C 7 -12, 12 -6, 9 4 C 7 10, -7 10, -9 4 C -12 -5, -4 -10, 0 -22 Z" fill="#f2a65a" />
            <path className="fire" d="M1 -10 C 5 -4, 6 0, 4 5 C 2 8, -3 8, -4 5 C -6 0, -2 -4, 1 -10 Z" fill="#ffd9a0" />
          </g>
          <g transform="translate(30 -2)" fill="#0d0b0c">
            <path d="M-6 14 L -5 2 C -5 -3, 5 -3, 5 2 L 6 14 Z" />
            <path d="M-3 -2 L -2 -8 L 2 -8 L 3 -2 Z" />
            <path d="M5 2 C 10 0, 12 -4, 15 -7" stroke="#0d0b0c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
          {/* Two people seated by the fire, looking up. */}
          <g transform="translate(-74 2)" fill="#0d0b0c">
            <circle cx="0" cy="-2" r="6" />
            <path d="M-7 4 L 7 4 L 11 16 L -11 16 Z" />
          </g>
        </g>

        <path d="M0 790 C 220 770, 420 776, 640 786 C 860 798, 1080 780, 1260 770 C 1350 764, 1400 766, 1440 770 L 1440 900 L 0 900 Z" fill="#17151f" />
      </g>
    </svg>
  );
}
