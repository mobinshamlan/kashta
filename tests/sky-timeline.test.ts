import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateSkyTimeline } from "../src/lib/sky-timeline";

test("sky timeline orders sunset, astronomical dusk and dawn and bounds moon intervals", () => {
  const timeline = calculateSkyTimeline("2026-11-04", 25.1, 47.6);

  assert.ok(timeline);
  assert.ok(timeline.sunset < timeline.astronomicalDusk);
  assert.ok(timeline.astronomicalDusk < timeline.astronomicalDawn);
  for (const window of timeline.moonAboveHorizon) {
    assert.ok(window.start >= timeline.sunset);
    assert.ok(window.end <= timeline.astronomicalDawn);
    assert.ok(window.start < window.end);
  }
});

test("sky timeline rejects invalid nights and coordinates", () => {
  assert.equal(calculateSkyTimeline("2026-02-30", 25.1, 47.6), null);
  assert.equal(calculateSkyTimeline("2026-11-04", 95, 47.6), null);
});
