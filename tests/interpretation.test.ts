import assert from "node:assert/strict";
import { test } from "node:test";
import { applyInterpretationGuards } from "../src/lib/interpretation";
import type { InterpretedPrefs } from "../src/lib/schemas";

const parsed: InterpretedPrefs = {
  groupSize: 9,
  windTolerance: "low",
  date: null,
  priorities: ["wind", "dust", "moon"],
  summary: "حنا تسع ونبي نكشت هالأسبوع ونبي نشوف القمر ومانبي هوا وغبار",
  unclear: ["هالأسبوع", "حنا تسع ونبي نكشت هالأسبوع ونبي نشوف القمر ومانبي هوا وغبار"],
};

test("Saudi week and moon-viewing phrases are guarded without reversing the preference", () => {
  const { prefs, unsupported } = applyInterpretationGuards(
    "حنا تسع ونبي نكشت هالأسبوع ونبي نشوف القمر ومانبي هوا وغبار",
    { ...parsed, windTolerance: "high" },
  );

  assert.equal(prefs.groupSize, 9);
  assert.equal(prefs.date, "flexible");
  assert.equal(prefs.windTolerance, "low");
  assert.equal(prefs.tempPref, null);
  assert.equal(prefs.maxDriveHours, null);
  assert.deepEqual(prefs.priorities, ["wind", "dust"]);
  assert.deepEqual(prefs.unclear, []);
  assert.deepEqual(unsupported, ["moon_viewing"]);
});

test("an unmentioned field is cleared so a model guess cannot overwrite a manual choice", () => {
  const { prefs } = applyInterpretationGuards("حنا تسع هالاسبوع", {
    ...parsed,
    experience: "stars",
    tempPref: "warm",
    maxDriveHours: 4,
    windTolerance: "low",
    priorities: ["temp", "moon"],
    unclear: [],
  });

  assert.equal(prefs.groupSize, 9);
  assert.equal(prefs.date, "flexible");
  assert.equal(prefs.experience, null);
  assert.equal(prefs.tempPref, null);
  assert.equal(prefs.maxDriveHours, null);
  assert.equal(prefs.windTolerance, null);
  assert.deepEqual(prefs.priorities, []);
});

test("common week spelling without hamza is understood, while a named night stays specific", () => {
  const weekOnly = applyInterpretationGuards("حنا تسع هالاسبوع", {
    ...parsed,
    date: null,
    unclear: ["هالاسبوع"],
  });
  assert.equal(weekOnly.prefs.date, "flexible");
  assert.deepEqual(weekOnly.prefs.unclear, []);

  const { prefs } = applyInterpretationGuards("هالاسبوع نطلع الخميس", {
    ...parsed,
    date: "2026-11-05",
    unclear: ["هالاسبوع"],
  });

  assert.equal(prefs.date, "2026-11-05");
  assert.deepEqual(prefs.unclear, []);
});

test("an explicit dark-sky preference can still retain the moon priority", () => {
  const { prefs, unsupported } = applyInterpretationGuards("نبي ظلام وسماء بدون قمر", parsed);

  assert.ok(prefs.priorities?.includes("moon"));
  assert.deepEqual(unsupported, []);
});
