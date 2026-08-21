import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSectionManifests,
  captureMacroIndicatorsWithDependencies,
  type MacroCaptureAttempt,
  type MacroCaptureStore,
  type MacroSectionManifest,
} from "../lib/macro/macro-capture.ts";
import { buildMacroSnapshot, type MacroSnapshotTable } from "../lib/macro/macro-snapshot.ts";

const ALL_SECTIONS = "Calendar ISM NFIB Housing Energy Bonds Retail Employment Inflation FedWatch Credit COT Commodities";

function fixture(includeCot = true) {
  return [
    ALL_SECTIONS,
    "# Calendar",
    "| Date | Time (CET) | Countdown | Event | Actual | Surprise | Forecast | Previous | Charts |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| 19-Aug-26 | 14:30 | 1m | CPI YoY | 3.4% | 0.0% | 3.4% | 3.5% | Inflation |",
    "# ISM",
    "|  | Headline | New Ord | Prod/BA | Empl | Deliv | Inv | Prices | Backlog | Exports | Imports | Cust/Sent |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| Jul-26 | 55.6 | 56.7 | 58.5 | 52.8 | 58.9 | 51.2 | 71.1 | 55.0 | 53.0 | 55.7 | 40.7 |",
    "# FedWatch",
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
    ...(includeCot ? [
      "# COT",
      "| Instrument | Noncommercial smart money net (1w Δ) | 3y %ile | Commercial net (1w Δ) | 3y %ile | Nonreportable net (1w Δ) | 3y %ile | Open Int. |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      "| Gold | +100 | 90 | -100 | 10 | 0 | 50 | 500 |",
    ] : []),
    "x".repeat(600),
  ].join("\n");
}

type StoredAttempt = { id: string; attempt: MacroCaptureAttempt };

function fakeStore(previousCompleteId: string | null = null) {
  const attempts: StoredAttempt[] = [];
  const sections = new Map<string, MacroSectionManifest[]>();
  const tables = new Map<string, MacroSnapshotTable[]>();
  const rows = new Map<string, MacroSnapshotTable[]>();
  const events: string[] = [];
  let currentCompleteId = previousCompleteId;

  const store: MacroCaptureStore = {
    async latestCompleteSnapshotId() {
      events.push("read-current");
      return currentCompleteId;
    },
    async createAttempt(attempt) {
      const id = `snapshot-${attempts.length + 1}`;
      attempts.push({ id, attempt: { ...attempt } });
      events.push(`create:${attempt.status}`);
      return id;
    },
    async insertSections(snapshotId, values) {
      sections.set(snapshotId, values);
      events.push("sections");
    },
    async insertTables(snapshotId, values) {
      tables.set(snapshotId, values);
      events.push("tables");
    },
    async insertRows(snapshotId, values) {
      rows.set(snapshotId, values);
      events.push("rows");
    },
    async finalizeAttempt(snapshotId, status) {
      const found = attempts.find((attempt) => attempt.id === snapshotId);
      if (!found) throw new Error("missing attempt");
      found.attempt.status = status;
      if (status === "complete") currentCompleteId = snapshotId;
      events.push(`finalize:${status}`);
    },
  };

  return { store, attempts, sections, tables, rows, events };
}

function readerSuccess(text: string) {
  return async () => ({
    ok: true,
    sourceUrl: "https://macro-indicators-a3d.pages.dev/",
    readerUrl: "https://r.jina.ai/https://macro-indicators-a3d.pages.dev/",
    status: 200,
    statusText: "OK",
    usedAuthentication: true,
    text,
    errorCode: null,
    errorMessage: null,
    authenticationMode: "bearer",
  } as const);
}

test("complete Jina capture persists raw/manifest/rows before advancing canonical current", async () => {
  const fake = fakeStore("previous-complete");
  const result = await captureMacroIndicatorsWithDependencies({
    store: fake.store,
    apiKey: "test-key",
    fetchReader: readerSuccess(fixture()),
    now: () => new Date("2026-08-19T15:30:00Z"),
  });

  assert.equal(result.status, "COMPLETE");
  assert.equal(result.attemptSnapshotId, "snapshot-1");
  assert.equal(result.currentSnapshotId, "snapshot-1");
  assert.equal(fake.attempts[0]?.attempt.status, "complete");
  assert.ok(fake.attempts[0]?.attempt.rawMarkdown?.includes("CPI YoY"));
  assert.equal(fake.sections.get("snapshot-1")?.length, 13);
  assert.ok((fake.tables.get("snapshot-1")?.length ?? 0) >= 4);
  assert.ok((fake.rows.get("snapshot-1")?.flatMap((table) => table.rows).length ?? 0) >= 4);
  assert.deepEqual(fake.events.slice(-4), ["sections", "tables", "rows", "finalize:complete"]);
});

test("partial Jina capture is stored but never replaces previous COMPLETE current", async () => {
  const fake = fakeStore("previous-complete");
  const partial = fixture(false).replace(" COT ", " ");
  const result = await captureMacroIndicatorsWithDependencies({
    store: fake.store,
    apiKey: "test-key",
    fetchReader: readerSuccess(partial),
  });

  assert.equal(result.status, "PARTIAL");
  assert.equal(result.attemptSnapshotId, "snapshot-1");
  assert.equal(result.currentSnapshotId, "previous-complete");
  assert.equal(fake.attempts[0]?.attempt.status, "partial");
  assert.ok(fake.attempts[0]?.attempt.missingSections.includes("COT"));
  assert.ok(fake.events.includes("finalize:partial"));
});

test("transport failure records a failed attempt and preserves previous COMPLETE current", async () => {
  const fake = fakeStore("previous-complete");
  const result = await captureMacroIndicatorsWithDependencies({
    store: fake.store,
    apiKey: "test-key",
    fetchReader: async () => ({
      ok: false,
      sourceUrl: "https://macro-indicators-a3d.pages.dev/",
      readerUrl: "https://r.jina.ai/https://macro-indicators-a3d.pages.dev/",
      status: 429,
      statusText: "Too Many Requests",
      usedAuthentication: true,
      text: "",
      errorCode: "http_error",
      errorMessage: "rate limited",
      authenticationMode: "bearer",
    }),
  });

  assert.equal(result.status, "FAILED");
  assert.equal(result.currentSnapshotId, "previous-complete");
  assert.equal(fake.attempts[0]?.attempt.status, "failed");
  assert.equal(fake.attempts[0]?.attempt.transportStatus, 429);
  assert.equal(fake.attempts[0]?.attempt.transportErrorMessage, "rate limited");
  assert.equal(fake.attempts[0]?.attempt.authenticationMode, "bearer");
  assert.equal(fake.sections.size, 0);
  assert.equal(fake.tables.size, 0);
});

test("missing Jina credential performs no transport attempt and preserves current", async () => {
  const fake = fakeStore("previous-complete");
  let called = false;
  const result = await captureMacroIndicatorsWithDependencies({
    store: fake.store,
    apiKey: "",
    fetchReader: async () => {
      called = true;
      throw new Error("should not run");
    },
  });

  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.attemptSnapshotId, null);
  assert.equal(result.currentSnapshotId, "previous-complete");
  assert.equal(called, false);
  assert.equal(fake.attempts.length, 0);
});

test("section manifest is complete and marks a missing source section explicitly", () => {
  const partial = fixture(false).replace(" COT ", " ");
  const snapshot = buildMacroSnapshot(partial, "2026-08-19T15:30:00Z");
  const manifest = buildSectionManifests(snapshot);

  assert.equal(manifest.length, 13);
  assert.equal(manifest.find((section) => section.sectionKey === "COT")?.status, "missing");
  assert.equal(manifest.find((section) => section.sectionKey === "Calendar")?.status, "captured");
});
