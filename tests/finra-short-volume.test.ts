import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFinraConsolidatedNmsUrl,
  fetchFinraConsolidatedShortVolume,
  formatFinraTradeDate,
  normalizeFinraTradeDate,
  parseFinraConsolidatedShortVolume,
} from "../lib/providers/finra-short-volume.ts";

test("FINRA consolidated NMS URL and trade-date normalization are deterministic", () => {
  assert.equal(normalizeFinraTradeDate("2026-08-07"), "20260807");
  assert.equal(normalizeFinraTradeDate("20260807"), "20260807");
  assert.equal(formatFinraTradeDate("20260807"), "2026-08-07");
  assert.equal(
    buildFinraConsolidatedNmsUrl("2026-08-07"),
    "https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260807.txt",
  );
  assert.throws(() => normalizeFinraTradeDate("2026-02-30"), /invalid/);
  assert.throws(() => normalizeFinraTradeDate("08/07/2026"), /YYYY-MM-DD/);
});

test("FINRA parser preserves fractional volume, market facilities, and reported-volume share", () => {
  const rows = parseFinraConsolidatedShortVolume([
    "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market",
    "20260807|AAPL|5540409.463985|31490.250000|13330297.818991|B,Q,N",
    "20260807|NVDA|4000000|1000|10000000|Q,N",
  ].join("\n"), { expectedTradeDate: "2026-08-07" });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].symbol, "AAPL");
  assert.equal(rows[0].shortVolume, 5540409.463985);
  assert.equal(rows[0].shortExemptVolume, 31490.25);
  assert.deepEqual(rows[0].marketCodes, ["B", "Q", "N"]);
  assert.ok(rows[0].shortShareOfReportedVolume !== null);
  assert.equal(
    rows[0].shortShareOfReportedVolume,
    5540409.463985 / 13330297.818991,
  );
});

test("FINRA parser can narrow one public file to a bounded symbol watchlist", () => {
  const rows = parseFinraConsolidatedShortVolume([
    "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market",
    "20260807|AAPL|100|0|200|B,Q,N",
    "20260807|MSFT|150|0|300|Q,N",
    "20260807|NVDA|250|10|400|B,Q,N",
  ].join("\n"), {
    expectedTradeDate: "20260807",
    symbols: ["nvda", "aapl"],
  });

  assert.deepEqual(rows.map((row) => row.symbol), ["AAPL", "NVDA"]);
});

test("FINRA parser rejects schema drift and skips malformed rows without fabricating data", () => {
  assert.throws(
    () => parseFinraConsolidatedShortVolume("Date|Ticker|ShortVolume\n20260807|AAPL|10"),
    /header is not recognized/,
  );

  const rows = parseFinraConsolidatedShortVolume([
    "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market",
    "20260807|AAPL|not-a-number|0|200|Q",
    "20260807|MSFT|100|0|-5|Q",
    "20260806|NVDA|100|0|200|Q",
    "20260807|TSLA|50|0|100|Q",
  ].join("\n"), { expectedTradeDate: "2026-08-07" });

  assert.deepEqual(rows.map((row) => row.symbol), ["TSLA"]);
});

test("FINRA fetch returns ready data from the public file without credentials", async () => {
  const seen: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    seen.push(String(input));
    return new Response([
      "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market",
      "20260807|AAPL|100|5|250|B,Q,N",
      "20260807|NVDA|200|0|400|Q,N",
    ].join("\n"), { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof fetch;

  const result = await fetchFinraConsolidatedShortVolume("2026-08-07", {
    symbols: ["AAPL"],
    fetchImpl,
  });

  assert.equal(result.state, "ready");
  assert.equal(result.tradeDate, "2026-08-07");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].symbol, "AAPL");
  assert.equal(result.rows[0].shortShareOfReportedVolume, 0.4);
  assert.match(result.scopeNote, /not short interest/i);
  assert.deepEqual(seen, ["https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260807.txt"]);
});

test("FINRA fetch reports unavailable explicitly when the expected daily file is absent", async () => {
  const fetchImpl = (async () => new Response("not found", { status: 404 })) as typeof fetch;
  const result = await fetchFinraConsolidatedShortVolume("2026-08-08", { fetchImpl });

  assert.equal(result.state, "unavailable");
  assert.equal(result.rows.length, 0);
  assert.match(result.note || "", /HTTP 404/);
  assert.match(result.sourceUrl, /CNMSshvol20260808\.txt$/);
});
