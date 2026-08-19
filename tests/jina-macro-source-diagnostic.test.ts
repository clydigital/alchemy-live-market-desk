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

test("markdown table inventory preserves headers, row values, row shape counts, and representative rows", () => {
  const body = [
    "# Calendar",
    "| Date | Event | Actual | Surprise | Forecast | Previous |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 18-Aug-26 | GDPNow | 4.0% | -7.0% | 4.3% | 4.3% |",
  ].join("\n");

  const tables = inventoryMarkdownTables(body);

  assert.equal(tables.length, 1);
  assert.equal(tables[0]?.section, "Calendar");
  assert.deepEqual(tables[0]?.headers, ["Date", "Event", "Actual", "Surprise", "Forecast", "Previous"]);
  assert.equal(tables[0]?.rowCount, 1);
  assert.equal(tables[0]?.wellFormedRowCount, 1);
  assert.equal(tables[0]?.raggedRowCount, 0);
  assert.deepEqual(tables[0]?.representativeRow, ["18-Aug-26", "GDPNow", "4.0%", "-7.0%", "4.3%", "4.3%"]);
});

test("schema signatures override misleading nearby labels for Calendar, ISM, FedWatch, and COT", () => {
  const body = [
    "# WrongNearbyLabel Commodities",
    "| Date | Event | Actual | Surprise | Forecast | Previous |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 18-Aug-26 | GDPNow | 4.0% | -7.0% | 4.3% | 4.3% |",
    "# WrongNearbyLabel Calendar",
    "|  | Headline | New Ord | Prod/BA | Empl | Deliv | Inv | Prices | Backlog | Exports | Imports | Cust/Sent |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| Jul-26 | 55.6 | 56.7 | 58.5 | 52.8 | 58.9 | 51.2 | 71.1 | 55.0 | 53.0 | 55.7 | 40.7 |",
    "# WrongNearbyLabel NFIB",
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
    "# WrongNearbyLabel NFIB",
    "| Instrument | Noncommercial smart money net (1w Δ) | 3y %ile | Commercial net (1w Δ) | 3y %ile | Nonreportable net (1w Δ) | 3y %ile | Open Int. |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| Gold | 100 | 90 | -100 | 10 | 0 | 50 | 500 |",
  ].join("\n");

  const tables = inventoryMarkdownTables(body);
  assert.deepEqual(tables.map((table) => table.section), ["Calendar", "ISM", "FedWatch", "COT"]);
});

test("FedWatch meeting-date matrix is recognized without relying on nearby text", () => {
  const body = [
    "NFIB",
    "|  | Sep 16 '26 | Oct 28 '26 | Dec 09 '26 | Jan 27 '27 |",
    "| --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 20% | 30% | 40% | 50% |",
  ].join("\n");

  const tables = inventoryMarkdownTables(body);
  assert.equal(tables[0]?.section, "FedWatch");
});

test("COT representative row skips ragged category labels and preserves a full instrument row", () => {
  const body = [
    "COT",
    "| Instrument | Managed Money smart money net (1w Δ) | 3y %ile | Open Int. |",
    "| --- | --- | --- | --- |",
    "| Metals |",
    "| Gold | 217.9K | 82 | 500K |",
  ].join("\n");

  const table = inventoryMarkdownTables(body)[0];
  assert.equal(table?.section, "COT");
  assert.equal(table?.rowCount, 2);
  assert.equal(table?.wellFormedRowCount, 1);
  assert.equal(table?.raggedRowCount, 1);
  assert.deepEqual(table?.representativeRow, ["Gold", "217.9K", "82", "500K"]);
});

test("macro analysis summarizes Calendar, ISM, FedWatch, COT, and Inflation with aligned representative rows", () => {
  const body = [
    "Calendar Actual Surprise Forecast Previous",
    "| Date | Event | Actual | Surprise | Forecast | Previous |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 18-Aug-26 | GDPNow | 4.0% | -7.0% | 4.3% | 4.3% |",
    "ISM",
    "|  | Headline | New Ord | Prod/BA | Empl | Deliv | Inv | Prices | Backlog | Exports | Imports | Cust/Sent |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| Jul-26 | 55.6 | 56.7 | 58.5 | 52.8 | 58.9 | 51.2 | 71.1 | 55.0 | 53.0 | 55.7 | 40.7 |",
    "FedWatch",
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
    "COT",
    "| Instrument | Noncommercial smart money net (1w Δ) | 3y %ile | Open Int. |",
    "| --- | --- | --- | --- |",
    "| USD | 100 | 50 | 1000 |",
    "Inflation",
    "| Series | Aug-24 | Sep-24 | Oct-24 | Nov-24 | Dec-24 | Jan-25 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| CPI YoY | 2.5 | 2.4 | 2.3 | 2.4 | 2.5 | 2.6 |",
    "NFIB Housing Energy Bonds Retail Employment Credit Commodities",
    "x".repeat(600),
  ].join("\n");

  const analysis = analyzeMacroSourceText(body);
  assert.equal(analysis.markdownTableCount, 5);
  assert.deepEqual(analysis.focusSectionSummary.map((item) => item.section), [
    "Calendar",
    "ISM",
    "FedWatch",
    "COT",
    "Inflation",
  ]);
  assert.ok(analysis.focusSectionSummary.every((item) => item.tableCount >= 1));
  assert.ok(analysis.focusSectionSummary.every((item) => item.representativeRowMatchesHeaders));
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
