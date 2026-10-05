import assert from "node:assert/strict";
import test from "node:test";

import {
  BARCHART_MOVE_SYMBOL,
  barchartMoveQueryUrl,
  fetchBarchartMoveSnapshot,
  parseBarchartMovePayload,
} from "../lib/providers/barchart-move.ts";

const NOW = new Date("2026-10-05T12:00:00.000Z");

test("MOVE adapter parses direct $MOVE history without proxy substitution", () => {
  const snapshot = parseBarchartMovePayload({
    status: { code: 200, message: "Success." },
    results: [
      {
        symbol: "$MOVE",
        timestamp: "2026-10-01T00:00:00-04:00",
        tradingDay: "2026-10-01",
        close: 108.25,
      },
      {
        symbol: "$MOVE",
        timestamp: "2026-10-02T00:00:00-04:00",
        tradingDay: "2026-10-02",
        close: "111.75",
      },
    ],
  }, NOW.toISOString());

  assert.equal(snapshot.state, "ready");
  assert.equal(snapshot.symbol, BARCHART_MOVE_SYMBOL);
  assert.equal(snapshot.points.length, 2);
  assert.equal(snapshot.points.at(-1)?.close, 111.75);
  assert.match(snapshot.sourceName, /ICE BofA MOVE Index/);
  assert.doesNotMatch(snapshot.sourceName, /VIX|proxy/i);
});

test("MOVE query is bounded to direct daily $MOVE history", () => {
  const url = new URL(barchartMoveQueryUrl(NOW, "test-key"));

  assert.equal(url.origin + url.pathname, "https://ondemand.websol.barchart.com/getHistory.json");
  assert.equal(url.searchParams.get("apikey"), "test-key");
  assert.equal(url.searchParams.get("symbol"), "$MOVE");
  assert.equal(url.searchParams.get("type"), "daily");
  assert.equal(url.searchParams.get("startDate"), "20260607");
  assert.equal(url.searchParams.get("endDate"), "20261005");
  assert.equal(url.searchParams.get("maxRecords"), "180");
  assert.equal(url.searchParams.get("order"), "asc");
});

test("MOVE acquisition fails closed without a configured credential", async () => {
  let called = false;
  const snapshot = await fetchBarchartMoveSnapshot({
    now: NOW,
    apiKey: null,
    fetchImpl: async () => {
      called = true;
      return new Response("unexpected");
    },
  });

  assert.equal(called, false);
  assert.equal(snapshot.state, "unconfigured");
  assert.deepEqual(snapshot.points, []);
  assert.match(snapshot.warnings[0] ?? "", /BARCHART_API_KEY/);
});

test("MOVE acquisition rejects provider failures without inventing a volatility value", async () => {
  const snapshot = await fetchBarchartMoveSnapshot({
    now: NOW,
    apiKey: "test-key",
    fetchImpl: async () => new Response("down", { status: 503 }),
  });

  assert.equal(snapshot.state, "unavailable");
  assert.deepEqual(snapshot.points, []);
  assert.match(snapshot.warnings[0] ?? "", /HTTP 503/);
});

test("MOVE parser rejects success envelopes without enough usable history", () => {
  const snapshot = parseBarchartMovePayload({
    status: { code: 200 },
    results: [{ symbol: "$MOVE", tradingDay: "2026-10-02", close: 111.75 }],
  }, NOW.toISOString());

  assert.equal(snapshot.state, "unavailable");
  assert.deepEqual(snapshot.points, []);
});
