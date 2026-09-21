import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import { buildResearchBrainPrompt } from "../lib/dossier-v2/research-brain-prompt.ts";
import {
  buildSystem1DivergenceCandidates,
  runSystem1RelationshipChecks,
} from "../lib/dossier-v2/system1-divergence.ts";

const AS_OF = "2026-09-22T12:00:00Z";
const AVAILABLE_AT = "2026-09-22T11:30:00Z";

function marketMonitor(
  id: string,
  dayChangePct: number | null,
): Record<string, unknown> {
  return {
    evidence_id: `market-monitor:${id}:2026-09-22`,
    claim_or_fact: `Market monitor ${id} moved ${dayChangePct ?? "n/a"}% on the day.`,
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-22T00:00:00Z",
    grouping_key: `market-monitor:${id}`,
    category: "MARKET",
    source_type: "MARKET_DATA",
    metrics: {
      symbol: id.toUpperCase(),
      day_change_pct: dayChangePct,
    },
    provenance: [
      {
        source_type: "MARKET_DATA",
        source_id: `market-monitor:${id}`,
        publisher: "TEST",
      },
    ],
  };
}

function packetWith(
  eventFacts: Array<Record<string, unknown>>,
  monitors: Array<Record<string, unknown>>,
) {
  const snapshot: CandidateSnapshot = {
    observed_evidence: [...eventFacts, ...monitors],
    price_data: {
      status: "OK",
      available_at: AVAILABLE_AT,
    },
    macro_data: {
      status: "OK",
      available_at: AVAILABLE_AT,
    },
  };

  return assembleDossierV2InputPacket(
    { as_of: AS_OF },
    snapshot,
  );
}

test("System 1 detects opposite market reactions without generating causal explanations", () => {
  const packet = packetWith(
    [
      {
        evidence_id: "ev:fomc:hawkish",
        claim_or_fact: "The Federal Reserve delivered a hawkish rate hike and retained a tightening bias.",
        category: "MONETARY_POLICY",
        source_type: "PRESS_RELEASE",
        available_at: "2026-09-22T10:00:00Z",
        provenance: [
          {
            source_type: "PRESS_RELEASE",
            source_id: "FOMC_STATEMENT",
            publisher: "Federal Reserve",
          },
        ],
      },
    ],
    [
      marketMonitor("us2y", 0.4),
      marketMonitor("dxy", -0.6),
      marketMonitor("gold", 1.2),
      marketMonitor("smh", -0.8),
    ],
  );

  const checks = runSystem1RelationshipChecks(packet);
  const byInstrument = new Map(checks.map((check) => [check.instrument, check]));

  assert.equal(byInstrument.get("US02Y")?.status, "CONFIRMED");
  assert.equal(byInstrument.get("SMH")?.status, "CONFIRMED");
  assert.equal(byInstrument.get("DXY")?.status, "DIVERGED");
  assert.equal(byInstrument.get("XAUUSD")?.status, "DIVERGED");

  const candidates = buildSystem1DivergenceCandidates(packet);
  assert.deepEqual(
    candidates.map((item) => item.instrument),
    ["XAUUSD", "DXY"],
  );
  assert.equal(candidates[0]?.trigger_evidence_id, "ev:fomc:hawkish");
  assert.equal(candidates[0]?.market_evidence_id, "market-monitor:gold:2026-09-22");
  assert.ok(!("explanation" in (candidates[0] ?? {})));
});

test("System 1 suppresses directional checks when opposing policy signals coexist", () => {
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

  assert.deepEqual(runSystem1RelationshipChecks(packet), []);
  assert.deepEqual(buildSystem1DivergenceCandidates(packet), []);
});

test("System 1 does not inject tiny or unavailable moves into the Research Brain", () => {
  const packet = packetWith(
    [
      {
        evidence_id: "ev:cpi:hot",
        claim_or_fact: "CPI was hotter than expected relative to consensus.",
        category: "ECONOMIC_METRIC",
        source_type: "STATISTICAL_AGENCY",
        available_at: "2026-09-22T10:00:00Z",
        provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "BLS_CPI" }],
      },
    ],
    [
      marketMonitor("us2y", 0.01),
      marketMonitor("dxy", null),
      marketMonitor("gold", -0.02),
      marketMonitor("smh", 0.01),
    ],
  );

  const checks = runSystem1RelationshipChecks(packet);
  assert.ok(checks.length > 0);
  assert.ok(checks.every((check) => check.status === "INSUFFICIENT_DATA"));
  assert.deepEqual(buildSystem1DivergenceCandidates(packet), []);

  const prompt = buildResearchBrainPrompt({
    as_of: packet.as_of,
    packet,
  });

  assert.deepEqual(prompt.boundedInput.system1_divergence_candidates, []);
  assert.match(prompt.instructions, /SYSTEM 1 DIVERGENCE SCREEN/);
  assert.match(prompt.instructions, /NOT independent facts/);
});

test("Research Brain receives only compact material divergence candidates", () => {
  const packet = packetWith(
    [
      {
        evidence_id: "ev:energy:stress",
        claim_or_fact: "A Strait of Hormuz shipping disruption is creating oil supply disruption risk.",
        category: "ENERGY",
        source_type: "NEWS_MARKET_CONTEXT",
        is_admitted_fact: true,
        available_at: "2026-09-22T10:00:00Z",
        provenance: [{ source_type: "NEWS", source_id: "ENERGY_1" }],
      },
    ],
    [
      marketMonitor("wti", -1.5),
      marketMonitor("distillate", -0.8),
      marketMonitor("crack-distillate", -0.4),
    ],
  );

  const prompt = buildResearchBrainPrompt({
    as_of: packet.as_of,
    packet,
  });
  const candidates = prompt.boundedInput.system1_divergence_candidates as Array<Record<string, unknown>>;

  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((item) => item.observed_direction === "DOWN"));
  assert.ok(candidates.every((item) => item.expected_direction === "UP"));
  assert.ok(candidates.every((item) => typeof item.market_evidence_id === "string"));
  assert.ok(JSON.stringify(candidates).length < 2_000);
});
