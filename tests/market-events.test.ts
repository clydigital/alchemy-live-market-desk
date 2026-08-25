import test from "node:test";
import assert from "node:assert/strict";

import {
  dedupeMarketEvents,
  marketEventFromEarnings,
  marketEventFromEconomicCalendar,
  normaliseMarketEvent,
} from "../lib/market-events.ts";

test("normalises Jackson Hole as a verified conference without treating it as macro data", () => {
  const event = normaliseMarketEvent({
    id: "official:jackson-hole:2026",
    eventType: "conference_or_symposium",
    title: "Jackson Hole Economic Policy Symposium",
    startAt: "2026-08-27",
    timePrecision: "date",
    verificationState: "official",
    linkedStorySlugs: ["fed-policy-path"],
    decisiveVariable: "Does the policy message change the expected rate path?",
    transmission: "Rates, dollar and duration-sensitive equities can reprice around the message.",
    sourceName: "Federal Reserve Bank of Kansas City",
    sourceUrl: "https://www.kansascityfed.org/research/jackson-hole-economic-symposium/",
    sourceRecordRefs: ["jackson-hole:2026"],
  });

  assert.equal(event?.eventType, "conference_or_symposium");
  assert.equal(event?.timePrecision, "date");
  assert.deepEqual(event?.linkedStorySlugs, ["fed-policy-path"]);
});

test("preserves an Iran-style uncertain schedule without inventing a clock time", () => {
  const event = normaliseMarketEvent({
    eventType: "geopolitical_meeting",
    title: "Iran discussions",
    timePrecision: "tbc",
    status: "reported",
    verificationState: "reported",
    decisiveVariable: "Whether talks produce a verifiable de-escalation step.",
    transmission: "The result can change energy and geopolitical risk premia.",
    sourceName: "State Department briefing",
    sourceUrl: "https://www.state.gov/",
  });

  assert.equal(event?.startAt, null);
  assert.equal(event?.timePrecision, "tbc");
  assert.equal(event?.status, "reported");
});

test("adapts macro and earnings records into the Event Horizon shape", () => {
  const macro = marketEventFromEconomicCalendar({
    id: "us-cpi-2026-09-10",
    date: "2026-09-10",
    timeLabel: "08:30 ET",
    country: "United States",
    g7Markets: ["United States"],
    event: "Consumer Price Index",
    category: "Inflation",
    impact: "High",
    referencePeriod: "August 2026",
    status: "Scheduled",
    actual: null,
    consensus: "0.2%",
    previous: "0.3%",
    decidingQuestion: "Is inflation broad and persistent enough to change rate expectations?",
    affectedAssets: ["USD", "US02Y"],
    sourceName: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/",
    sourceKind: "official-schedule",
  });
  const earnings = marketEventFromEarnings({
    id: "nvda-q3-2026",
    companyName: "NVIDIA",
    callDate: "2026-11-18",
    sourceUrl: "https://investor.nvidia.com/",
    affectedAssets: ["NVDA"],
  });

  assert.equal(macro?.eventType, "economic_release");
  assert.equal(earnings?.eventType, "earnings");
  assert.equal(macro?.timePrecision, "exact");
  assert.equal(macro?.timeLabel, "08:30 ET");
  assert.equal(earnings?.timePrecision, "date");
});

test("dedupe keeps the newest event state and merges source links", () => {
  const base = normaliseMarketEvent({
    id: "event:one",
    eventType: "geopolitical_meeting",
    title: "Talks",
    startAt: "2026-09-01",
    sourceName: "Source A",
    sourceUrl: "https://example.com/a",
    sourceRecordRefs: ["record:a"],
    updatedAt: "2026-08-26T00:00:00.000Z",
  })!;
  const newer = normaliseMarketEvent({
    id: "event:one",
    eventType: "geopolitical_meeting",
    title: "Talks",
    startAt: "2026-09-01",
    sourceName: "Source B",
    sourceUrl: "https://example.com/b",
    sourceRecordRefs: ["record:b"],
    updatedAt: "2026-08-26T01:00:00.000Z",
  })!;

  const [event] = dedupeMarketEvents([base, newer]);
  assert.equal(event.sourceName, "Source B");
  assert.deepEqual(event.sourceRecordRefs, ["record:a", "record:b"]);
});
