import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import { buildDossierPolicyOutlook } from "../lib/dossier-v2/policy-outlook.ts";
import { buildDossierRateRegime } from "../lib/dossier-v2/rate-regime.ts";

const AS_OF = "2026-09-24T12:00:00.000Z";
const AVAILABLE_AT = "2026-09-24T11:30:00.000Z";

function fred(
  id: string,
  last: number,
  change5d: number | null,
): Record<string, unknown> {
  return {
    evidence_id: `market-monitor:${id}:2026-09-24`,
    claim_or_fact: `${id} was ${last}.`,
    category: "Rates",
    source_type: "MARKET_DATA",
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-24T00:00:00.000Z",
    grouping_key: `market-monitor:${id}`,
    metrics: {
      last,
      change_5d_pct: change5d,
      frequency: "daily",
      provider: "Federal Reserve Economic Data",
    },
    provenance: [{
      source_type: "FRED",
      source_id: `market-monitor:${id}`,
      url: `https://fred.stlouisfed.org/series/${id}`,
      publisher: "Federal Reserve Economic Data",
    }],
  };
}

function packet(evidence: Array<Record<string, unknown>>) {
  const snapshot: CandidateSnapshot = {
    observed_evidence: evidence,
    price_data: { status: "OK", available_at: AVAILABLE_AT },
    macro_data: { status: "OK", available_at: AVAILABLE_AT },
  };
  return assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
}

test("persistent rates stack remains hawkish without a fresh event trigger", () => {
  const input = packet([
    fred("us2y", 4.8, 1.5),
    fred("us10y-fred", 5.05, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const outlook = buildDossierPolicyOutlook(input);
  const regime = buildDossierRateRegime(input, outlook);

  assert.equal(outlook.length, 0);
  assert.equal(regime.state, "HAWKISH");
  assert.equal(regime.fredBacked, true);
  assert.equal(regime.coverage.present, 5);
  assert.equal(regime.coverage.total, 5);
  assert.equal(regime.curve.state, "POSITIVE");
  assert.equal(regime.curve.spreadBps, 25);
  assert.equal(regime.nextMeetingRateOutlook, null);
  assert.ok(regime.score > 0);
  assert.ok(regime.signals.some((item) => item.key === "REAL_YIELDS" && item.state === "HAWKISH"));
});

test("persistent rate regime reports mixed conditions instead of forcing the latest event view", () => {
  const input = packet([
    {
      evidence_id: "ev:pmi:strong",
      claim_or_fact: "Flash manufacturing PMI was stronger than expected and above consensus.",
      category: "US_ACTIVITY",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T10:00:00.000Z",
      metrics: {
        signal_kind: "economic_release",
        signal_context: "STRONG_ACTIVITY_SURPRISE",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "FLASH_PMI",
      }],
    },
    fred("us2y", 4.4, -1.5),
    fred("us10y-fred", 4.7, 0),
    fred("us10y-real", 0.9, -6.0),
    fred("us10y-breakeven", 2.7, 6.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const outlook = buildDossierPolicyOutlook(input);
  const regime = buildDossierRateRegime(input, outlook);

  assert.equal(outlook[0]?.policyImpulse, "HAWKISH");
  assert.equal(regime.state, "MIXED");
  assert.ok(regime.contradictions.length >= 2);
  assert.ok(regime.signals.some((item) => item.key === "FRONT_END" && item.state === "DOVISH"));
  assert.ok(regime.signals.some((item) => item.key === "BREAKEVENS" && item.state === "HAWKISH"));
});

test("rate regime degrades explicitly when the rates stack is too sparse", () => {
  const input = packet([
    fred("us2y", 4.7, null),
  ]);

  const regime = buildDossierRateRegime(input, []);

  assert.equal(regime.state, "UNRESOLVED");
  assert.equal(regime.confidence, "UNRESOLVED");
  assert.equal(regime.coverage.present, 1);
  assert.equal(regime.gaps.length, 4);
  assert.equal(regime.fredBacked, false);
});


test("persistent next-meeting pricing survives when no fresh macro trigger is present", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:fedfunds-oct28-hike-odds-2026-09-23",
      claim_or_fact: "Fed funds futures showed a 71.2% probability of a higher target range after the October meeting, up from 55.1% the previous day.",
      category: "RATE_EXPECTATIONS",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T11:00:00.000Z",
      occurrence_time: "2026-09-23T20:15:00.000Z",
      metrics: {
        signal_kind: "rate_expectation",
        signal_context: "fedwatch",
        observed_value: 71.2,
        previous_value: 55.1,
        measurement_unit: "percent",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "FEDWATCH_OCT28",
      }],
    },
    fred("us2y", 4.8, 1.5),
    fred("us10y-fred", 5.05, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const outlook = buildDossierPolicyOutlook(input);
  const regime = buildDossierRateRegime(input, outlook);

  assert.equal(outlook.length, 0);
  assert.equal(regime.nextMeetingRateOutlook, "MORE_HAWKISH");
  assert.equal(regime.fedWatchExpectedDirection, "HIKE_ODDS_UP");
  assert.match(regime.observedRatePricing ?? "", /71\.2%/);
  assert.equal(regime.trigger, null);
  assert.ok(regime.signals.some((item) =>
    item.key === "POLICY"
    && item.state === "HAWKISH"
    && item.evidenceRefs.includes("verified-macro:fedfunds-oct28-hike-odds-2026-09-23")
  ));
});

test("persistent next-meeting pricing can turn dovish without fabricating a trigger", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:fedfunds-next-meeting-lower-odds",
      claim_or_fact: "Next-meeting hike pricing fell to 40.0% from 60.0%.",
      category: "RATE_EXPECTATIONS",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T11:00:00.000Z",
      metrics: {
        signal_kind: "rate_expectation",
        signal_context: "policy_pricing",
        observed_value: 40,
        previous_value: 60,
        measurement_unit: "percent",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "NEXT_MEETING_PRICING",
      }],
    },
    fred("us2y", 4.5, 0),
    fred("us10y-fred", 4.7, 0),
    fred("us10y-real", 1.5, 0),
    fred("us10y-breakeven", 2.3, 0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));

  assert.equal(regime.nextMeetingRateOutlook, "MORE_DOVISH");
  assert.equal(regime.fedWatchExpectedDirection, "HIKE_ODDS_DOWN");
  assert.equal(regime.trigger, null);
});


test("verified 30Y evidence is promoted into the deterministic long-end signal", () => {
  const input = packet([
    {
      evidence_id: "verified-macro:us30y-sep24-2026",
      claim_or_fact: "The US 30Y Treasury yield reached 5.415%, its highest level since 2004.",
      category: "Rates",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-24T12:00:00.000Z",
      occurrence_time: "2026-09-24T11:00:00.000Z",
      metrics: {
        signal_kind: "market_reaction",
        signal_context: "us30y",
        observed_value: 5.415,
        measurement_unit: "percent",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "US30Y_SEP24",
      }],
    },
    fred("us2y", 4.8, 1.5),
    fred("us10y-fred", 5.05, 1.0),
    fred("us10y-real", 2.2, 3.0),
    fred("us10y-breakeven", 2.6, 2.0),
    fred("fed-funds-effective", 4.6, 0),
  ]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const longEnd = regime.signals.find((item) => item.key === "LONG_END");

  assert.equal(longEnd?.label, "Long-end nominal yields");
  assert.match(longEnd?.detail ?? "", /verified US 30Y 5\.42%/);
  assert.ok(longEnd?.evidenceRefs.includes("verified-macro:us30y-sep24-2026"));
});

test("verified 30Y broadens the long-end evidence but does not invent a regime without the 10Y stack", () => {
  const input = packet([{
    evidence_id: "verified-macro:us30y-only-2026",
    claim_or_fact: "The US 30Y Treasury yield reached 5.44%.",
    category: "Rates",
    source_type: "VERIFIED_MACRO_DATA",
    available_at: "2026-09-24T12:00:00.000Z",
    occurrence_time: "2026-09-24T11:00:00.000Z",
    metrics: {
      signal_kind: "market_reaction",
      signal_context: "us30y",
      observed_value: 5.44,
      measurement_unit: "percent",
    },
    provenance: [{ source_type: "VERIFIED_MACRO_DATA", source_id: "US30Y_ONLY" }],
  }]);

  const regime = buildDossierRateRegime(input, buildDossierPolicyOutlook(input));
  const longEnd = regime.signals.find((item) => item.key === "LONG_END");

  assert.equal(longEnd?.state, "UNRESOLVED");
  assert.match(longEnd?.detail ?? "", /Verified US 30Y 5\.44%/);
  assert.equal(regime.state, "UNRESOLVED");
  assert.equal(regime.score, 0);
});
