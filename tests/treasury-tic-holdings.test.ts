import assert from "node:assert/strict";
import test from "node:test";

import {
  TREASURY_TIC_TABLE5_URL,
  fetchTreasuryTicTable5,
  parseTreasuryTicTable5,
} from "../lib/providers/treasury-tic-holdings.ts";

const fixture = [
  "Table 5: Major Foreign Holders of Treasury Securities",
  "Holdings at end of time period",
  "Billions of dollars",
  "",
  "Country\t2026-07\t2026-06\t2026-05",
  "Japan\t1103.9\t1116.7\t1143.1",
  "United Kingdom\t998.3\t939.9\t948.6",
  "China, Mainland\t618.0\t633.4\t659.3",
  "Grand Total\t9500.0\t9400.0\t9300.0",
  "Of Which: Foreign Official\t3900.0\t3880.0\t3870.0",
  "Notes:",
  "custody caveat",
].join("\n");

test("TIC Table 5 parser preserves monthly holdings rather than calling changes purchases", () => {
  const snapshot = parseTreasuryTicTable5(fixture, "2026-09-16T20:00:00Z");

  assert.equal(snapshot.status, "OK");
  assert.equal(snapshot.latestPeriod, "2026-07");
  assert.equal(snapshot.previousPeriod, "2026-06");

  const japan = snapshot.countries.find((item) => item.country === "Japan");
  assert.equal(japan?.latestUsdBn, 1103.9);
  assert.equal(japan?.previousUsdBn, 1116.7);
  assert.equal(japan?.monthlyChangeUsdBn, -12.8);
  assert.match(snapshot.custodyAttributionCaveat, /custodians/i);
  assert.match(snapshot.custodyAttributionCaveat, /beneficial owner/i);
});

test("TIC parser fails closed when the table shape is missing", () => {
  const snapshot = parseTreasuryTicTable5("not the table");
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.equal(snapshot.countries.length, 0);
});

test("TIC fetch uses the official Table 5 text endpoint", async () => {
  let seen = "";
  const fetchImpl = (async (input: string | URL | Request) => {
    seen = String(input);
    return new Response(fixture, { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof fetch;

  const snapshot = await fetchTreasuryTicTable5(fetchImpl);
  assert.equal(seen, TREASURY_TIC_TABLE5_URL);
  assert.equal(snapshot.status, "OK");
});

test("TIC fetch exposes provider failure without fabricating holdings", async () => {
  const snapshot = await fetchTreasuryTicTable5(
    (async () => new Response("missing", { status: 503 })) as typeof fetch,
  );
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.equal(snapshot.countries.length, 0);
  assert.match(snapshot.warnings.join(" "), /HTTP 503/);
});
