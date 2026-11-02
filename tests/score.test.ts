import assert from "node:assert/strict";
import { test } from "node:test";
import { ramp, rating, scoreNight, weightsFor } from "../src/lib/score";
import type { NightMetrics } from "../src/lib/types";

function night(over: Partial<NightMetrics> = {}): NightMetrics {
  return {
    date: "2026-11-04",
    eveningTemp: 18,
    minTemp: 12,
    minFeels: 11,
    maxWind: 12,
    maxGust: 18,
    maxPrecipProb: 0,
    totalPrecip: 0,
    meanCloud: 5,
    maxDust: 40,
    meanDust: 30,
    maxPm10: 60,
    sunset: "17:13",
    duskAstro: "18:30",
    dawnAstro: "04:43",
    moonIllumination: 0.1,
    moonWaxing: true,
    moonFreeDarkHours: 9,
    darkHours: 10,
    hours: [],
    ...over,
  };
}

const prefs = { experience: "kashta" as const, tempPref: "mild" as const, windTolerance: "medium" as const, priorities: [] };

test("ramp is 100 at good, 0 at bad, linear between", () => {
  assert.equal(ramp(10, 10, 70), 100);
  assert.equal(ramp(70, 10, 70), 0);
  assert.equal(ramp(40, 10, 70), 50);
});

test("calm, clear, comfortable night scores excellent", () => {
  const s = scoreNight("x", night(), prefs);
  assert.equal(s.assessment, "complete");
  assert.ok(s.score !== null && s.score >= 90, `score ${s.score}`);
  assert.equal(rating(s.score), "excellent");
});

test("missing dust data gives an incomplete assessment and no score", () => {
  const s = scoreNight("x", night({ maxDust: null }), prefs);
  assert.equal(s.assessment, "incomplete");
  assert.equal(s.score, null);
  assert.deepEqual(s.missing, ["dust"]);
});

test("a single dangerous condition caps the score at 35", () => {
  const s = scoreNight("x", night({ maxDust: 803 }), prefs);
  assert.deepEqual(s.dealbreakers, ["dust"]);
  assert.ok(s.score !== null && s.score <= 35);
});

test("wind tolerance changes the wind factor", () => {
  const m = night({ maxGust: 40 });
  const low = scoreNight("x", m, { ...prefs, windTolerance: "low" });
  const high = scoreNight("x", m, { ...prefs, windTolerance: "high" });
  const w = (s: typeof low) => s.factors.find((f) => f.factor === "wind")!.score!;
  assert.equal(w(low), 0);
  assert.equal(w(high), 100);
});

test("stargazing uses the moon factor and kashta does not", () => {
  const k = scoreNight("x", night(), prefs);
  const st = scoreNight("x", night(), { ...prefs, experience: "stars" });
  assert.ok(!k.factors.some((f) => f.factor === "moon"));
  assert.ok(st.factors.some((f) => f.factor === "moon"));
});

test("priorities boost a factor's weight and weights still sum to 1", () => {
  const base = weightsFor("kashta", []);
  const boosted = weightsFor("kashta", ["dust"]);
  assert.ok(boosted.dust! > base.dust!);
  const sum = Object.values(boosted).reduce((a, b) => a + (b ?? 0), 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("a bright moon lowers the stargazing score", () => {
  const dark = scoreNight("x", night({ moonIllumination: 0.02, moonFreeDarkHours: 10 }), { ...prefs, experience: "stars" });
  const bright = scoreNight("x", night({ moonIllumination: 0.98, moonFreeDarkHours: 0 }), { ...prefs, experience: "stars" });
  assert.ok(dark.score! > bright.score!);
});
