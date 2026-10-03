import assert from "node:assert/strict";
import test from "node:test";

import {
  JAPAN_MOF_JGB_CURRENT_URL,
  JAPAN_MOF_JGB_HISTORY_URL,
  fetchJapanMofJgbYields,
  parseJapanMofJgbCsv,
} from "../lib/providers/japan-mof-jgb-yields.ts";

function csv(rows: string[]) {
  return [
    "Source: Ministry of Finance",
    "Date,1,2,3,4,5,6,7,8,9,10,15,20,25,30,40",
    ...rows,
  ].join("\n");
}

test("JGB parser binds official constant-maturity 2Y/10Y/30Y columns", () => {
  const rows = parseJapanMofJgbCsv(csv([
    "2026-09-30,2.10,2.20,2.30,2.40,2.50,2.60,2.70,2.80,2.90,3.00,3.10,3.20,3.30,3.40,3.50",
    "2026-10-01,2.11,2.21,2.31,2.41,2.51,2.61,2.71,2.81,2.91,3.01,3.11,3.21,3.31,3.41,3.51",
  ]));

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], {
    date: "2026-10-01",
    y2: 2.21,
    y10: 3.01,
    y30: 3.41,
  });
});

test("JGB parser fails closed on headers and malformed rows", () => {
  assert.deepEqual(parseJapanMofJgbCsv("Date,1,2\nnot-a-date,1,2"), []);
});

test("JGB fetch merges history/current and computes five-observation changes", async () => {
  const history = csv([
    "2026-09-24,2.00,2.10,2.20,2.30,2.40,2.50,2.60,2.70,2.80,2.90,3.00,3.10,3.20,3.30,3.40",
    "2026-09-25,2.01,2.11,2.21,2.31,2.41,2.51,2.61,2.71,2.81,2.91,3.01,3.11,3.21,3.31,3.41",
    "2026-09-28,2.02,2.12,2.22,2.32,2.42,2.52,2.62,2.72,2.82,2.92,3.02,3.12,3.22,3.32,3.42",
    "2026-09-29,2.03,2.13,2.23,2.33,2.43,2.53,2.63,2.73,2.83,2.93,3.03,3.13,3.23,3.33,3.43",
    "2026-09-30,2.04,2.14,2.24,2.34,2.44,2.54,2.64,2.74,2.84,2.94,3.04,3.14,3.24,3.34,3.44",
  ]);
  const current = csv([
    "2026-10-01,2.10,2.20,2.30,2.40,2.50,2.60,2.70,2.80,2.90,3.00,3.10,3.20,3.30,3.40,3.50",
  ]);

  const seen: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    seen.push(url);
    return new Response(url.includes("historical") ? history : current, { status: 200 });
  }) as typeof fetch;

  const snapshot = await fetchJapanMofJgbYields(
    new Date("2026-10-02T03:00:00Z"),
    fetchImpl,
  );

  assert.deepEqual(seen.sort(), [JAPAN_MOF_JGB_CURRENT_URL, JAPAN_MOF_JGB_HISTORY_URL].sort());
  assert.equal(snapshot.status, "OK");
  assert.equal(snapshot.asOf, "2026-10-01");
  assert.equal(snapshot.latest?.y2, 2.20);
  assert.equal(snapshot.latest?.y10, 3.00);
  assert.equal(snapshot.latest?.y30, 3.40);
  assert.equal(snapshot.changes5dBp.y2, 10);
  assert.equal(snapshot.changes5dBp.y10, 10);
  assert.equal(snapshot.changes5dBp.y30, 10);
});

test("JGB provider degrades explicitly when source coverage is incomplete", async () => {
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("historical")) return new Response("missing", { status: 404 });
    return new Response(csv([
      "2026-10-01,2.10,2.20,2.30,2.40,2.50,2.60,2.70,2.80,2.90,3.00,3.10,3.20,3.30,3.40,3.50",
    ]), { status: 200 });
  }) as typeof fetch;

  const snapshot = await fetchJapanMofJgbYields(new Date("2026-10-02T03:00:00Z"), fetchImpl);
  assert.equal(snapshot.status, "PARTIAL");
  assert.equal(snapshot.previous5, null);
  assert.match(snapshot.warnings.join(" "), /Historical JGB CSV unavailable/);
  assert.match(snapshot.warnings.join(" "), /Fewer than six/);
});
