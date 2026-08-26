import assert from "node:assert/strict";
import test from "node:test";

import {
  acquireEventHorizonEvents,
  parseFederalReserveCalendar,
  parseOpecForwardMeetings,
} from "../lib/event-horizon-acquisition.ts";
import { dedupeMarketEvents } from "../lib/market-events.ts";

const now = new Date("2026-08-26T00:00:00.000Z");

function responseFor(url: string, body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": url.endsWith(".json") ? "application/json" : "text/html", ...headers } });
}

test("acquires official Fed appearances and an announced OPEC meeting with honest date-only timing", async () => {
  const result = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("federalreserve")) return responseFor(url, JSON.stringify({ events: [{
        title: "Speech - Governor Example", description: "Economic Outlook", location: "At Jackson Hole", time: "10:00 a.m.", month: "2026-08", days: "28", type: "Speeches",
      }] }));
      return responseFor(url, "Hold the 42nd OPEC and non-OPEC Ministerial Meeting on 29 November 2026.");
    },
  });

  assert.equal(result.events.length, 2);
  const fed = result.events.find((event) => event.eventType === "central_bank_speech")!;
  assert.equal(fed.startAt, "2026-08-28");
  assert.equal(fed.timePrecision, "date");
  assert.equal(fed.timeLabel, "10:00 a.m.");
  assert.equal(fed.verificationState, "official");
  assert.match(fed.sourceUrl, /federalreserve\.gov/);
  const opec = result.events.find((event) => event.eventType === "energy_policy_meeting")!;
  assert.equal(opec.startAt, "2026-11-29");
  assert.equal(opec.timePrecision, "date");
  assert.deepEqual(opec.affectedAssets, ["WTI", "BRENT"]);
  assert.equal(result.coverage.find((item) => item.family === "central_bank_appearances")?.state, "covered");
  assert.equal(result.coverage.find((item) => item.family === "energy_policy")?.state, "covered");
});

test("an operational source with no confirmed event is covered, not an invented empty calendar", async () => {
  const result = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => responseFor(String(input), String(input).includes("federalreserve") ? JSON.stringify({ events: [] }) : "No future meeting announced."),
  });
  assert.equal(result.events.length, 0);
  assert.equal(result.coverage.find((item) => item.family === "central_bank_appearances")?.state, "covered");
  assert.equal(result.coverage.find((item) => item.family === "central_bank_appearances")?.confirmedEventCount, 0);
  assert.equal(result.coverage.find((item) => item.family === "energy_policy")?.state, "covered");
});

test("source failure and unsupported families remain machine-readable blind spots", async () => {
  const result = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => responseFor(String(input), "upstream unavailable", 503),
  });
  assert.equal(result.events.length, 0);
  assert.equal(result.coverage.find((item) => item.family === "central_bank_appearances")?.state, "source_failed");
  assert.equal(result.coverage.find((item) => item.family === "geopolitical_diplomatic")?.state, "unsupported");
  assert.equal(result.coverage.find((item) => item.family === "treasury_fiscal")?.state, "unsupported");
  assert.equal(result.warnings.length, 2);
});

test("unavailable endpoints and stale feeds are distinct from an operational empty source", async () => {
  const unavailable = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => responseFor(String(input), "not found", 404),
  });
  assert.equal(unavailable.coverage.find((item) => item.family === "central_bank_appearances")?.state, "unavailable");

  const stale = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => responseFor(
      String(input),
      String(input).includes("federalreserve") ? JSON.stringify({ events: [] }) : "No future meeting announced.",
      200,
      { "last-modified": "Wed, 01 Jul 2026 00:00:00 GMT" },
    ),
  });
  assert.equal(stale.coverage.find((item) => item.family === "central_bank_appearances")?.state, "stale");
});

test("confirmed timing and source wording dedupe against the same OPEC occurrence", () => {
  const first = parseOpecForwardMeetings("Hold the 42nd OPEC and non-OPEC Ministerial Meeting on 29 November 2026.", "https://www.opec.org/a", now)[0]!;
  const second = parseOpecForwardMeetings("The next meeting will be held the 42nd OPEC and non-OPEC Ministerial Meeting on 29 November 2026.", "https://www.opec.org/b", new Date("2026-08-27T00:00:00.000Z"))[0]!;
  const [event] = dedupeMarketEvents([first, second]);
  assert.equal(event.id, first.id);
  assert.deepEqual(event.sourceUrls, ["https://www.opec.org/a", "https://www.opec.org/b"]);
});

test("Fed date-only entries do not manufacture an offset-aware timestamp", () => {
  const [event] = parseFederalReserveCalendar({ events: [{ title: "Testimony - Chair Example", time: "Time TBC", month: "2026-09", days: "10", type: "Testimony" }] }, now);
  assert.equal(event.startAt, "2026-09-10");
  assert.equal(event.timePrecision, "date");
  assert.equal(event.timeLabel, "Time TBC");
});
