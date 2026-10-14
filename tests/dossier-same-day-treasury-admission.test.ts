import assert from "node:assert/strict";
import test from "node:test";
import { officialTreasurySameDayAvailability } from "../lib/dossier-v2/canonical-snapshot.ts";

const asOf = "2026-10-14T20:37:54.000Z";
const now = Date.parse("2026-10-14T20:38:00.000Z");
const row = { id: "us2y", asOf: "2026-10-14", frequency: "daily" as const,
  sourceName: "U.S. Department of the Treasury", sourceUpdatedAt: "2026-10-14T15:54:40Z" };

test("dated source update permits same-day official yield only in a near-live as-of run", () => {
  assert.equal(officialTreasurySameDayAvailability(row, asOf, now), "2026-10-14T15:54:40Z");
  assert.equal(officialTreasurySameDayAvailability({ ...row, id: "us30y-fred" }, asOf, now), "2026-10-14T15:54:40Z");
});

test("same-day admission rejects future publication, older source date and historical replay", () => {
  assert.equal(officialTreasurySameDayAvailability(row, "2026-10-14T15:00:00.000Z", Date.parse("2026-10-14T15:01:00Z")), null);
  assert.equal(officialTreasurySameDayAvailability({ ...row, asOf: "2026-10-13" }, asOf, now), null);
  assert.equal(officialTreasurySameDayAvailability(row, asOf, Date.parse("2026-10-16T20:38:00Z")), null);
  assert.equal(officialTreasurySameDayAvailability({ ...row, sourceUpdatedAt: "2026-10-15T01:00:00Z" }, asOf, now), null);
});

test("same-day gate never accepts a proxy, FRED CSV or unrelated market series", () => {
  assert.equal(officialTreasurySameDayAvailability({ ...row, id: "spx" }, asOf, now), null);
  assert.equal(officialTreasurySameDayAvailability({ ...row, sourceName: "Federal Reserve Economic Data" }, asOf, now), null);
  assert.equal(officialTreasurySameDayAvailability({ ...row, sourceUpdatedAt: null }, asOf, now), null);
});
