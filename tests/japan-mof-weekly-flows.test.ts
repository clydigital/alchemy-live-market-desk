import assert from "node:assert/strict";
import test from "node:test";

import {
  JAPAN_MOF_WEEKLY_URL,
  fetchJapanMofWeeklyFlows,
  inferJapanMofGregorianYear,
  parseJapanMofWeeklyCsv,
} from "../lib/providers/japan-mof-weekly-flows.ts";

function row(period: string, values: Partial<Record<number, string>> = {}) {
  const cells = Array.from({ length: 23 }, () => "");
  cells[0] = period;
  for (const [index, value] of Object.entries(values)) cells[Number(index)] = value;
  return cells.map((cell) => cell.includes(",") ? `"${cell}"` : cell).join(",");
}

test("Japan MOF endpoint and era-year inference are deterministic", () => {
  assert.equal(
    JAPAN_MOF_WEEKLY_URL,
    "https://www.mof.go.jp/policy/international_policy/reference/itn_transactions_in_securities/week.csv",
  );
  assert.equal(inferJapanMofGregorianYear("2026/08/09-2026/08/15"), 2026);
  assert.equal(inferJapanMofGregorianYear("令和8年8月9日～8月15日"), 2026);
  assert.equal(inferJapanMofGregorianYear("平成25年12月22日～12月28日"), 2013);
  assert.equal(inferJapanMofGregorianYear("unknown period"), null);
});

test("Japan MOF parser binds the proven weekly net columns and converts oku-yen to JPY bn", () => {
  const text = [
    "header,,,,,,,,,,,,,,,,,,,,,,",
    row("2026/08/09-2026/08/15", {
      3: "1,500",
      6: "-2,400",
      10: "300",
      11: "-600",
      14: "2,000",
      17: "1,200",
      21: "-100",
      22: "3,100",
    }),
  ].join("\n");

  const rows = parseJapanMofWeeklyCsv(text);
  assert.equal(rows.length, 1);
  const parsed = rows[0];
  assert.equal(parsed.inferredGregorianYear, 2026);
  assert.equal(parsed.outwardSignConvention, "net_purchase_positive");
  assert.equal(parsed.outwardEquityNetJpyBn, 150);
  assert.equal(parsed.outwardLongTermDebtNetJpyBn, -240);
  assert.equal(parsed.outwardTotalNetJpyBn, -60);
  assert.equal(parsed.outwardLongTermDebtNetPurchaseJpyBn, -240);
  assert.equal(parsed.inwardEquityNetJpyBn, 200);
  assert.equal(parsed.inwardTotalNetJpyBn, 310);
});

test("Japan MOF parser normalizes the pre-2014 outward sign convention without rewriting raw net", () => {
  const text = row("2013/12/22-2013/12/28", {
    3: "500",
    6: "1,000",
    10: "-200",
    11: "1,300",
    14: "400",
    17: "500",
    21: "100",
    22: "1,000",
  });

  const parsed = parseJapanMofWeeklyCsv(text)[0];
  assert.equal(parsed.outwardSignConvention, "net_sale_positive");
  assert.equal(parsed.outwardLongTermDebtNetJpyBn, 100);
  assert.equal(parsed.outwardLongTermDebtNetPurchaseJpyBn, -100);
  assert.equal(parsed.outwardTotalNetJpyBn, 130);
  assert.equal(parsed.outwardTotalNetPurchaseJpyBn, -130);
  assert.equal(parsed.inwardTotalNetJpyBn, 100);
});

test("Japan MOF parser skips headers, thin rows and malformed values instead of fabricating data", () => {
  const thin = row("2026/08/09-2026/08/15", { 3: "100", 6: "bad" });
  const header = row("Period", { 3: "100", 6: "100", 10: "100", 11: "100", 14: "100", 17: "100", 21: "100", 22: "100" });
  assert.deepEqual(parseJapanMofWeeklyCsv(`${header}\n${thin}`), []);
});

test("Japan MOF fetch reads the public keyless CSV and exposes the last source row as latest", async () => {
  let seenUrl = "";
  const body = [
    row("2026/08/02-2026/08/08", { 3: "100", 6: "200", 10: "300", 11: "600", 14: "100", 17: "200", 21: "300", 22: "600" }),
    row("2026/08/09-2026/08/15", { 3: "200", 6: "400", 10: "600", 11: "1,200", 14: "200", 17: "400", 21: "600", 22: "1,200" }),
  ].join("\n");

  const fetchImpl = (async (input: string | URL | Request) => {
    seenUrl = String(input);
    return new Response(body, { status: 200, headers: { "content-type": "text/csv" } });
  }) as typeof fetch;

  const snapshot = await fetchJapanMofWeeklyFlows(fetchImpl);
  assert.equal(seenUrl, JAPAN_MOF_WEEKLY_URL);
  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.rows.length, 2);
  assert.equal(snapshot.latest?.periodLabel, "2026/08/09-2026/08/15");
  assert.equal(snapshot.latest?.outwardTotalNetPurchaseJpyBn, 120);
  assert.match(snapshot.note || "", /January 2014/);
});

test("Japan MOF fetch reports unavailable for HTTP failure or schema drift", async () => {
  const httpFailure = await fetchJapanMofWeeklyFlows((async () => new Response("missing", { status: 404 })) as typeof fetch);
  assert.equal(httpFailure.state, "unavailable");
  assert.match(httpFailure.note || "", /HTTP 404/);

  const badSchema = await fetchJapanMofWeeklyFlows((async () => new Response("not,the,weekly,table", { status: 200 })) as typeof fetch);
  assert.equal(badSchema.state, "unavailable");
  assert.match(badSchema.note || "", /no rows matching/);
});
