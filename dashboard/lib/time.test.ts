import assert from "node:assert/strict";
import test from "node:test";
import { addDays, dateKey, diffDays, zonedDateTime } from "./time.ts";

test("Indianapolis date key respects Eastern offset and daylight time", () => {
  assert.equal(dateKey(new Date("2026-11-14T03:30:00Z")), "2026-11-13");
  assert.equal(dateKey(new Date("2026-11-14T05:30:00Z")), "2026-11-14");
  assert.equal(dateKey(new Date("2026-07-14T03:30:00Z")), "2026-07-13");
  assert.equal(dateKey(new Date("2026-07-14T04:30:00Z")), "2026-07-14");
});

test("start of a civil day converts back to the same date key", () => {
  const winter = zonedDateTime("2026-11-14", 0);
  assert.equal(winter.toISOString(), "2026-11-14T05:00:00.000Z");
  assert.equal(dateKey(winter), "2026-11-14");
  const summer = zonedDateTime("2026-07-14", 0);
  assert.equal(summer.toISOString(), "2026-07-14T04:00:00.000Z");
  assert.equal(dateKey(summer), "2026-07-14");
});

test("calendar day math does not drift across months", () => {
  assert.equal(addDays("2026-11-30", 2), "2026-12-02");
  assert.equal(diffDays("2026-11-16", "2026-11-14"), 2);
});
