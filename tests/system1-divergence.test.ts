import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import { buildResearchBrainPrompt } from "../lib/dossier-v2/research-brain-prompt.ts";
import {
  buildSystem1DivergenceCandidates,
  buildSystem1PolicyExpectationChecks,
} from "../lib/dossier-v2/system1-divergence.ts";

const AS_OF = "2026-09-22T12:00:00Z";
const AVAILABLE_AT = "2026-09-22T11:30:00Z";

function marketMonitor(id: string, dayChangePct: number | null): Record<string, unknown> {
  return {
    evidence_id: `market-monitor:${id}:2026-09-22`,
    claim_or_fact: `Market monitor ${id} moved ${dayChangePct ?? "n/a"}% on the day.`,
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-22T00:00:00Z",
    grouping_key: `market-monitor:${id}`,
    category: "MARKET",
    source_type: "MARKET_DATA",
    metrics: { day_change_pct: dayChangePct },
    provenance: [{ source_type: "MARKET_DATA", source_id: `market-monitor:${id}` }],
  };
}

function packetWith(
  eventFacts: Array<Record<string, unknown>>,
  monitors: Array<Record<string, unknown>>,
) {
  const snapshot: CandidateSnapshot = {
    observed_evidence: [...eventFacts, ...monitors],
    price_data: { status: "OK", available_at: AVAILABLE_AT },
    macro_data: { status: "OK", available_at: AVAILABLE_AT },
  };
  return assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
}

test("System 1 emits only material opposite reactions", () => {
  const packet = packetWith(
    [{
      evidence_id: "ev:fomc:hawkish",
      claim_or_fact: "The Federal Reserve delivered a hawkish rate hike and retained a tightening bias.",
      category: "MONETARY_POLICY",
      source_type: "PRESS_RELEASE",
      available_at: "2026-09-22T10:00:00Z",
      provenance: [{ source_type: "PRESS_RELEASE", source_id: "FOMC_STATEMENT" }],
    }],
    [
      marketMonitor("us2y", 0.4),
      marketMonitor("dxy", -0.6),
      marketMonitor("gold", 1.2),
      marketMonitor("smh", -0.8),
    ],
  );

  const candidates = buildSystem1DivergenceCandidates(packet);

  assert.deepEqual(candidates.map((item) => item.instrument), ["XAUUSD", "DXY"]);
  assert.equal(candidates[0]?.expected_direction, "DOWN");
  assert.equal(candidates[0]?.observed_direction, "UP");
  assert.equal(candidates[0]?.trigger_evidence_id, "ev:fomc:hawkish");
  assert.equal(candidates[0]?.market_evidence_id, "market-monitor:gold:2026-09-22");
  assert.ok(!("explanation" in (candidates[0] ?? {})));
});

test("System 1 suppresses checks when opposing policy signals coexist", () => {
  const packet = packetWith(
    [
      {
        evidence_id: "ev:fomc:hike",
        claim_or_fact: "The Federal Reserve announced a rate hike.",
        category: "MONETARY_POLICY",
        source_type: "PRESS_RELEASE",
        available_at: "2026-09-22T10:00:00Z",
        provenance: [{ source_type: "PRESS_RELEASE", source_id: "FOMC_A" }],
      },
      {
        evidence_id: "ev:fomc:dovish",
        claim_or_fact: "The accompanying guidance was explicitly dovish.",
        category: "MONETARY_POLICY",
        source_type: "PRESS_RELEASE",
        available_at: "2026-09-22T10:05:00Z",
        provenance: [{ source_type: "PRESS_RELEASE", source_id: "FOMC_B" }],
      },
    ],
    [
      marketMonitor("us2y", -0.7),
      marketMonitor("dxy", -0.5),
      marketMonitor("gold", 1.1),
      marketMonitor("smh", 0.9),
    ],
  );

  assert.deepEqual(buildSystem1DivergenceCandidates(packet), []);
});

test("Tiny or missing moves add no prompt noise", () => {
  const packet = packetWith(
    [{
      evidence_id: "ev:cpi:hot",
      claim_or_fact: "CPI was hotter than expected relative to consensus.",
      category: "ECONOMIC_METRIC",
      source_type: "STATISTICAL_AGENCY",
      available_at: "2026-09-22T10:00:00Z",
      provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "BLS_CPI" }],
    }],
    [
      marketMonitor("us2y", 0.01),
      marketMonitor("dxy", null),
      marketMonitor("gold", -0.02),
      marketMonitor("smh", 0.01),
    ],
  );

  const prompt = buildResearchBrainPrompt({ as_of: packet.as_of, packet });

  assert.deepEqual(buildSystem1DivergenceCandidates(packet), []);
  assert.deepEqual(prompt.boundedInput.system1_divergence_candidates, []);
  assert.match(prompt.instructions, /SYSTEM 1 POLICY \+ DIVERGENCE SCREEN/);
  assert.match(prompt.instructions, /NOT independent facts/);
});

test("Research Brain gets compact energy divergence candidates only", () => {
  const packet = packetWith(
    [{
      evidence_id: "ev:energy:stress",
      claim_or_fact: "A Strait of Hormuz shipping disruption is creating oil supply disruption risk.",
      category: "ENERGY",
      source_type: "NEWS_MARKET_CONTEXT",
      is_admitted_fact: true,
      available_at: "2026-09-22T10:00:00Z",
      provenance: [{ source_type: "NEWS", source_id: "ENERGY_1" }],
    }],
    [
      marketMonitor("wti", -1.5),
      marketMonitor("distillate", -0.8),
      marketMonitor("crack-distillate", -0.4),
    ],
  );

  const prompt = buildResearchBrainPrompt({ as_of: packet.as_of, packet });
  const candidates = prompt.boundedInput.system1_divergence_candidates as Array<Record<string, unknown>>;

  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((item) => item.expected_direction === "UP"));
  assert.ok(candidates.every((item) => item.observed_direction === "DOWN"));
  assert.ok(JSON.stringify(candidates).length < 2_000);
});

test("Strong Flash PMI creates a hawkish policy outlook even when market reactions align", () => {
  const packet = packetWith(
    [{
      evidence_id: "ev:pmi:strong",
      claim_or_fact: "Flash manufacturing PMI came in higher than expected and above consensus.",
      category: "ECONOMIC_METRIC",
      source_type: "STATISTICAL_AGENCY",
      available_at: "2026-09-22T10:00:00Z",
      provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "FLASH_PMI" }],
    }],
    [
      marketMonitor("us2y", 0.4),
      marketMonitor("dxy", 0.5),
      marketMonitor("gold", -0.6),
      marketMonitor("smh", -0.7),
    ],
  );

  const outlook = buildSystem1PolicyExpectationChecks(packet);
  assert.equal(outlook.length, 1);
  assert.equal(outlook[0]?.rule_id, "STRONG_ACTIVITY_SURPRISE");
  assert.equal(outlook[0]?.policy_impulse, "HAWKISH");
  assert.equal(outlook[0]?.next_meeting_rate_outlook, "MORE_HAWKISH");
  assert.equal(outlook[0]?.fedwatch_expectation, "HIKE_ODDS_UP");
  assert.deepEqual(buildSystem1DivergenceCandidates(packet), []);
});

test("FedWatch repricing is confirming evidence, not a second monetary-policy trigger", () => {
  const packet = packetWith(
    [
      {
        evidence_id: "ev:pmi:strong",
        claim_or_fact: "Flash manufacturing PMI was higher than expected and above consensus.",
        category: "ECONOMIC_METRIC",
        source_type: "VERIFIED_MACRO_DATA",
        available_at: "2026-09-22T10:00:00Z",
        metrics: {
          signal_kind: "economic_release",
          signal_context: "STRONG_ACTIVITY_SURPRISE",
        },
        provenance: [{ source_type: "VERIFIED_MACRO_DATA", source_id: "FLASH_PMI" }],
      },
      {
        evidence_id: "ev:fedwatch:repricing",
        claim_or_fact: "FedWatch showed a 55.4% probability of a rate hike, up from 53.1%.",
        category: "RATE_EXPECTATIONS",
        source_type: "VERIFIED_MACRO_DATA",
        available_at: "2026-09-22T10:05:00Z",
        metrics: {
          signal_kind: "rate_expectation",
          signal_context: "STRONG_ACTIVITY_SURPRISE",
          observed_value: 55.4,
          previous_value: 53.1,
        },
        provenance: [{ source_type: "VERIFIED_MACRO_DATA", source_id: "FEDWATCH" }],
      },
    ],
    [],
  );

  const outlook = buildSystem1PolicyExpectationChecks(packet);
  assert.deepEqual(outlook.map((item) => item.rule_id), ["STRONG_ACTIVITY_SURPRISE"]);
  assert.equal(outlook[0]?.trigger_evidence_id, "ev:pmi:strong");
});

test("Policy outlook never fabricates a numeric FedWatch probability", () => {
  const packet = packetWith(
    [{
      evidence_id: "ev:pmi:weak",
      claim_or_fact: "Flash services PMI was weaker than expected and below forecast.",
      category: "ECONOMIC_METRIC",
      source_type: "STATISTICAL_AGENCY",
      available_at: "2026-09-22T10:00:00Z",
      provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "FLASH_PMI" }],
    }],
    [],
  );

  const outlook = buildSystem1PolicyExpectationChecks(packet);
  assert.equal(outlook.length, 1);
  assert.equal(outlook[0]?.policy_impulse, "DOVISH");
  assert.equal(outlook[0]?.fedwatch_expectation, "HIKE_ODDS_DOWN");
  assert.equal(JSON.stringify(outlook).includes("%"), false);

  const prompt = buildResearchBrainPrompt({ as_of: packet.as_of, packet });
  assert.deepEqual(prompt.boundedInput.system1_policy_expectation_checks, outlook);
  assert.match(prompt.instructions, /Never invent or quote a FedWatch percentage/);
});


test("Strong labour surprise creates a hawkish policy outlook", () => {
  const packet = packetWith(
    [{
      evidence_id: "ev:nfp:strong",
      claim_or_fact: "Nonfarm payrolls were stronger than expected and above consensus.",
      category: "US_LABOUR",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-22T10:00:00Z",
      metrics: {
        signal_kind: "economic_release",
        signal_context: "STRONG_LABOUR_SURPRISE",
      },
      provenance: [{ source_type: "VERIFIED_MACRO_DATA", source_id: "BLS_NFP" }],
    }],
    [],
  );

  const outlook = buildSystem1PolicyExpectationChecks(packet);
  assert.equal(outlook.length, 1);
  assert.equal(outlook[0]?.rule_id, "STRONG_LABOUR_SURPRISE");
  assert.equal(outlook[0]?.policy_impulse, "HAWKISH");
  assert.equal(outlook[0]?.fedwatch_expectation, "HIKE_ODDS_UP");
});


test("System 1 never compares a prior-day market snapshot with a newer macro trigger", () => {
  const packet = packetWith(
    [{
      evidence_id: "ev:pmi:next-day",
      claim_or_fact: "Flash manufacturing PMI was stronger than expected and above consensus.",
      category: "ECONOMIC_METRIC",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-22T10:00:00Z",
      occurrence_time: "2026-09-22T10:00:00Z",
      metrics: {
        signal_kind: "economic_release",
        signal_context: "STRONG_ACTIVITY_SURPRISE",
      },
      provenance: [{ source_type: "VERIFIED_MACRO_DATA", source_id: "FLASH_PMI" }],
    }],
    [{
      evidence_id: "market-monitor:us2y:2026-09-21",
      claim_or_fact: "US 2Y moved lower on September 21.",
      available_at: "2026-09-21T22:00:00Z",
      occurrence_time: "2026-09-21T20:00:00Z",
      grouping_key: "market-monitor:us2y",
      category: "MARKET",
      source_type: "MARKET_DATA",
      metrics: { day_change_pct: -0.4 },
      provenance: [{ source_type: "MARKET_DATA", source_id: "market-monitor:us2y" }],
    }],
  );

  assert.equal(buildSystem1PolicyExpectationChecks(packet)[0]?.rule_id, "STRONG_ACTIVITY_SURPRISE");
  assert.deepEqual(buildSystem1DivergenceCandidates(packet), []);
});
