import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTradingEconomicsUsCalendarUrl,
  fetchTradingEconomicsUsCalendarSnapshot,
  parseTradingEconomicsNumber,
  parseTradingEconomicsUsCalendarPayload,
} from "../lib/providers/trading-economics-calendar.ts";

test("Trading Economics calendar URL uses bounded US high-importance dates without embedding credentials", () => {
  const url = new URL(
    buildTradingEconomicsUsCalendarUrl({
      from: new Date("2026-09-22T00:00:00.000Z"),
      to: new Date("2026-09-24T12:00:00.000Z"),
    }),
  );

  assert.equal(
    url.origin + url.pathname,
    "https://api.tradingeconomics.com/calendar/country/united%20states/2026-09-22/2026-09-24",
  );
  assert.equal(url.searchParams.get("importance"), "3");
  assert.equal(url.searchParams.get("f"), "json");
  assert.equal(url.searchParams.has("c"), false);
});

test("Trading Economics parser separates survey consensus from TE forecast and computes surprise", () => {
  const result = parseTradingEconomicsUsCalendarPayload(
    [{
      CalendarId: "123",
      Date: "2026-09-24T12:30:00",
      Country: "United States",
      Category: "Manufacturing PMI",
      Event: "S&P Global Manufacturing PMI Flash",
      Reference: "Sep",
      Source: "S&P Global",
      SourceURL: "https://www.spglobal.com/",
      Actual: "57.0",
      Previous: "53.9",
      Forecast: "53.6",
      TEForecast: "53.8",
      Importance: 3,
      LastUpdate: "2026-09-24T12:31:00",
    }],
    { retrievedAt: "2026-09-24T12:32:00.000Z" },
  );

  assert.equal(result.state, "ready");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].consensus, "53.6");
  assert.equal(result.events[0].teForecast, "53.8");
  assert.equal(result.events[0].parsedActual, 57);
  assert.equal(result.events[0].parsedConsensus, 53.6);
  assert.ok(Math.abs((result.events[0].surprise ?? 0) - 3.4) < 1e-9);
});

test("Trading Economics numeric parser handles common calendar suffixes", () => {
  assert.equal(parseTradingEconomicsNumber("-340B"), -340_000_000_000);
  assert.equal(parseTradingEconomicsNumber("250K"), 250_000);
  assert.equal(parseTradingEconomicsNumber("3.4%"), 3.4);
  assert.equal(parseTradingEconomicsNumber(""), null);
});

test("Trading Economics fetch is optional when no key is configured", async () => {
  const result = await fetchTradingEconomicsUsCalendarSnapshot({
    apiKey: "",
    from: new Date("2026-09-22T00:00:00.000Z"),
    to: new Date("2026-09-24T00:00:00.000Z"),
  });

  assert.equal(result.state, "unconfigured");
  assert.equal(result.events.length, 0);
  assert.match(result.note ?? "", /optional event-surprise enrichment is skipped/i);
});

test("Trading Economics fetch sends credentials in Authorization header, not URL", async () => {
  let requestedUrl = "";
  let requestedHeaders: Headers | null = null;

  const result = await fetchTradingEconomicsUsCalendarSnapshot({
    apiKey: "secret-test-key",
    from: new Date("2026-09-22T00:00:00.000Z"),
    to: new Date("2026-09-24T00:00:00.000Z"),
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      requestedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(result.state, "ready");
  assert.equal(requestedUrl.includes("secret-test-key"), false);
  assert.equal(requestedHeaders?.get("authorization"), "secret-test-key");
});
