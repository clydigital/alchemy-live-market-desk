import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getIsmSchedule, parseIsmScheduleHtml } from "../lib/ism-forward-schedule.ts";
import { getForwardEarningsEvents, officialEarningsEvents, parseEarningsHubUpcoming } from "../lib/forward-earnings-sources.ts";

const NOW = new Date("2026-10-12T04:00:00Z");
const ISM = "<h2>2026 ISM PMI® Reports Release Dates</h2><table><tr><th>Month</th><th>Manufacturing PMI</th><th>Services PMI</th></tr><tr><td>November 2026</td><td>2</td><td>4</td></tr><tr><td>December 2026</td><td>1</td><td>3</td></tr></table>";
test("official ISM Manufacturing and Services dates are parsed and represented as future release-only events", async () => {
  assert.deepEqual(parseIsmScheduleHtml(ISM), [
    { date: "2026-11-02", kind: "Manufacturing" },
    { date: "2026-11-04", kind: "Services" },
    { date: "2026-12-01", kind: "Manufacturing" },
    { date: "2026-12-03", kind: "Services" },
  ]);
  const fetchImpl = (async () => ({ ok: true, text: async () => ISM })) as unknown as typeof fetch;
  const actual = await getIsmSchedule({ now: NOW, fetchImpl });
  assert.equal(actual.state, "live");
  assert.deepEqual(actual.events.map(item => item.date), ["2026-11-02", "2026-11-04", "2026-12-01", "2026-12-03"]);
  assert.ok(actual.events.every(item => item.consensus === null && item.previous === null && item.actual === null));
  assert.ok(actual.events.every(item => item.timeLabel === "10:00 ET"));
});
test("failed ISM source retains only time-limited verified dates and never invents next-year dates", async () => {
  const fetchImpl = (async () => { throw new Error("blocked"); }) as unknown as typeof fetch;
  const fallback = await getIsmSchedule({ now: NOW, fetchImpl });
  assert.equal(fallback.state, "verified_backstop");
  assert.equal(fallback.events.length, 4);
  const expired = await getIsmSchedule({ now: new Date("2027-02-03T00:00:00Z"), fetchImpl });
  assert.equal(expired.state, "unavailable");
  assert.deepEqual(expired.events, []);
  assert.match(expired.warning || "", /do not infer/);
});
test("issuer-confirmed near-term banks and TSMC carry exact source dates and distinct results/call timing", () => {
  const events = officialEarningsEvents(NOW);
  const c = events.find(event => event.affectedAssets.includes("C"));
  const tsm = events.find(event => event.affectedAssets.includes("TSM"));
  const bac = events.find(event => event.affectedAssets.includes("BAC"));
  assert.equal(c?.startAt, "2026-10-13T08:00:00-04:00");
  assert.match(c?.timeLabel || "", /11:00 ET call/);
  assert.equal(tsm?.startAt, "2026-10-15T14:00:00+08:00");
  assert.equal(bac?.verificationState, "official");
  assert.equal(bac?.startAt, "2026-10-14T06:45:00-04:00");
  assert.ok(events.every(event => event.sourceUrl.startsWith("https://")));
  assert.equal(officialEarningsEvents(new Date("2028-01-01T00:00:00Z")).length, 0);
});
test("EarningsHub dates are reported only, watchlist-bounded and never promoted to issuer confirmed", () => {
  const events = parseEarningsHubUpcoming({ data: { upcoming_earnings: [
    { ticker: "NVDA", company_name: "NVIDIA", quarter: "Q3 2026", report_date: "2026-11-13", report_time: "After Market Close", eps_estimate: 2.1 },
    { ticker: "ZZZZ", company_name: "Non-watchlisted", report_date: "2026-11-15" },
    { ticker: "AMD", company_name: "AMD", report_date: "2020-01-01" },
  ] } }, NOW);
  assert.equal(events.length, 1);
  assert.equal(events[0].verificationState, "reported");
  assert.equal(events[0].timePrecision, "date");
  assert.match(events[0].expectation || "", /EPS estimate/);
});
test("unlicensed earnings provider is never called; licensed result keeps matching official company-date", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return { ok: true, json: async () => ({ data: { upcoming_earnings: [
      { ticker: "TSM", company_name: "TSMC", report_date: "2026-10-15" },
      { ticker: "NVDA", company_name: "NVIDIA", report_date: "2026-11-13" },
    ] } }) };
  }) as unknown as typeof fetch;
  const disabled = await getForwardEarningsEvents({ now: NOW, fetchImpl, apiKey: "test", licensed: false });
  assert.equal(calls, 0);
  assert.equal(disabled.coverage, "official_only");
  const enabled = await getForwardEarningsEvents({ now: NOW, fetchImpl, apiKey: "test", licensed: true });
  assert.equal(calls, 1);
  assert.equal(enabled.coverage, "official_and_provider");
  assert.equal(enabled.events.filter(event => event.affectedAssets.includes("TSM") && event.startAt?.startsWith("2026-10-15")).length, 1);
  assert.equal(enabled.events.find(event => event.affectedAssets.includes("NVDA"))?.verificationState, "reported");
});
test("calendar, Live nav and the Hybrid edition consume the same event sources", () => {
  const file = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(file("../lib/calendar.ts"), /getIsmSchedule/);
  assert.match(file("../lib/market-event-runtime.ts"), /getForwardEarningsEvents/);
  assert.match(file("../lib/live-desk/routes.ts"), /href: "\/calendar"/);
  assert.match(file("../app/calendar/page.tsx"), /getEconomicCalendar/);
  assert.match(file("../app/calendar/page.tsx"), /getForwardEarningsEvents/);
  assert.match(file("../app/hybrid-output/page.tsx"), /Issuer confirmed/);
});
