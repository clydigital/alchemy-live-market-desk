import assert from "node:assert/strict";
import test from "node:test";

import { inventoryMarkdownTables } from "../lib/jina-macro-source-diagnostic.ts";

test("1C table IDs ignore dynamic FedWatch context values and timestamps", () => {
  const headers = [
    "| Rate | 6m | 3m | 1m | 1w | 1d | Now LIVE |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 4.25-4.50 | 0% | 1% | 2% | 3% | 4% | 5% |",
  ];
  const first = [
    "FedWatch",
    "LIVE Cut 0.0% Hold 51.2% Hike 48.8% CME as of 19 Aug 2026 12:46:11 CT",
    ...headers,
  ].join("\n");
  const second = [
    "FedWatch",
    "LIVE Cut 0.0% Hold 48.0% Hike 52.0% CME as of 19 Aug 2026 13:15:00 CT",
    ...headers,
  ].join("\n");

  const firstTable = inventoryMarkdownTables(first)[0];
  const secondTable = inventoryMarkdownTables(second)[0];

  assert.equal(firstTable?.kind, "fedwatch-rate-path");
  assert.equal(secondTable?.kind, "fedwatch-rate-path");
  assert.notEqual(firstTable?.contextLabel, secondTable?.contextLabel);
  assert.equal(firstTable?.tableId, secondTable?.tableId);
});

test("1C table IDs ignore dynamic ISM nearby values while preserving occurrence order", () => {
  const table = [
    "|  | HL | NOrd | BusA | Empl | Dlvr | Inv | Price |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| Jul-26 | +7 | +9 | 0 | 0 | +10 | +5 | +17 |",
  ];
  const first = [
    "ISM",
    "May-26 +11 Effective commodity prices increased",
    ...table,
    "Jun-26 +12 Top-line growth continued",
    ...table,
  ].join("\n");
  const second = [
    "ISM",
    "May-26 +8 Commodity prices eased",
    ...table,
    "Jun-26 +9 Top-line growth slowed",
    ...table,
  ].join("\n");

  const firstIds = inventoryMarkdownTables(first).map((item) => item.tableId);
  const secondIds = inventoryMarkdownTables(second).map((item) => item.tableId);
  assert.deepEqual(firstIds, secondIds);
  assert.equal(new Set(firstIds).size, 2);
});
