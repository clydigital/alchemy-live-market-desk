import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { earningsQuickRead } from "../lib/bluebelly-earnings-quick-read.ts";
import { getRecentVerifiedEarningsScorecards } from "../lib/blue-desk-earnings-results.ts";
import { recentOriginalIssuerReleases } from "../lib/bluebelly-issuer-release-receipts.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("earnings readings use date-pinned original releases and fail closed on unknown issuers", () => {
  const now = new Date("2026-11-05T06:00:00.000Z");
  const reviewed = [
    ...recentOriginalIssuerReleases(now, 8).map(item => [item.ticker, item.sourceDay]),
    ...getRecentVerifiedEarningsScorecards(now, 7).map(item => [item.ticker, item.releaseDay]),
  ];
  assert.ok(reviewed.length >= 8);
  for (const [ticker, day] of reviewed) {
    const reading = earningsQuickRead(ticker, day);
    assert.ok(reading.interpretation.length > 55, ticker + " lacks an interpretation");
    assert.ok(reading.guidanceDetail.length > 35, ticker + " lacks guidance context");
    assert.doesNotMatch(reading.interpretation, /beat analyst estimates|missed analyst estimates|share price rallied/i);
  }
  const unseen = earningsQuickRead("AMD", "2027-11-03");
  assert.equal(unseen.resultTone, "unverified");
  assert.equal(unseen.guidanceTone, "unverified");
  assert.equal(earningsQuickRead("NEWCO", "2026-11-04").resultLabel, "Not assessed");
});

test("cash-flow divergence is distinct from guidance; issuer targets are not called consensus beats", () => {
  const amd = earningsQuickRead("AMD", "2026-11-03");
  assert.equal(amd.resultTone, "mixed");
  assert.equal(amd.guidanceTone, "positive");
  assert.match(amd.interpretation, /cash flow fell/);
  assert.match(amd.guidanceDetail, /not an analyst-consensus comparison/);

  const intel = earningsQuickRead("INTC", "2026-10-29");
  assert.equal(intel.guidanceTone, "caution");
  assert.match(intel.guidanceDetail, /PC weakness/);
  assert.equal(earningsQuickRead("NVO", "2026-11-04").resultTone, "unverified");

  const tsm = earningsQuickRead("TSM", "2026-10-15");
  assert.match(tsm.resultLabel, /own guide/);
  assert.match(tsm.guidanceDetail, /not analyst-consensus/);
});

test("earnings calendar keeps issuer evidence and provides navigable horizontal result slider", () => {
  const board = read("components/blue-desk/IssuerEarningsBoard.tsx");
  const rail = read("components/blue-desk/EarningsResultRail.tsx");
  const styles = read("components/blue-desk/EarningsResultRail.module.css");
  const page = read("app/blue-desk/calendar/page.tsx");
  assert.match(board, /getIssuerEarningsSchedule/);
  assert.match(board, /recentOriginalIssuerReleases/);
  assert.match(board, /getRecentVerifiedEarningsScorecards/);
  assert.match(board, /earningsQuickRead\(item.ticker, item.day\)/);
  assert.match(board, /<EarningsResultRail items=/);
  assert.match(rail, /type="range"/);
  assert.match(rail, /onScroll=\{trackScroll\}/);
  assert.match(rail, /aria-label="Previous earnings card"/);
  assert.match(rail, /aria-label="Next earnings card"/);
  assert.match(rail, /aria-pressed=\{filter === option.id\}/);
  assert.match(rail, /data-tone=\{item.resultTone\}/);
  assert.match(rail, /data-tone=\{item.guidanceTone\}/);
  assert.match(rail, /item.interpretation/);
  assert.match(rail, /item.sourceUrl/);
  assert.match(styles, /scroll-snap-type:x mandatory/);
  assert.match(styles, /:focus-visible/);
  assert.ok(page.indexOf("<CatalystCalendar") < page.indexOf("<IssuerEarningsBoard"),
    "earnings rail must not displace the calendar-first layout");
});
