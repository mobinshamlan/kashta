import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, computeNight, moonForNight, nightHours, riyadhToday, upcomingNights } from "../src/lib/nights";
import type { HourPoint } from "../src/lib/types";

function hoursFor(date: string, fill: Partial<HourPoint> = {}): HourPoint[] {
  const out: HourPoint[] = [];
  for (const d of [date, addDays(date, 1)]) {
    for (let h = 0; h < 24; h++) {
      out.push({
        time: `${d}T${String(h).padStart(2, "0")}:00`,
        temp: 20 - h * 0.2,
        feels: 19 - h * 0.2,
        wind: 10,
        gust: 15 + (h % 3),
        precipProb: 0,
        precip: 0,
        cloud: 10,
        dust: 50,
        pm10: 80,
        ...fill,
      });
    }
  }
  return out;
}

test("Riyadh date rolls over at 21:00 UTC", () => {
  assert.equal(riyadhToday(new Date("2026-11-02T20:59:00Z")), "2026-11-02");
  assert.equal(riyadhToday(new Date("2026-11-02T21:00:00Z")), "2026-11-03");
});

test("seven upcoming nights starting tonight", () => {
  const n = upcomingNights(new Date("2026-11-02T10:00:00Z"));
  assert.equal(n.length, 7);
  assert.equal(n[0], "2026-11-02");
  assert.equal(n[6], "2026-11-08");
});

test("a night is 18:00 to 05:00, twelve samples", () => {
  const h = nightHours(hoursFor("2026-11-04"), "2026-11-04");
  assert.equal(h.length, 12);
  assert.equal(h[0].time, "2026-11-04T18:00");
  assert.equal(h[11].time, "2026-11-05T05:00");
});

test("measurements with under half coverage are treated as missing", () => {
  const hours = hoursFor("2026-11-04").map((h) => (h.time >= "2026-11-04T20:00" ? { ...h, dust: null } : h));
  const m = computeNight(hours, "2026-11-04", 25.1, 47.6);
  assert.equal(m.maxDust, null);
  assert.notEqual(m.maxGust, null);
});

test("moon data is physically sensible", () => {
  const m = moonForNight("2026-11-04", 25.1, 47.6);
  assert.ok(m.moonIllumination >= 0 && m.moonIllumination <= 1);
  assert.ok(m.darkHours > 8 && m.darkHours < 12, `dark ${m.darkHours}`);
  assert.ok(m.moonFreeDarkHours <= m.darkHours);
  assert.match(m.sunset ?? "", /^1[67]:\d\d$/);
});
