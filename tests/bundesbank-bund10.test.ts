import assert from "node:assert/strict";
import test from "node:test";

import {
  BUNDESBANK_BUND10_SERIES,
  BUNDESBANK_BUND10_URL,
  fetchBundesbankBund10,
  parseBundesbankSdmxCsv,
} from "../lib/providers/bundesbank-bund10.ts";

const csv = [
  "FREQ,SERIES,TIME_PERIOD,OBS_VALUE",
  "D,BBSSY.D.REN.EUR.A630.000000WT1010.A,2026-09-24,3.10",
  "D,BBSSY.D.REN.EUR.A630.000000WT1010.A,2026-09-25,3.11",
  "D,BBSSY.D.REN.EUR.A630.000000WT1010.A,2026-09-28,3.12",
  "D,BBSSY.D.REN.EUR.A630.000000WT1010.A,2026-09-29,3.13",
  "D,BBSSY.D.REN.EUR.A630.000000WT1010.A,2026-09-30,3.14",
  "D,BBSSY.D.REN.EUR.A630.000000WT1010.A,2026-10-01,3.20",
].join("\n");

test("Bundesbank SDMX CSV parser reads time period and observation value", () => {
  const rows = parseBundesbankSdmxCsv(csv);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.at(-1), { date: "2026-10-01", yieldPct: 3.2 });
});

test("Bundesbank parser fails closed on schema drift", () => {
  assert.deepEqual(parseBundesbankSdmxCsv("date,value\n2026-10-01,3.2"), []);
});

test("Bundesbank provider uses official keyless series and computes five-observation change", async () => {
  let seen = "";
  const fetchImpl = (async (input: string | URL | Request) => {
    seen = String(input);
    return new Response(csv, { status: 200, headers: { "content-type": "text/csv" } });
  }) as typeof fetch;

  const result = await fetchBundesbankBund10(new Date("2026-10-02T10:00:00Z"), fetchImpl);
  assert.equal(seen, BUNDESBANK_BUND10_URL);
  assert.equal(result.series, BUNDESBANK_BUND10_SERIES);
  assert.equal(result.status, "OK");
  assert.equal(result.latest?.yieldPct, 3.2);
  assert.equal(result.change5dBp, 10);
});

test("Bundesbank provider exposes HTTP failure without fabricating observations", async () => {
  const result = await fetchBundesbankBund10(
    new Date("2026-10-02T10:00:00Z"),
    (async () => new Response("missing", { status: 503 })) as typeof fetch,
  );
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.latest, null);
  assert.match(result.warnings.join(" "), /HTTP 503/);
});
