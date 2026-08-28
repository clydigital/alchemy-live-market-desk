import test from "node:test";
import assert from "node:assert/strict";

import {
  dedupeMarketEvents,
  marketEventFromEarningsCallRow,
  marketEventFromEarnings,
  marketEventFromEconomicCalendar,
  marketEventSignature,
  normaliseMarketEvent,
} from "../lib/market-events.ts";
import { marketEventFromRow, marketEventToRow } from "../lib/market-event-persistence.ts";

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
  assert.equal(macro?.timePrecision, "date");
  assert.equal(macro?.timeLabel, "08:30 ET");
  assert.equal(earnings?.timePrecision, "date");
});

test("dedupe merges distinct source identities for one canonical real-world event", () => {
  const base = normaliseMarketEvent({
    id: "event:one",
    occurrenceKey: "talks:2026-09-01",
    eventType: "geopolitical_meeting",
    title: "Talks",
    startAt: "2026-09-01",
    sourceName: "Source A",
    sourceUrl: "https://example.com/a",
    sourceRecordRefs: ["record:a"],
    updatedAt: "2026-08-26T00:00:00.000Z",
  })!;
  const newer = normaliseMarketEvent({
    id: "event:two",
    occurrenceKey: "talks:2026-09-01",
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
  assert.equal(event.id, base.id);
  assert.equal(event.id, newer.id);
  assert.equal(marketEventSignature(base), marketEventSignature(newer));
  assert.deepEqual(event.sourceUrls, ["https://example.com/a", "https://example.com/b"]);
  assert.deepEqual(event.sourceRecordRefs, ["record:a", "event:one", "record:b", "event:two"]);
});

test("preserves the canonical event key through a date-only persistence round trip", () => {
  const original = normaliseMarketEvent({
    occurrenceKey: "policy-review:2026-q3",
    eventType: "sanctions_or_policy_deadline",
    title: "Sanctions review deadline",
    startAt: "2026-09-15",
    timePrecision: "date",
    sourceName: "Official policy notice",
    sourceUrl: "https://www.example.gov/policy-review",
  })!;
  const row = marketEventToRow(original);
  const roundTrip = marketEventFromRow({
    ...row,
    start_at: "2026-09-15T00:00:00.000Z",
  });

  assert.equal(roundTrip?.id, original.id);
  assert.equal(roundTrip?.occurrenceKey, original.occurrenceKey);
  assert.equal(roundTrip?.startAt, "2026-09-15");
  assert.equal(roundTrip?.timePrecision, "date");
});

test("ignores mutable title wording when the event type and occurrence key match", () => {
  const first = normaliseMarketEvent({
    occurrenceKey: "central-bank:2026-09",
    eventType: "central_bank_decision",
    title: "Federal Reserve rate decision",
    startAt: "2026-09-16",
    sourceName: "Source A",
    sourceUrl: "https://www.example.gov/a",
    sourceRecordRefs: ["source-a:2026-09"],
    updatedAt: "2026-08-26T00:00:00.000Z",
  })!;
  const second = normaliseMarketEvent({
    occurrenceKey: "central-bank:2026-09",
    eventType: "central_bank_decision",
    title: "FOMC September policy announcement",
    startAt: "2026-09-16",
    sourceName: "Source B",
    sourceUrl: "https://www.example.gov/b",
    sourceRecordRefs: ["source-b:2026-09"],
    updatedAt: "2026-08-26T01:00:00.000Z",
  })!;

  const [event] = dedupeMarketEvents([first, second]);
  assert.equal(first.id, second.id);
  assert.equal(marketEventSignature(first), marketEventSignature(second));
  assert.equal(event.title, second.title);
  assert.deepEqual(event.sourceUrls, ["https://www.example.gov/a", "https://www.example.gov/b"]);
  assert.deepEqual(event.sourceRecordRefs, ["source-a:2026-09", "source-b:2026-09"]);
});

test("keeps one canonical occurrence when TBC becomes dated", () => {
  const tbc = normaliseMarketEvent({
    occurrenceKey: "iran-policy-discussion:2026-09",
    eventType: "geopolitical_meeting",
    title: "Iran policy discussion",
    timePrecision: "tbc",
    sourceName: "Diplomatic briefing",
    sourceUrl: "https://www.state.gov/",
    updatedAt: "2026-08-26T00:00:00.000Z",
  })!;
  const dated = normaliseMarketEvent({
    occurrenceKey: "iran-policy-discussion:2026-09",
    eventType: "geopolitical_meeting",
    title: "Iran policy discussion",
    startAt: "2026-09-18",
    timePrecision: "date",
    sourceName: "Official schedule",
    sourceUrl: "https://www.state.gov/",
    updatedAt: "2026-08-27T00:00:00.000Z",
  })!;

  assert.equal(tbc.id, dated.id);
  assert.equal(dedupeMarketEvents([tbc, dated]).length, 1);
  assert.equal(dedupeMarketEvents([tbc, dated])[0].startAt, "2026-09-18");
});

test("keeps one canonical occurrence when a date becomes an exact timestamp on the same day", () => {
  const date = normaliseMarketEvent({
    occurrenceKey: "cpi:2026-09",
    eventType: "economic_release",
    title: "Consumer Price Index",
    startAt: "2026-09-10",
    timePrecision: "date",
    sourceName: "Official calendar",
    sourceUrl: "https://www.example.gov/calendar",
  })!;
  const exact = normaliseMarketEvent({
    occurrenceKey: "cpi:2026-09",
    eventType: "economic_release",
    title: "Consumer Price Index",
    startAt: "2026-09-10T08:30:00-04:00",
    timePrecision: "exact",
    sourceName: "Official calendar",
    sourceUrl: "https://www.example.gov/calendar",
    timeLabel: "08:30 ET",
  })!;

  assert.equal(date.id, exact.id);
  assert.equal(exact.startAt, "2026-09-10T08:30:00-04:00");
  assert.equal(exact.timeLabel, "08:30 ET");
});

test("keeps the canonical occurrence key through postponement and rescheduling", () => {
  const original = normaliseMarketEvent({
    occurrenceKey: "opec-jmmc:2026-10",
    eventType: "energy_policy_meeting",
    title: "OPEC+ / JMMC meeting",
    startAt: "2026-10-04",
    timePrecision: "date",
    sourceName: "OPEC",
    sourceUrl: "https://www.opec.org/",
    updatedAt: "2026-08-26T00:00:00.000Z",
  })!;
  const postponed = normaliseMarketEvent({
    occurrenceKey: "opec-jmmc:2026-10",
    eventType: "energy_policy_meeting",
    title: "OPEC+ / JMMC meeting",
    startAt: "2026-10-11",
    timePrecision: "date",
    status: "postponed",
    sourceName: "OPEC",
    sourceUrl: "https://www.opec.org/",
    updatedAt: "2026-08-27T00:00:00.000Z",
  })!;

  assert.equal(original.id, postponed.id);
  const [event] = dedupeMarketEvents([original, postponed]);
  assert.equal(event.id, original.id);
  assert.equal(event.startAt, "2026-10-11");
  assert.equal(event.status, "postponed");
});

test("does not collapse distinct recurring occurrences with similar titles", () => {
  const q3 = normaliseMarketEvent({
    occurrenceKey: "policy-meeting:2026-q3",
    eventType: "geopolitical_meeting",
    title: "Policy meeting",
    startAt: "2026-09-10",
    sourceName: "Schedule A",
    sourceUrl: "https://www.example.gov/a",
  })!;
  const q4 = normaliseMarketEvent({
    occurrenceKey: "policy-meeting:2026-q4",
    eventType: "geopolitical_meeting",
    title: "Policy meeting",
    startAt: "2026-12-10",
    sourceName: "Schedule A",
    sourceUrl: "https://www.example.gov/a",
  })!;

  assert.notEqual(q3.id, q4.id);
  assert.equal(dedupeMarketEvents([q3, q4]).length, 2);
});

test("rejects an exact event when the input is only a date plus a labelled clock time", () => {
  const event = normaliseMarketEvent({
    eventType: "economic_release",
    title: "Consumer Price Index",
    startAt: "2026-09-10",
    timeLabel: "08:30 ET",
    timePrecision: "exact",
    sourceName: "Official calendar",
    sourceUrl: "https://www.example.gov/calendar",
  });

  assert.equal(event, null);
});

test("maps a real earnings-call row through the runtime adapter using canonical source fields", () => {
  const event = marketEventFromEarningsCallRow({
    id: "earnings:nvda-q3-2026",
    ticker: "NVDA",
    company_name: "NVIDIA",
    fiscal_period: "Q3 2026",
    call_date: "2026-11-18",
    event_time_label: "17:00 ET",
    source_url: "https://investor.nvidia.com/financial-info/",
    relevance_reason: "Does guidance confirm the current demand path?",
    guidance: "Data-centre demand remains the decisive variable.",
    demand: null,
  });

  assert.equal(event?.eventType, "earnings");
  assert.equal(event?.sourceUrl, "https://investor.nvidia.com/financial-info/");
  assert.deepEqual(event?.sourceUrls, ["https://investor.nvidia.com/financial-info/"]);
  assert.equal(event?.timeLabel, "17:00 ET");
  assert.equal(event?.timePrecision, "date");
});

test("normalises a sanctions or policy deadline as a dated event", () => {
  const event = normaliseMarketEvent({
    id: "policy:tariff-review:2026",
    eventType: "sanctions_or_policy_deadline",
    title: "Sanctions and tariff review deadline",
    startAt: "2026-09-15",
    timePrecision: "date",
    status: "scheduled",
    verificationState: "official",
    decisiveVariable: "Whether the review changes the restriction set or implementation timeline.",
    transmission: "Policy changes can reprice the affected commodities, currencies and risk premia.",
    sourceName: "Official policy notice",
    sourceUrl: "https://www.example.gov/policy-review",
    sourceRecordRefs: ["policy-review:2026"],
  });

  assert.equal(event?.eventType, "sanctions_or_policy_deadline");
  assert.equal(event?.startAt, "2026-09-15");
  assert.equal(event?.timePrecision, "date");
});

test("normalises an OPEC/JMMC-style energy policy meeting with market links", () => {
  const event = normaliseMarketEvent({
    id: "opec:jmmc:2026-10",
    eventType: "energy_policy_meeting",
    title: "OPEC+ / JMMC meeting",
    startAt: "2026-10-04",
    timePrecision: "date",
    participants: ["OPEC", "JMMC"],
    affectedAssets: ["WTI", "BRENT"],
    verificationState: "corroborated",
    sourceName: "OPEC",
    sourceUrl: "https://www.opec.org/",
    sourceRecordRefs: ["opec:jmmc:2026-10"],
  });

  assert.equal(event?.eventType, "energy_policy_meeting");
  assert.deepEqual(event?.participants, ["OPEC", "JMMC"]);
  assert.deepEqual(event?.affectedAssets, ["WTI", "BRENT"]);
});

test("adapts standard CPI and FOMC records without changing their timing semantics", () => {
  const cpi = marketEventFromEconomicCalendar({
    id: "us-cpi-2026-10-13",
    date: "2026-10-13",
    timeLabel: "08:30 ET",
    country: "United States",
    g7Markets: ["United States"],
    event: "Consumer Price Index",
    category: "Inflation",
    impact: "High",
    referencePeriod: "September 2026",
    status: "Scheduled",
    actual: null,
    consensus: "0.2%",
    previous: "0.3%",
    decidingQuestion: "Does inflation alter the expected policy path?",
    affectedAssets: ["USD", "US02Y"],
    sourceName: "U.S. Bureau of Labor Statistics",
    sourceUrl: "https://www.bls.gov/",
    sourceKind: "official-schedule",
  });
  const fomc = marketEventFromEconomicCalendar({
    id: "us-fomc-2026-09-16",
    date: "2026-09-16",
    timeLabel: "14:00 ET",
    country: "United States",
    g7Markets: ["United States"],
    event: "FOMC rate decision",
    category: "Central bank",
    impact: "High",
    referencePeriod: null,
    status: "Scheduled",
    actual: null,
    consensus: "Hold",
    previous: "Hold",
    decidingQuestion: "Does the FOMC change the expected rate path?",
    affectedAssets: ["USD", "US02Y", "SPX"],
    sourceName: "Federal Reserve",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    sourceKind: "official-schedule",
  });

  assert.equal(cpi?.eventType, "economic_release");
  assert.equal(fomc?.eventType, "central_bank_decision");
  assert.equal(cpi?.timeLabel, "08:30 ET");
  assert.equal(fomc?.timeLabel, "14:00 ET");
});

test("keeps a known event date while leaving the clock time explicitly unknown", () => {
  const event = normaliseMarketEvent({
    id: "policy:meeting:2026-09-02",
    eventType: "geopolitical_meeting",
    title: "Scheduled policy discussion",
    startAt: "2026-09-02",
    timeLabel: "Time TBC",
    timePrecision: "date",
    verificationState: "corroborated",
    sourceName: "Public schedule",
    sourceUrl: "https://www.example.org/schedule",
    sourceRecordRefs: ["schedule:2026-09-02"],
  });

  assert.equal(event?.startAt, "2026-09-02");
  assert.equal(event?.timePrecision, "date");
  assert.equal(event?.timeLabel, "Time TBC");
  assert.equal(event?.startAt?.includes("T"), false);
});
