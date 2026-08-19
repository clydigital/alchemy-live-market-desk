import assert from "node:assert/strict";
import test from "node:test";

import { fetchJinaReader } from "../lib/acquisition/jina-reader.ts";
import { parseMacroIndicatorsMarkdown } from "../lib/macro/macro-indicators-source.ts";
import { buildMacroSnapshot } from "../lib/macro/macro-snapshot.ts";
import { compareMacroSnapshots, evaluateMacroSnapshotCandidate } from "../lib/macro/macro-diff.ts";

const ALL_SECTIONS = [
  "Calendar", "ISM", "NFIB", "Housing", "Energy", "Bonds", "Retail",
  "Employment", "Inflation", "FedWatch", "Credit", "COT", "Commodities",
];

function completeFixture(input: {
  calendarActual?: string;
  calendarCountdown?: string;
  calendarExtraRow?: string;
  ismHeadline?: string;
  includeCot?: boolean;
} = {}) {
  const includeCot = input.includeCot ?? true;
  const sections = ALL_SECTIONS.filter((section) => includeCot || section !== "COT").join(" ");
  return [
    sections,
    "# Calendar",
    "| Date | Time (CET) | Countdown | Imp | Event | Actual | Surprise | Forecast | Previous | Charts |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| 18-Aug-26 | 16:20 | ${input.calendarCountdown ?? "5m"} | ★★ | GDPNow | ${input.calendarActual ?? "4.0%"} | -7.0% | 4.3% | 4.3% | Bonds |`,
    input.calendarExtraRow ?? "",
    "# ISM Manufacturing",
    "|  | Headline | New Ord | Prod/BA | Empl | Deliv | Inv | Prices | Backlog | Exports | Imports | Cust/Sent |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| Jul-26 | ${input.ismHeadline ?? "55.6"} | 56.7 | 58.5 | 52.8 | 58.9 | 51.2 | 71.1 | 55.0 | 53.0 | 55.7 | 40.7 |`,
    "# FedWatch",
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
    ...(includeCot ? [
      "# COT",
      "| Instrument | Noncommercial smart money net (1w Δ) | 3y %ile | Commercial net (1w Δ) | 3y %ile | Nonreportable net (1w Δ) | 3y %ile | Open Int. |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| Metals |",
      "| Gold | +100 | 90 | -100 | 10 | 0 | 50 | 500 |",
    ] : []),
    "x".repeat(600),
  ].filter(Boolean).join("\n");
}

test("Jina Reader uses authenticated Markdown transport without returning credentials", async () => {
  const secret = "jina-test-secret";
  let authorization = "";
  let returnFormat = "";
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    authorization = headers.get("authorization") ?? "";
    returnFormat = headers.get("x-return-format") ?? "";
    return new Response("Calendar ISM", { status: 200, statusText: "OK" });
  }) as typeof fetch;

  const result = await fetchJinaReader({
    sourceUrl: "https://macro-indicators-a3d.pages.dev/",
    apiKey: secret,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(authorization, `Bearer ${secret}`);
  assert.equal(returnFormat, "markdown");
  assert.equal(result.readerUrl, "https://r.jina.ai/https://macro-indicators-a3d.pages.dev/");
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("Jina transport failures are bounded and do not return provider bodies", async () => {
  const fetchImpl = (async () => new Response("sensitive provider body", { status: 429, statusText: "Too Many Requests" })) as typeof fetch;
  const result = await fetchJinaReader({
    sourceUrl: "https://macro-indicators-a3d.pages.dev/",
    apiKey: "secret",
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "http_error");
  assert.equal(result.status, 429);
  assert.equal(result.text, "");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("Macro Indicators parser preserves the four proven semantic table families", () => {
  const tables = parseMacroIndicatorsMarkdown(completeFixture());
  assert.equal(tables.some((table) => table.kind === "calendar-events" && table.section === "Calendar"), true);
  assert.equal(tables.some((table) => table.kind === "ism-main" && table.section === "ISM"), true);
  assert.equal(tables.some((table) => table.kind === "fedwatch-rate-path" && table.section === "FedWatch"), true);
  assert.equal(tables.some((table) => table.kind === "cot-legacy" && table.section === "COT"), true);

  const cot = tables.find((table) => table.kind === "cot-legacy");
  assert.equal(cot?.raggedRowCount, 1);
  assert.equal(cot?.wellFormedRowCount, 1);
});

test("FedWatch table identity ignores nearby live probabilities and timestamps", () => {
  const table = [
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
  ];
  const first = ["FedWatch", "LIVE Hold 51.2% Hike 48.8% as of 12:46", ...table].join("\n");
  const second = ["FedWatch", "LIVE Hold 48.0% Hike 52.0% as of 13:15", ...table].join("\n");

  assert.equal(parseMacroIndicatorsMarkdown(first)[0]?.tableId, parseMacroIndicatorsMarkdown(second)[0]?.tableId);
});

test("unchanged complete snapshots are identical and volatile Countdown is ignored", () => {
  const first = buildMacroSnapshot(completeFixture({ calendarCountdown: "5m" }), "2026-08-19T08:00:00Z");
  const second = buildMacroSnapshot(completeFixture({ calendarCountdown: "1m" }), "2026-08-19T08:01:00Z");
  const comparison = compareMacroSnapshots(first, second);

  assert.equal(first.status, "COMPLETE");
  assert.equal(second.status, "COMPLETE");
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(comparison.changeCount, 0);
});

test("changed Calendar Actual reports one exact old/new cell", () => {
  const previous = buildMacroSnapshot(completeFixture({ calendarActual: "4.0%" }));
  const current = buildMacroSnapshot(completeFixture({ calendarActual: "4.2%" }));
  const comparison = compareMacroSnapshots(previous, current);

  assert.equal(comparison.changeCount, 1);
  const change = comparison.changes[0];
  assert.equal(change?.type, "CELL_CHANGED");
  if (change?.type === "CELL_CHANGED") {
    assert.equal(change.rowKey, "18-Aug-26|16:20|GDPNow");
    assert.equal(change.column, "Actual");
    assert.equal(change.oldValue, "4.0%");
    assert.equal(change.newValue, "4.2%");
  }
});

test("new Calendar release is ROW_ADDED rather than table rewrite", () => {
  const previous = buildMacroSnapshot(completeFixture());
  const current = buildMacroSnapshot(completeFixture({
    calendarExtraRow: "| 19-Aug-26 | 14:30 | 0m | ★★★ | CPI YoY | 3.4% | 0% | 3.4% | 3.5% | Inflation |",
  }));
  const comparison = compareMacroSnapshots(previous, current);

  assert.equal(comparison.changeCount, 1);
  const change = comparison.changes[0];
  assert.equal(change?.type, "ROW_ADDED");
  if (change?.type === "ROW_ADDED") {
    assert.equal(change.rowKey, "19-Aug-26|14:30|CPI YoY");
    assert.equal(change.row.Actual, "3.4%");
  }
});

test("historical ISM revision preserves the exact period and field", () => {
  const previous = buildMacroSnapshot(completeFixture({ ismHeadline: "55.6" }));
  const current = buildMacroSnapshot(completeFixture({ ismHeadline: "55.8" }));
  const comparison = compareMacroSnapshots(previous, current);

  assert.equal(comparison.changeCount, 1);
  const change = comparison.changes[0];
  assert.equal(change?.type, "CELL_CHANGED");
  if (change?.type === "CELL_CHANGED") {
    assert.equal(change.section, "ISM");
    assert.equal(change.rowKey, "Jul-26");
    assert.equal(change.column, "Headline");
    assert.equal(change.oldValue, "55.6");
    assert.equal(change.newValue, "55.8");
  }
});

test("partial source never emits missing COT as canonical deletion", () => {
  const previous = buildMacroSnapshot(completeFixture({ includeCot: true }));
  const current = buildMacroSnapshot(completeFixture({ includeCot: false }));
  const comparison = compareMacroSnapshots(previous, current);

  assert.equal(current.status, "PARTIAL");
  assert.equal(current.missingSections.includes("COT"), true);
  assert.equal(current.missingRequiredTableFamilies.includes("cot"), true);
  assert.equal(comparison.status, "PARTIAL");
  assert.equal(comparison.missingTableIds.some((id) => id.includes(":cot-")), true);
  assert.equal(comparison.changes.some((change) => change.type === "ROW_REMOVED"), false);
});

test("Test 4: COMPLETE A -> PARTIAL B keeps A current, then COMPLETE C compares against A", () => {
  const a = buildMacroSnapshot(completeFixture({ calendarActual: "4.0%" }), "2026-08-19T08:00:00Z");
  const b = buildMacroSnapshot(completeFixture({ calendarActual: "4.1%", includeCot: false }), "2026-08-19T08:05:00Z");
  const bTransition = evaluateMacroSnapshotCandidate(a, b);

  assert.equal(bTransition.advanced, false);
  assert.equal(bTransition.reason, "partial_rejected");
  assert.equal(bTransition.current?.fingerprint, a.fingerprint);

  const c = buildMacroSnapshot(completeFixture({ calendarActual: "4.2%" }), "2026-08-19T08:10:00Z");
  const cTransition = evaluateMacroSnapshotCandidate(bTransition.current, c);
  assert.equal(cTransition.advanced, true);
  assert.equal(cTransition.comparison?.previousFingerprint, a.fingerprint);
  const changed = cTransition.comparison?.changes.find((change) => change.type === "CELL_CHANGED");
  assert.equal(changed?.type, "CELL_CHANGED");
  if (changed?.type === "CELL_CHANGED") {
    assert.equal(changed.oldValue, "4.0%");
    assert.equal(changed.newValue, "4.2%");
  }
});

test("Test 4: transport failure preserves the last COMPLETE current snapshot", () => {
  const a = buildMacroSnapshot(completeFixture());
  const transition = evaluateMacroSnapshotCandidate(a, null);
  assert.equal(transition.advanced, false);
  assert.equal(transition.reason, "transport_failure");
  assert.equal(transition.current?.fingerprint, a.fingerprint);
  assert.equal(transition.comparison, null);
});

test("Test 4: repeated identical COMPLETE snapshot creates zero false changes", () => {
  const a = buildMacroSnapshot(completeFixture(), "2026-08-19T08:00:00Z");
  const identical = buildMacroSnapshot(completeFixture(), "2026-08-19T08:15:00Z");
  const transition = evaluateMacroSnapshotCandidate(a, identical);
  assert.equal(transition.advanced, true);
  assert.equal(transition.comparison?.changeCount, 0);
  assert.equal(transition.comparison?.changedTableCount, 0);
});
