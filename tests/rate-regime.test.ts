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
    evidence_id: \`market-monitor:\${id}:2026-09-24\`,
    claim_or_fact: \`\${id} was \${last}.\`,
    category: "Rates",
    source_type: "MARKET_DATA",
    available_at: AVAILABLE_AT,
    occurrence_time: "2026-09-24T00:00:00.000Z",
    grouping_key: \`market-monitor:\${id}\`,
    metrics: {
      last,
      change_5d_pct: change5d,
      frequency: "daily",
      provider: "Federal Reserve Economic Data",
    },
    provenance: [{
      source_type: "FRED",
      source_id: \`market-monitor:\${id}\`,
      url: \`https://fred.stlouisfed.org/series/\${id}\`,
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
