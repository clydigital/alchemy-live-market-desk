import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeMacroSourceText,
  buildMacroSnapshot,
  compareMacroSnapshots,
  fetchMacroSourceDiagnostic,
  inventoryMarkdownTables,
} from "../lib/jina-macro-source-diagnostic.ts";

const ALL_SECTION_TOKENS = "Calendar ISM NFIB Housing Energy Bonds Retail Employment Inflation FedWatch Credit COT Commodities";

function completeFixture(input: {
  calendarActual?: string;
  calendarCountdown?: string;
  calendarExtraRow?: string;
  ismHeadline?: string;
  includeCot?: boolean;
} = {}) {
  const calendarActual = input.calendarActual ?? "4.0%";
  const calendarCountdown = input.calendarCountdown ?? "5m";
  const ismHeadline = input.ismHeadline ?? "55.6";
  const includeCot = input.includeCot ?? true;
  return [
    ALL_SECTION_TOKENS,
    "# High impact calendar",
    "| Date | Time (CET) | Countdown | Imp | Event | Actual | Surprise | Forecast | Previous | Charts |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| 18-Aug-26 | 16:20 | ${calendarCountdown} | ★★ | GDPNow | ${calendarActual} | -7.0% | 4.3% | 4.3% | Bonds |`,
    input.calendarExtraRow ?? "",
    "# ISM Manufacturing",
    "|  | Headline | New Ord | Prod/BA | Empl | Deliv | Inv | Prices | Backlog | Exports | Imports | Cust/Sent |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| Jul-26 | ${ismHeadline} | 56.7 | 58.5 | 52.8 | 58.9 | 51.2 | 71.1 | 55.0 | 53.0 | 55.7 | 40.7 |`,
    "# FedWatch path",
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
    ...(includeCot ? [
      "# COT legacy",
      "| Instrument | Noncommercial smart money net (1w Δ) | 3y %ile | Commercial net (1w Δ) | 3y %ile | Nonreportable net (1w Δ) | 3y %ile | Open Int. |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| Gold | +100 | 90 | -100 | 10 | 0 | 50 | 500 |",
    ] : []),
    "x".repeat(600),
  ].filter(Boolean).join("\n");
}

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
  assert.equal(tables[0]?.kind, "calendar-events");
  assert.ok(tables[0]?.tableId.startsWith("calendar:calendar-events:"));
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

  const table = inventoryMarkdownTables(body)[0];
  assert.equal(table?.section, "FedWatch");
  assert.equal(table?.kind, "fedwatch-matrix");
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
    "Calendar", "ISM", "FedWatch", "COT", "Inflation",
  ]);
  assert.ok(analysis.focusSectionSummary.every((item) => item.tableCount >= 1));
  assert.ok(analysis.focusSectionSummary.every((item) => item.representativeRowMatchesHeaders));
});

test("1C: identical captures have deterministic table identities and zero material changes", () => {
  const body = completeFixture();
  const first = buildMacroSnapshot(body, "2026-08-19T08:00:00Z");
  const second = buildMacroSnapshot(body, "2026-08-19T08:01:00Z");
  const comparison = compareMacroSnapshots(first, second);

  assert.equal(first.status, "COMPLETE");
  assert.equal(second.status, "COMPLETE");
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.tables.map((table) => table.tableId), second.tables.map((table) => table.tableId));
  assert.equal(comparison.status, "COMPLETE");
  assert.equal(comparison.changeCount, 0);
  assert.deepEqual(comparison.changes, []);
});

test("1C: a changed value reports only the exact old/new cell", () => {
  const previous = buildMacroSnapshot(completeFixture({ calendarActual: "4.0%" }));
  const current = buildMacroSnapshot(completeFixture({ calendarActual: "4.2%" }));
  const comparison = compareMacroSnapshots(previous, current);

  assert.equal(comparison.changeCount, 1);
  assert.deepEqual(comparison.changes[0], {
    type: "CELL_CHANGED",
    tableId: current.tables.find((table) => table.kind === "calendar-events")?.tableId,
    section: "Calendar",
    kind: "calendar-events",
    rowKey: "18-Aug-26|16:20|GDPNow",
    column: "Actual",
    oldValue: "4.0%",
    newValue: "4.2%",
  });
});

test("1C: volatile Countdown changes do not create material changes", () => {
  const previous = buildMacroSnapshot(completeFixture({ calendarCountdown: "5m" }));
  const current = buildMacroSnapshot(completeFixture({ calendarCountdown: "1m" }));
  const comparison = compareMacroSnapshots(previous, current);
  assert.equal(comparison.changeCount, 0);
  assert.equal(previous.fingerprint, current.fingerprint);
});

test("1C: a new calendar release becomes ROW_ADDED, not a table rewrite", () => {
  const previous = buildMacroSnapshot(completeFixture());
  const current = buildMacroSnapshot(completeFixture({
    calendarExtraRow: "| 19-Aug-26 | 14:30 | 0m | ★★★ | CPI YoY | 3.4% | 0% | 3.4% | 3.5% | Inflation |",
  }));
  const comparison = compareMacroSnapshots(previous, current);

  assert.equal(comparison.changeCount, 1);
  assert.equal(comparison.changes[0]?.type, "ROW_ADDED");
  if (comparison.changes[0]?.type === "ROW_ADDED") {
    assert.equal(comparison.changes[0].rowKey, "19-Aug-26|14:30|CPI YoY");
    assert.equal(comparison.changes[0].row.Actual, "3.4%");
  }
});

test("1C: a historical revision reports the exact revised cell", () => {
  const previous = buildMacroSnapshot(completeFixture({ ismHeadline: "55.6" }));
  const current = buildMacroSnapshot(completeFixture({ ismHeadline: "55.8" }));
  const comparison = compareMacroSnapshots(previous, current);
  const revisions = comparison.changes.filter((change) => change.type === "CELL_CHANGED");

  assert.equal(revisions.length, 1);
  assert.equal(revisions[0]?.type, "CELL_CHANGED");
  if (revisions[0]?.type === "CELL_CHANGED") {
    assert.equal(revisions[0].section, "ISM");
    assert.equal(revisions[0].rowKey, "Jul-26");
    assert.equal(revisions[0].column, "Headline");
    assert.equal(revisions[0].oldValue, "55.6");
    assert.equal(revisions[0].newValue, "55.8");
  }
});

test("1C: missing source data is PARTIAL and never emitted as deletion", () => {
  const previous = buildMacroSnapshot(completeFixture({ includeCot: true }));
  const currentText = completeFixture({ includeCot: false }).replace(" COT ", " ");
  const current = buildMacroSnapshot(currentText);
  const comparison = compareMacroSnapshots(previous, current);

  assert.equal(current.status, "PARTIAL");
  assert.ok(current.missingSections.includes("COT"));
  assert.ok(current.missingRequiredTableKinds.includes("cot"));
  assert.equal(comparison.status, "PARTIAL");
  assert.ok(comparison.missingTableIds.some((id) => id.includes(":cot-")));
  assert.equal(comparison.changes.some((change) => change.type === "ROW_REMOVED"), false);
});

test("Jina diagnostic is isolated, uses the Reader endpoint, and sends the key only as Authorization", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(input), authorization: headers.get("authorization") });
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
