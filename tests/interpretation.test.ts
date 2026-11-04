import assert from "node:assert/strict";
import { test } from "node:test";
import { applyInterpretationGuards, chatIntent, extractGroupSize, extractCity } from "../src/lib/interpretation";
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

test("headcount and experience follow the user's words, not Llama's guess", () => {
  const text = "حنا تسع ونبي نكشت هالأسبوع ونبي نشوف القمر ومانبي هوا وغبار";
  const wrong = applyInterpretationGuards(text, { experience: "stars", groupSize: 5, priorities: ["moon"] });
  assert.equal(wrong.prefs.groupSize, 9);
  assert.equal(wrong.prefs.experience, "kashta");
  assert.ok(!wrong.prefs.priorities?.includes("moon"));
  const missing = applyInterpretationGuards(text, {});
  assert.equal(missing.prefs.groupSize, 9);
  assert.equal(missing.prefs.experience, "kashta");
});

test("headcount is read from digits and common spellings", () => {
  assert.equal(extractGroupSize("حنا 7 نبي نكشت"), 7);
  assert.equal(extractGroupSize("خمسة أشخاص بنطلع"), 5);
  assert.equal(extractGroupSize("٣ اشخاص"), 3);
  assert.equal(extractGroupSize("حنا تسعة"), 9);
  assert.equal(extractGroupSize("نبي نكشت الخميس"), null);
});

test("questions about the plan are answered, never applied or redirected", () => {
  assert.equal(chatIntent("ليش اخترت المكان ذا؟", { redirect: "أنا أساعد في تخطيط الطلعات بس" }), "question");
  assert.equal(chatIntent("وش يعني الغيم 0٪؟", {}), "question");
  assert.equal(chatIntent("وش أحتاج آخذ معي للكشتة؟", {}), "question");
  assert.equal(chatIntent("Why did you pick this place?", {}), "question");
  assert.equal(chatIntent("Is the permit needed here", { redirect: "I only plan trips." }), "question");
  assert.equal(chatIntent("Tell me a joke", { redirect: "Ha! Let's plan a night out instead." }), "redirect");
  assert.equal(chatIntent("نبيها ليلة الجمعة، وحنا ستة", {}), "change");
});

test("the start city comes only from where the user says they set out", () => {
  assert.equal(extractCity("طالعين من جدة الخميس وحنا خمسة"), "jeddah");
  assert.equal(extractCity("احنا في الدمام ونبي كشتة"), "dammam");
  assert.equal(extractCity("We're leaving from Abha on Friday"), "abha");
  assert.equal(extractCity("من بريدة"), "buraydah");
  assert.equal(extractCity("نبي كشتة هالأسبوع"), null);
  // A city named without "من/في/from" is not taken as the start.
  assert.equal(extractCity("كشتة قريبة جدة؟"), null);
});
