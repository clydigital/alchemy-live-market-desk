import { test } from "node:test";
import assert from "node:assert/strict";
import { selectCrossBankPolicyBridge } from "../lib/bluebelly-cross-bank-policy-bridge.ts";
import type { NewsBriefV1 } from "../lib/market-brief-news.ts";
import type { PresenterCalendar, PresenterCalendarEvent } from "../lib/presenter-calendar.ts";

const now = new Date("2026-10-28T15:00:00Z");
const official = (id: string, headline: string, summary: string, url: string, occurredAt: string): NewsBriefV1 => ({
  id, headline, summary, sourceUrl: url, sourceName: id,
  sourceKind: "official", verification: "SOURCE_VERIFIED",
  contractVersion: "news-brief/1", contentType: "NEWS_BRIEF",
  occurredAt, observedAt: new Date(Date.parse(occurredAt) + 5 * 60_000).toISOString(),
});
const boc = official(
  "boc", "Bank of Canada raises policy rate by 25 basis points",
  "The governing council raises interest rates to contain the risk that high energy prices spread into broader inflation.",
  "https://www.bankofcanada.ca/2026/10/fad-press-release-2026-10-28/", "2026-10-28T13:45:00Z",
);
const rbnz = official(
  "rbnz", "RBNZ holds official cash rate at 2.75 percent",
  "Fuel-driven inflation remains a worry, while domestic labour and consumer demand are weak. The central bank held today.",
  "https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent", "2026-10-28T01:00:00Z",
);
const fomc = {
  id: "macro:fed-2026-10-28", kind: "economic", title: "FOMC policy decision",
  status: "scheduled", verificationState: "official",
  sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  sourceName: "Federal Reserve",
  scheduledAt: "2026-10-28T18:00:00Z",
  localDate: "2026-10-29", timeLabel: "2:00 PM EDT",
  timePrecision: "exact", actual: null, consensus: null, previous: null,
  revisedPrevious: null, releasedAt: null, sourceRecordRefs: ["fed-2026-10-28"],
  affectedAssets: ["US02Y", "DXY"], decidingQuestion: "What changes in forward guidance?",
} as PresenterCalendarEvent;
const calendar = (events: PresenterCalendarEvent[] = [fomc]): PresenterCalendar => ({
  contractVersion: "presenter-calendar/1",
  asOf: now.toISOString(), timezone: "Asia/Kuala_Lumpur",
  tradingWeekStart: "", tradingWeekEndExclusive: "",
  sourceHealth: { macro: "partial", earnings: "unavailable", warnings: [] },
  windows: { next24h: [], next7d: [], released: [] },
  events,
});

test("28 October: BoC hike + RBNZ hold creates a linked question ahead of Fed, not a Fed verdict", () => {
  const bridge = selectCrossBankPolicyBridge([rbnz, boc], calendar(), now);
  assert.ok(bridge);
  assert.match(bridge.question, /Bank of Canada raise rates while RBNZ held/);
  assert.equal(bridge.sources.length, 2);
  assert.deepEqual(bridge.sources.map(item => item.action), ["raised", "held"]);
  assert.equal(bridge.sources[0].url, boc.sourceUrl);
  assert.equal(bridge.sources[1].url, rbnz.sourceUrl);
  assert.equal(bridge.nextEvent.scheduledAt, fomc.scheduledAt);
  assert.match(bridge.nextTest, /No third-bank outcome or market reaction is established/);
});

test("no bridge without two independently original-source-qualified opposite actions", () => {
  assert.equal(selectCrossBankPolicyBridge([rbnz], calendar(), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, {...boc, sourceKind:"reporting"}], calendar(), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, {...boc, sourceUrl:"https://example.com/boc"}], calendar(), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, {...boc, verification:undefined as any}], calendar(), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, {...boc,headline:"Bank of Canada holds policy rate"}], calendar(), now), null);
});

test("an oil story alone cannot supply the central bank's missing inflation rationale", () => {
  const missingOil = {...rbnz, summary:"Employment remains weak and the rate is unchanged."};
  assert.equal(selectCrossBankPolicyBridge([missingOil, boc], calendar(), now), null);
  const missingInflation = {...boc,summary:"Oil supply is constrained and the board voted to raise rates."};
  assert.equal(selectCrossBankPolicyBridge([missingInflation, rbnz], calendar(), now), null);
});

test("pre-release, future-dated and past/Fed-completed clocks fail closed", () => {
  assert.equal(selectCrossBankPolicyBridge([rbnz, boc], calendar(), new Date("2026-10-28T13:40:00Z")), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, boc], calendar(), new Date("2026-10-28T18:01:00Z")), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, boc], calendar([{...fomc,status:"released"}]), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, boc], calendar([{...fomc,verificationState:"reported"}]), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, boc], calendar([{...fomc,scheduledAt:"2026-10-30T18:00:00Z"}]), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, boc], calendar([{...fomc,sourceUrl:boc.sourceUrl}]), now), null);
  assert.equal(selectCrossBankPolicyBridge([rbnz, boc], calendar([{...fomc,sourceUrl:"https://example.com/claimed-fed"}]), now), null);
});

test("cannot use future observation timestamps or stale policy releases", () => {
  assert.equal(selectCrossBankPolicyBridge([{...rbnz,observedAt:"2026-10-29T01:00:00Z"}, boc],calendar(),now),null);
  assert.equal(selectCrossBankPolicyBridge([{...rbnz,occurredAt:"2026-10-26T01:00:00Z"}, boc],calendar(),now),null);
});

test("public briefing places the comparison beside the decision, not in another unverified panel", async () => {
  const { readFileSync } = await import("node:fs");
  const ui = readFileSync(new URL("../components/blue-desk/DecisionBrief.tsx", import.meta.url), "utf8");
  assert.match(ui, /selectCrossBankPolicyBridge\(news,calendar,now\)/);
  assert.match(ui, /data-cross-bank-bridge="source-qualified"/);
  assert.match(ui, /data-cross-bank-evidence="source-qualified"/);
  assert.match(ui, /crossBank\.sources\.map/);
});
