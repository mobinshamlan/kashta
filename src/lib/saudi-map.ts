/**
 * The national map shared by every KASHTA map: Saudi Arabia's outline and one fixed projection.
 *
 * Outline: Natural Earth 1:50m admin-0 countries (public domain, naturalearthdata.com), simplified
 * (Douglas-Peucker, 0.04 degrees) to keep the bundle small. It shows the country's shape for
 * orientation; it is not an official boundary.
 */

/** [lon, lat] rings: the mainland and the larger Red Sea islands. */
const OUTLINE: [number, number][][] = [
  [[36.9, 25.38], [36.53, 25.6], [36.53, 25.69], [36.95, 25.41], [36.9, 25.38]],
  [[41.99, 16.72], [42.07, 16.71], [42.06, 16.8], [42.17, 16.71], [42.16, 16.57], [42.07, 16.67], [41.96, 16.65], [41.8, 16.78], [41.78, 16.85], [41.86, 16.89], [41.86, 17.0], [41.95, 16.94], [41.99, 16.72]],
  [[51.98, 19.0], [49.04, 18.58], [48.17, 18.16], [47.58, 17.45], [47.44, 17.11], [47.14, 16.95], [46.98, 16.95], [46.73, 17.27], [46.31, 17.23], [45.54, 17.3], [45.15, 17.43], [44.16, 17.4], [43.92, 17.32], [43.42, 17.52], [43.19, 17.36], [43.24, 17.27], [43.16, 17.21], [43.12, 16.94], [43.18, 16.81], [43.17, 16.69], [42.8, 16.37], [42.7, 16.74], [42.38, 17.12], [42.29, 17.43], [41.75, 17.89], [41.43, 18.45], [41.23, 18.68], [41.12, 19.08], [40.76, 19.76], [40.08, 20.27], [39.73, 20.39], [39.28, 20.97], [39.09, 21.31], [39.15, 21.52], [38.99, 21.88], [39.1, 22.39], [39.06, 22.59], [38.46, 23.71], [37.92, 24.19], [37.54, 24.29], [37.18, 24.82], [37.27, 24.96], [37.15, 25.29], [36.92, 25.64], [36.76, 25.75], [36.68, 26.04], [36.52, 26.1], [36.25, 26.59], [35.18, 28.03], [34.72, 28.13], [34.62, 28.06], [34.78, 28.51], [34.95, 29.35], [36.07, 29.2], [36.48, 29.5], [36.76, 29.87], [37.47, 30.0], [37.65, 30.33], [37.98, 30.5], [36.96, 31.49], [38.96, 31.99], [39.15, 32.12], [40.37, 31.94], [42.07, 31.08], [44.69, 29.2], [47.43, 28.99], [47.67, 28.53], [48.44, 28.54], [48.63, 28.13], [48.81, 27.9], [48.8, 27.72], [49.24, 27.49], [49.18, 27.44], [49.41, 27.18], [49.54, 27.15], [49.72, 26.96], [49.99, 26.83], [50.15, 26.66], [50.01, 26.68], [50.03, 26.53], [50.18, 26.4], [50.21, 26.31], [50.16, 26.1], [50.03, 26.11], [50.08, 25.96], [50.24, 25.62], [50.46, 25.42], [50.56, 25.09], [50.86, 24.68], [50.97, 24.57], [51.41, 24.57], [51.31, 24.34], [51.57, 24.29], [51.59, 24.08], [52.56, 22.93], [55.1, 22.62], [55.19, 22.7], [55.64, 22.0], [54.98, 20.0], [51.98, 19.0]],
];

/** The map is centred on the country, not on the start city, so the frame never moves. */
const CENTER = { lat: 24, lon: 45 };
const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LON = Math.cos((CENTER.lat * Math.PI) / 180) * 111.32;

/** Projects to km east (x) and south (y) of the country's centre; north is up. */
export function projectSA(p: { lat: number; lon: number }) {
  return { x: (p.lon - CENTER.lon) * KM_PER_DEG_LON, y: -(p.lat - CENTER.lat) * KM_PER_DEG_LAT };
}

/** The outline as one SVG path in map km. */
export const SAUDI_PATH = OUTLINE.map(
  (ring) => ring.map(([lon, lat], i) => { const q = projectSA({ lat, lon }); return `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join("") + "Z",
).join("");

/** The whole country plus a margin, in map km: every map shows all of it. */
export const SAUDI_FRAME = (() => {
  const pts = OUTLINE.flat().map(([lon, lat]) => projectSA({ lat, lon }));
  const m = 70;
  const minX = Math.min(...pts.map((p) => p.x)) - m, maxX = Math.max(...pts.map((p) => p.x)) + m;
  const minY = Math.min(...pts.map((p) => p.y)) - m, maxY = Math.max(...pts.map((p) => p.y)) + m;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
})();

/** Faint orientation labels, placed over open water. */
export const SEAS = [
  { at: projectSA({ lat: 22.6, lon: 37.6 }), name: { ar: "البحر الأحمر", en: "Red Sea" }, rotate: 60 },
  { at: projectSA({ lat: 27.4, lon: 50.9 }), name: { ar: "الخليج العربي", en: "Arabian Gulf" }, rotate: 40 },
] as const;
