import assert from "node:assert/strict";
import test from "node:test";

import {
  acquireEventHorizonEvents,
  parseFederalReserveCalendar,
  parseOpecForwardMeetings,
  parseOpecPressReleaseLinks,
} from "../lib/event-horizon-acquisition.ts";
import { dedupeMarketEvents } from "../lib/market-events.ts";

const now = new Date("2026-08-26T00:00:00.000Z");

function responseFor(url: string, body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": url.endsWith(".json") ? "application/json" : "text/html", ...headers } });
}

const opecIndex = (links = ["/pr-detail/555-07-june-2026.html"]) =>
  `<main><a href="${links[0]}">OPEC and non-OPEC Ministerial Meeting</a>${links.slice(1).map((link) => `<a href="${link}">Press release</a>`).join("")}</main>`;

test("acquires official Fed appearances and an announced OPEC meeting with honest date-only timing", async () => {
  const result = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("federalreserve")) return responseFor(url, JSON.stringify({ events: [{
        title: "Speech - Governor Example", description: "Economic Outlook", location: "At Jackson Hole", time: "10:00 a.m.", month: "2026-08", days: "28", type: "Speeches",
      }] }));
      if (url.endsWith("/press-releases.html")) return responseFor(url, opecIndex());
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
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("federalreserve")) return responseFor(url, JSON.stringify({ events: [] }));
      if (url.endsWith("/press-releases.html")) return responseFor(url, opecIndex());
      return responseFor(url, "No future meeting announced.");
    },
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

test("unavailable endpoints and stale empty feeds are distinct from an operational empty source", async () => {
  const unavailable = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => responseFor(String(input), "not found", 404),
  });
  assert.equal(unavailable.coverage.find((item) => item.family === "central_bank_appearances")?.state, "unavailable");

  const stale = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => {
      const url = String(input);
      const body = url.includes("federalreserve")
        ? JSON.stringify({ events: [] })
        : url.endsWith("/press-releases.html") ? opecIndex() : "No future meeting announced.";
      return responseFor(url, body, 200, { "last-modified": "Wed, 01 Jul 2026 00:00:00 GMT" });
    },
  });
  assert.equal(stale.coverage.find((item) => item.family === "central_bank_appearances")?.state, "stale");
});

test("old document metadata does not stale a Fed or OPEC family with future canonical events", async () => {
  const result = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => {
      const url = String(input);
      const body = url.includes("federalreserve")
        ? JSON.stringify({ events: [{ title: "Speech - Governor Example", month: "2026-08", days: "28", type: "Speeches" }] })
        : url.endsWith("/press-releases.html") ? opecIndex() : "Hold the 42nd OPEC and non-OPEC Ministerial Meeting on 29 November 2026.";
      return responseFor(url, body, 200, { "last-modified": "Wed, 01 Jul 2026 00:00:00 GMT" });
    },
  });
  assert.equal(result.coverage.find((item) => item.family === "central_bank_appearances")?.state, "covered");
  assert.equal(result.coverage.find((item) => item.family === "energy_policy")?.state, "covered");
});


test("OPEC index parser accepts only bounded official press-release detail links", () => {
  const html = `
    <a href="/pr-detail/555-07-june-2026.html">Ministerial meeting</a>
    <a href="https://www.opec.org/pr-detail/jmmc-04-october-2026.html">JMMC</a>
    <a href="/pr-detail/555-07-june-2026.html">duplicate</a>
    <a href="https://example.com/pr-detail/fake.html">external</a>
    <a href="/publications.html">not a press release</a>
  `;
  assert.deepEqual(parseOpecPressReleaseLinks(html), [
    "https://www.opec.org/pr-detail/555-07-june-2026.html",
    "https://www.opec.org/pr-detail/jmmc-04-october-2026.html",
  ]);
});

test("current OPEC wording exposes scheduled JMMC and OPEC+ meetings without inference", () => {
  const jmmc = parseOpecForwardMeetings(
    "The next meeting of the JMMC (69th) is scheduled for 29 November 2026.",
    "https://www.opec.org/pr-detail/jmmc.html",
    now,
  );
  assert.equal(jmmc[0]?.startAt, "2026-11-29");
  assert.match(jmmc[0]?.title || "", /JMMC/);

  const opecPlus = parseOpecForwardMeetings(
    "The eight OPEC+ countries agreed on production adjustments. The next meeting will be held on 1 November 2026.",
    "https://www.opec.org/pr-detail/opec-plus.html",
    now,
  );
  assert.equal(opecPlus[0]?.startAt, "2026-11-01");
  assert.match(opecPlus[0]?.title || "", /OPEC\+/);
});

test("an OPEC index shape change fails closed instead of reporting healthy empty coverage", async () => {
  const result = await acquireEventHorizonEvents({
    now,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("federalreserve")) return responseFor(url, JSON.stringify({ events: [] }));
      return responseFor(url, "<main>No recognised press release links</main>");
    },
  });
  assert.equal(result.coverage.find((item) => item.family === "energy_policy")?.state, "source_failed");
  assert.ok(result.warnings.some((warning) => /OPEC press-release index returned no official detail links/.test(warning)));
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
