import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeMacroSourceText,
  fetchMacroSourceDiagnostic,
  inventoryMarkdownTables,
} from "../lib/jina-macro-source-diagnostic.ts";

test("macro source analysis reports expected sections and calendar fields without inference", () => {
  const body = [
    "Calendar Actual Surprise Forecast Previous",
    "ISM NFIB Housing Energy Bonds Retail Employment Inflation FedWatch Credit COT Commodities",
    "x".repeat(600),
  ].join("\n");

  const analysis = analyzeMacroSourceText(body);

  assert.equal(analysis.hasMeaningfulContent, true);
  assert.deepEqual(analysis.sectionsMissing, []);
  assert.deepEqual(analysis.calendarFieldsMissing, []);
  assert.ok(analysis.sample.length <= 4_000);
});

test("markdown table inventory preserves headers, row values, row counts, and nearest macro section", () => {
  const body = [
    "# Calendar",
    "| Date | Event | Actual | Surprise | Forecast | Previous |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 18-Aug-26 | GDPNow | 4.0% | -7.0% | 4.3% | 4.3% |",
    "",
    "# ISM",
    "| Component | Latest | Prior |",
    "| --- | --- | --- |",
    "| New Orders | 48.2 | 47.1 |",
    "| Prices | 61.0 | 58.5 |",
    "",
    "# FedWatch",
    "| Meeting | Probability |",
    "| --- | --- |",
    "| Sep | 39% |",
    "",
    "# COT",
    "| Asset | Net | Weekly Change |",
    "| --- | --- | --- |",
    "| USD | 100 | -20 |",
    "",
    "# Housing",
    "| Series | Jul | Jun |",
    "| --- | --- | --- |",
    "| Pending Home Sales | -2.3% | -4.8% |",
  ].join("\n");

  const tables = inventoryMarkdownTables(body);

  assert.equal(tables.length, 5);
  assert.deepEqual(tables[0], {
    index: 0,
    section: "Calendar",
    headers: ["Date", "Event", "Actual", "Surprise", "Forecast", "Previous"],
    rowCount: 1,
    firstRow: ["18-Aug-26", "GDPNow", "4.0%", "-7.0%", "4.3%", "4.3%"],
  });
  assert.equal(tables[1]?.section, "ISM");
  assert.equal(tables[1]?.rowCount, 2);
  assert.equal(tables[2]?.section, "FedWatch");
  assert.equal(tables[3]?.section, "COT");
  assert.equal(tables[4]?.section, "Housing");
});

test("macro analysis exposes bounded focus-table diagnostics for Calendar, ISM, FedWatch, COT, and Housing", () => {
  const body = [
    "Calendar Actual Surprise Forecast Previous",
    "| Date | Actual | Surprise | Forecast | Previous |",
    "| --- | --- | --- | --- | --- |",
    "| 18-Aug-26 | 1 | 2 | 3 | 4 |",
    "ISM",
    "| Component | Latest |",
    "| --- | --- |",
    "| New Orders | 48.2 |",
    "FedWatch",
    "| Meeting | Probability |",
    "| --- | --- |",
    "| Sep | 39% |",
    "COT",
    "| Asset | Net |",
    "| --- | --- |",
    "| USD | 100 |",
    "Housing",
    "| Series | Latest |",
    "| --- | --- |",
    "| Starts | 1.2M |",
    "NFIB Energy Bonds Retail Employment Inflation Credit Commodities",
    "x".repeat(600),
  ].join("\n");

  const analysis = analyzeMacroSourceText(body);

  assert.equal(analysis.markdownTableCount, 5);
  assert.deepEqual(analysis.focusTables.map((table) => table.section), [
    "Calendar",
    "ISM",
    "FedWatch",
    "COT",
    "Housing",
  ]);
});

test("Jina diagnostic is isolated, uses the Reader endpoint, and sends the key only as Authorization", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      authorization: headers.get("authorization"),
    });
    return new Response("Calendar Actual Surprise Forecast Previous\n" + "x".repeat(600), {
      status: 200,
      statusText: "OK",
    });
  }) as typeof fetch;

  const result = await fetchMacroSourceDiagnostic({
    sourceUrl: "https://example.test/macro",
    jinaApiKey: "test-secret",
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.usedAuthenticatedReader, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://r.jina.ai/https://example.test/macro");
  assert.equal(calls[0]?.authorization, "Bearer test-secret");
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("Jina diagnostic can run unauthenticated for a zero-secret proof of concept", async () => {
  let authorization: string | null = "unexpected";
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    authorization = new Headers(init?.headers).get("authorization");
    return new Response("short response", { status: 200 });
  }) as typeof fetch;

  const result = await fetchMacroSourceDiagnostic({ fetchImpl });

  assert.equal(result.usedAuthenticatedReader, false);
  assert.equal(authorization, null);
  assert.equal(result.analysis.hasMeaningfulContent, false);
});
