import assert from "node:assert/strict";
import test from "node:test";

import { fetchTwelveDataReactionSnapshot } from "../lib/providers/twelve-data-reactions.ts";

function series(symbol: string, closes: Array<[string, number]>) {
  return {
    meta: { symbol, interval: "1min", timezone: "UTC" },
    values: closes.map(([datetime, close]) => ({
      datetime,
      open: String(close),
      high: String(close),
      low: String(close),
      close: String(close),
      volume: "100",
    })),
    status: "ok",
  };
}

test("Twelve Data reactions stay dormant without a configured API key", async () => {
  let calls = 0;
  const result = await fetchTwelveDataReactionSnapshot({
    asOf: "2026-09-28T18:30:00Z",
    triggers: [{ evidenceId: "ev:fomc", occurredAt: "2026-09-28T14:00:00Z" }],
    apiKey: null,
    fetchImpl: (async () => {
      calls += 1;
      throw new Error("should not fetch");
    }) as typeof fetch,
  });

  assert.equal(result.state, "unconfigured");
  assert.equal(result.records.length, 0);
  assert.equal(calls, 0);
});

test("Twelve Data reactions compute 5m, 30m and 4h windows from exact UTC bars", async () => {
  const payload = {
    UUP: series("UUP", [
      ["2026-09-28 13:59:00", 30],
      ["2026-09-28 14:05:00", 30.15],
      ["2026-09-28 14:30:00", 30.3],
      ["2026-09-28 18:00:00", 30.6],
    ]),
    GLD: series("GLD", [
      ["2026-09-28 13:59:00", 400],
      ["2026-09-28 14:05:00", 399],
      ["2026-09-28 14:30:00", 398],
      ["2026-09-28 18:00:00", 396],
    ]),
    SMH: series("SMH", [
      ["2026-09-28 13:59:00", 350],
      ["2026-09-28 14:05:00", 348],
      ["2026-09-28 14:30:00", 346.5],
      ["2026-09-28 18:00:00", 343],
    ]),
  };

  let requestedUrl = "";
  let auth = "";
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    auth = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
    return {
      ok: true,
      status: 200,
      async json() { return payload; },
    } as Response;
  }) as typeof fetch;

  const result = await fetchTwelveDataReactionSnapshot({
    asOf: "2026-09-28T18:30:00Z",
    triggers: [{ evidenceId: "ev:fomc", occurredAt: "2026-09-28T14:00:00Z" }],
    apiKey: "secret-test-key",
    fetchImpl,
  });

  assert.equal(result.state, "ready");
  assert.equal(result.records.length, 3);
  assert.match(requestedUrl, /symbol=UUP%2CGLD%2CSMH/);
  assert.match(requestedUrl, /interval=1min/);
  assert.match(requestedUrl, /timezone=UTC/);
  assert.equal(auth, "apikey secret-test-key");

  const dxy = result.records.find((item) => item.monitorId === "dxy");
  const gold = result.records.find((item) => item.monitorId === "gold");
  const smh = result.records.find((item) => item.monitorId === "smh");

  assert.equal(dxy?.observedInstrument, "UUP");
  assert.equal(dxy?.isProxy, true);
  assert.deepEqual(dxy?.windows.map((item) => item.window), ["5m", "30m", "4h"]);
  assert.equal(dxy?.windows.find((item) => item.window === "30m")?.changePct, 1);
  assert.equal(gold?.windows.find((item) => item.window === "30m")?.changePct, -0.5);
  assert.equal(smh?.isProxy, false);
  assert.equal(smh?.windows.find((item) => item.window === "4h")?.changePct, -2);
});

test("Twelve Data reactions fail closed when no pre-trigger regular-session baseline exists", async () => {
  const payload = {
    UUP: series("UUP", [
      ["2026-09-28 13:30:00", 30],
      ["2026-09-28 14:00:00", 30.1],
    ]),
    GLD: series("GLD", [
      ["2026-09-28 13:30:00", 400],
      ["2026-09-28 14:00:00", 399],
    ]),
    SMH: series("SMH", [
      ["2026-09-28 13:30:00", 350],
      ["2026-09-28 14:00:00", 348],
    ]),
  };
  const fetchImpl = (async () => ({
    ok: true,
    status: 200,
    async json() { return payload; },
  } as Response)) as typeof fetch;

  const result = await fetchTwelveDataReactionSnapshot({
    asOf: "2026-09-28T14:30:00Z",
    triggers: [{ evidenceId: "ev:cpi", occurredAt: "2026-09-28T12:30:00Z" }],
    apiKey: "secret-test-key",
    fetchImpl,
  });

  assert.equal(result.state, "ready");
  assert.equal(result.records.length, 0);
});

test("Twelve Data provider failure remains optional and unavailable", async () => {
  const fetchImpl = (async () => ({
    ok: false,
    status: 429,
  } as Response)) as typeof fetch;

  const result = await fetchTwelveDataReactionSnapshot({
    asOf: "2026-09-28T18:30:00Z",
    triggers: [{ evidenceId: "ev:fomc", occurredAt: "2026-09-28T14:00:00Z" }],
    apiKey: "secret-test-key",
    fetchImpl,
  });

  assert.equal(result.state, "unavailable");
  assert.equal(result.records.length, 0);
  assert.match(result.warnings.join(" "), /429/);
});
