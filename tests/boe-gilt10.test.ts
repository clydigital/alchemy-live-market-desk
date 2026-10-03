import assert from "node:assert/strict";
import test from "node:test";

import {
  BOE_GILT10_SERIES,
  buildBoeGilt10Url,
  fetchBoeGilt10,
  parseBoeGiltCsv,
} from "../lib/providers/boe-gilt10.ts";

const csv = [
  "DATE,IUDMNPY",
  "24 Sep 26,5.10",
  "25 Sep 26,5.11",
  "28 Sep 26,5.12",
  "29 Sep 26,5.13",
  "30 Sep 26,5.14",
  "01 Oct 26,5.20",
].join("\n");

test("BoE gilt CSV parser reads daily IUDMNPY observations", () => {
  const rows = parseBoeGiltCsv(csv);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.at(-1), { date: "2026-10-01", yieldPct: 5.2 });
});

test("BoE URL uses documented automatic CSV download contract", () => {
  const url = buildBoeGilt10Url(new Date("2026-10-03T10:00:00Z"));
  assert.match(url, /_iadb-fromshowcolumns\.asp/);
  assert.match(url, /csv\.x=yes/);
  assert.match(url, new RegExp("SeriesCodes=" + BOE_GILT10_SERIES));
  assert.match(url, /CSVF=TN/);
  assert.match(url, /Dateto=now/);
});

test("BoE provider computes five-observation gilt move", async () => {
  const result = await fetchBoeGilt10(
    new Date("2026-10-02T10:00:00Z"),
    (async () => new Response(csv, { status: 200, headers: { "content-type": "text/csv" } })) as typeof fetch,
  );
  assert.equal(result.status, "OK");
  assert.equal(result.latest?.yieldPct, 5.2);
  assert.equal(result.change5dBp, 10);
});

test("BoE provider degrades on schema or HTTP failure", async () => {
  const schema = await fetchBoeGilt10(
    new Date("2026-10-02T10:00:00Z"),
    (async () => new Response("DATE,IUDMNPY\nnot-a-date,n/a", { status: 200 })) as typeof fetch,
  );
  assert.equal(schema.status, "UNAVAILABLE");

  const http = await fetchBoeGilt10(
    new Date("2026-10-02T10:00:00Z"),
    (async () => new Response("missing", { status: 503 })) as typeof fetch,
  );
  assert.equal(http.status, "UNAVAILABLE");
});
