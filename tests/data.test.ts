import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChecklist } from "../src/lib/checklist";
import { DESTINATIONS, estimateDrive } from "../src/lib/destinations";
import { DICTS } from "../src/lib/i18n";
import { PHOTOS } from "../src/lib/photos";
import { CITY_IDS } from "../src/lib/types";
import { interpretedPrefsSchema, planPrefsSchema } from "../src/lib/schemas";

test("every destination has a source, a dated permit and a real photo", () => {
  const slugs = new Set<string>();
  for (const d of DESTINATIONS) {
    assert.ok(!slugs.has(d.slug), `duplicate ${d.slug}`);
    slugs.add(d.slug);
    assert.ok(d.lat > 16 && d.lat < 32 && d.lon > 34 && d.lon < 56, `${d.slug} outside Saudi Arabia`);
    assert.match(d.permit.sourceUrl, /^https:\/\//);
    assert.match(d.permit.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(d.sources.length > 0);
    assert.ok(PHOTOS[d.photo], `missing photo ${d.photo}`);
    if (d.permit.status !== "unverified") assert.match(d.permit.sourceUrl, /ncvc\.gov\.sa/);
  }
  assert.ok(DESTINATIONS.length >= 60 && DESTINATIONS.length <= 70);
});

test("drive estimate is positive and plausible from every starting city", () => {
  for (const city of CITY_IDS) {
    for (const d of DESTINATIONS) {
      const e = estimateDrive(d, city);
      // Far pairs (say Jeddah to Al-Ahsa) exceed the planner's limit and are simply not offered; the estimate itself stays sane.
      assert.ok(e.hours > 0 && e.hours < 24, `${d.slug} from ${city} ${e.hours}h`);
    }
  }
});

test("Arabic and English dictionaries have the same shape", () => {
  const keys = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  assert.deepEqual(keys(DICTS.ar).sort(), keys(DICTS.en).sort());
});

test("plan input validation rejects bad values", () => {
  const ok = { experience: "kashta", city: "riyadh", date: "flexible", groupSize: 5, maxDriveHours: 3, tempPref: "mild", windTolerance: "medium", priorities: [] };
  assert.ok(planPrefsSchema.safeParse(ok).success);
  assert.ok(!planPrefsSchema.safeParse({ ...ok, groupSize: 0 }).success);
  assert.ok(planPrefsSchema.safeParse({ ...ok, city: "jeddah" }).success);
  assert.ok(!planPrefsSchema.safeParse({ ...ok, city: "paris" }).success);
  assert.ok(!planPrefsSchema.safeParse({ ...ok, priorities: ["temp", "wind", "rain", "dust"] }).success);
  assert.ok(!planPrefsSchema.safeParse({ ...ok, date: "tomorrow" }).success);
});

test("Llama interpretation schema keeps known fields only", () => {
  const r = interpretedPrefsSchema.safeParse({ experience: "stars", groupSize: "5", priorities: ["dust", "wind"], mood: "happy" });
  assert.ok(r.success);
  assert.equal(r.data.groupSize, 5);
  assert.ok(!("mood" in r.data));
  assert.ok(!interpretedPrefsSchema.safeParse({ experience: "beach" }).success);
});

test("checklist reacts to the forecast and group", () => {
  const calm = buildChecklist({ experience: "kashta", groupSize: 5, metrics: { minFeels: 15, maxGust: 10, maxPrecipProb: 0, maxDust: 40, moonIllumination: 0.1, sunset: "17:10", totalPrecip: 0 } });
  const rough = buildChecklist({ experience: "stars", groupSize: 5, metrics: { minFeels: 2, maxGust: 45, maxPrecipProb: 50, maxDust: 300, moonIllumination: 0.9, sunset: "17:10", totalPrecip: 2 } });
  const ids = (l: { id: string }[]) => l.map((i) => i.id);
  for (const id of ["warm", "sleepingbag", "pegs", "dust", "rain", "redlight", "moon"]) {
    assert.ok(ids(rough).includes(id), `rough missing ${id}`);
    if (id !== "redlight") assert.ok(!ids(calm).includes(id), `calm should not have ${id}`);
  }
  assert.ok(calm.find((i) => i.id === "water")!.label.ar.includes("5"));
});

test("unverified destination checklist does not claim a permit is required", () => {
  const items = buildChecklist({ experience: "kashta", groupSize: 2, metrics: null, permitStatus: "unverified" });
  const permit = items.find((item) => item.id === "permit")!;
  assert.match(permit.label.en, /Verify/);
  assert.doesNotMatch(permit.label.en, /permit from Nabati/i);
});
