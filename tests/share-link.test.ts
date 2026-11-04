import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PREFS } from "../src/lib/prefs-storage";
import { buildPlanShareUrl, parsePlanShareParams, type ShareSearchParams } from "../src/lib/share-link";
import type { PlanPrefs } from "../src/lib/types";

const validParams: ShareSearchParams = {
  share: "1",
  destination: "saad-national-park",
  night: "2020-01-02",
  experience: "kashta",
  groupSize: "5",
  maxDriveHours: "3",
  tempPref: "mild",
  windTolerance: "medium",
  priorities: "moon,wind",
};

test("share links round-trip the selected destination, night and scoring preferences only", () => {
  const prefs: PlanPrefs = { ...DEFAULT_PREFS, experience: "stars", priorities: ["moon", "wind"] };
  const href = buildPlanShareUrl("https://kashta.example", "saad-national-park", "2020-01-02", prefs);
  assert.ok(href);
  const url = new URL(href);
  const parsed = parsePlanShareParams(Object.fromEntries(url.searchParams));

  assert.equal(parsed.kind, "valid");
  if (parsed.kind !== "valid") return;
  assert.equal(parsed.value.slug, "saad-national-park");
  assert.equal(parsed.value.night, "2020-01-02");
  assert.deepEqual(parsed.value.prefs, { ...prefs, date: "flexible" });
  assert.equal(url.searchParams.has("q"), false);
  assert.equal(url.searchParams.has("text"), false);
  assert.equal(url.searchParams.has("score"), false);
});

test("share links accept an old valid night so the planner can explain expired coverage", () => {
  assert.equal(parsePlanShareParams(validParams).kind, "valid");
});

test("share links reject malformed destinations, dates, preferences and duplicate query values", () => {
  const invalidCases: ShareSearchParams[] = [
    { ...validParams, destination: "not-a-real-place" },
    { ...validParams, night: "2026-02-30" },
    { ...validParams, experience: "surfing" },
    { ...validParams, groupSize: "41" },
    { ...validParams, maxDriveHours: "2.25" },
    { ...validParams, priorities: "moon,moon" },
    { ...validParams, destination: ["saad-national-park", "saad-national-park"] },
    { ...validParams, share: "2" },
  ];
  for (const params of invalidCases) assert.equal(parsePlanShareParams(params).kind, "invalid");
  assert.equal(parsePlanShareParams({}).kind, "none");
});
