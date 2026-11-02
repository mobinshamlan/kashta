import assert from "node:assert/strict";
import { test } from "node:test";
import { collectNumbers, extractJson, isGrounded, keepGrounded, normaliseDigits } from "../src/lib/ai-guards";

test("extracts JSON from fenced or chatty replies", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Here: {"b":[1,2]} done'), { b: [1, 2] });
  assert.throws(() => extractJson("no json here"));
});

test("Arabic-Indic digits are normalised", () => {
  assert.equal(normaliseDigits("الحرارة ١٨٫٥"), "الحرارة 18.5");
});

test("sentences quoting numbers not in the facts are dropped", () => {
  const allowed = collectNumbers({ maxGustKmh: 18.4, eveningTempC: 25 });
  assert.ok(isGrounded("الهبات تصل 18 كم/س", allowed));
  assert.ok(isGrounded("الحرارة ٢٥ درجة", allowed));
  assert.ok(!isGrounded("الحرارة 31 درجة", allowed));
  const { kept, dropped } = keepGrounded(["Gusts 18 km/h", "Expect 40 km/h", "No numbers here"], allowed);
  assert.deepEqual(kept, ["Gusts 18 km/h", "No numbers here"]);
  assert.equal(dropped, 1);
});
