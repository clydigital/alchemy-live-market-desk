import assert from "node:assert/strict";
import test from "node:test";

import { fetchFinnhubEarnings, parseFinnhubEarningsCalendar } from "../lib/finnhub-earnings.ts";
import { getForwardEarningsEvents } from "../lib/forward-earnings-sources.ts";

const NOW = new Date("2026-10-12T05:00:00Z");
const rows = {
  earningsCalendar: [
    { symbol: "NVDA", date: "2026-11-13", hour: "amc", year: 2027, quarter: 1, epsEstimate: 1.12, revenueEstimate: 34000000000, epsActual: null },
    { symbol: "TSM", date: "2026-10-17", hour: "bmo", epsEstimate: 1.5, revenueEstimate: 20000000000 },
    { symbol: "MSFT", date: "2026-10-28", hour: "dmh", epsEstimate: 0, revenueEstimate: null },
    { symbol: "ZZZZ", date: "2026-10-29", hour: "amc", epsEstimate: 3 },
    { symbol: "AMD", date: "2026-10-22", epsActual: 1.2, revenueActual: 10000 },
    { symbol: "GOOGL", date: "2026-02-30" },
    { symbol: "META", date: "2026-12-30" },
  ],
};

test("Finnhub parser selects forward priority tickers; no actuals, invalid days or distant dates", () => {
  const events = parseFinnhubEarningsCalendar(rows, NOW);
  assert.deepEqual(events.map(row => row.affectedAssets[0]), ["TSM", "MSFT", "NVDA"]);
  assert.ok(events.every(row => row.verificationState === "reported" && row.timePrecision === "date"));
  assert.match(events.find(row => row.affectedAssets[0] === "NVDA")?.expectation || "", /Revenue estimate \$34B/);
  assert.match(events.find(row => row.affectedAssets[0] === "MSFT")?.expectation || "", /EPS estimate 0\.00/);
  assert.match(events.find(row => row.affectedAssets[0] === "NVDA")?.expectedStage || "", /verify with issuer/);
});

test("Finnhub BMO/AMC/DMH labels never invent an exact timestamp", () => {
  const events = parseFinnhubEarningsCalendar(rows, NOW);
  const labels = events.map(event => event.timeLabel || "");
  assert.ok(labels.some(label => label.includes("Before US market open") && label.includes("exact time unconfirmed")));
  assert.ok(labels.some(label => label.includes("After US market close") && label.includes("exact time unconfirmed")));
  assert.ok(labels.some(label => label.includes("During US market hours") && label.includes("exact time unconfirmed")));
});

test("Finnhub request uses one bounded range; secret only in server request header", async () => {
  let url = "", init: RequestInit | undefined;
  const mock = (async (input: string | URL | Request, requestInit?: RequestInit) => {
    url = String(input);
    init = requestInit;
    return { ok: true, json: async () => rows };
  }) as unknown as typeof fetch;
  const events = await fetchFinnhubEarnings({ now: NOW, apiKey: "private-test-only", fetchImpl: mock });
  assert.equal(events.length, 3);
  assert.match(url, /^https:\/\/finnhub\.io\/api\/v1\/calendar\/earnings\?/);
  assert.match(url, /from=2026-10-12/);
  assert.match(url, /to=2026-11-26/);
  assert.doesNotMatch(url, /private-test-only|token=/);
  assert.equal((init?.headers as Record<string, string>)["X-Finnhub-Token"], "private-test-only");
});

test("commercial rights gate forbids even one Finnhub request when unapproved", async () => {
  let calls = 0;
  const mock = (async () => { calls++; throw Error("should not call"); }) as unknown as typeof fetch;
  const result = await getForwardEarningsEvents({
    now: NOW, finnhubKey: "private-test-only", finnhubCommercialApproved: false, fetchImpl: mock,
  });
  assert.equal(calls, 0);
  assert.equal(result.coverage, "official_only");
  assert.match(result.warning || "", /not authorised/);
});

test("Finnhub approved result preserves issuer dates even with conflicting third-party dates", async () => {
  const mock = (async () => ({ ok: true, json: async () => rows })) as unknown as typeof fetch;
  const result = await getForwardEarningsEvents({
    now: NOW, finnhubKey: "private-test-only", finnhubCommercialApproved: true, fetchImpl: mock,
  });
  assert.equal(result.coverage, "official_and_provider");
  assert.equal(result.events.filter(row => row.affectedAssets[0] === "TSM").length, 1);
  assert.equal(result.events.find(row => row.affectedAssets[0] === "TSM")?.verificationState, "official");
  assert.ok(result.events.some(row => row.affectedAssets[0] === "NVDA" && row.verificationState === "reported"));
});

test("Finnhub HTTP entitlement failures and malformed payloads retain verified issuer fallback", async () => {
  for (const response of [
    { ok: false, status: 403 },
    { ok: true, json: async () => ({ error: "not included" }) },
    { ok: true, json: async () => ({ earningsCalendar: [] }) },
  ]) {
    const mock = (async () => response) as unknown as typeof fetch;
    const result = await getForwardEarningsEvents({
      now: NOW, finnhubKey: "private-test-only", finnhubCommercialApproved: true, fetchImpl: mock,
    });
    assert.equal(result.coverage, "official_only");
    assert.ok(result.events.every(row => row.verificationState === "official"));
    assert.ok(result.warning);
  }
});

test("absent Finnhub credentials cannot trigger legacy Parse provider automatically", async () => {
  let calls = 0;
  const mock = (async () => { calls++; throw Error("unexpected"); }) as unknown as typeof fetch;
  const result = await getForwardEarningsEvents({
    now: NOW, finnhubKey: "", finnhubCommercialApproved: false, fetchImpl: mock,
  });
  assert.equal(calls, 0);
  assert.match(result.warning || "", /Finnhub earnings feed inactive/);
});
