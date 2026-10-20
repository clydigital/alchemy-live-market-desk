import assert from "node:assert/strict";
import test from "node:test";

import { assembleDossierV2InputPacket, type ObservedEvidence } from "../lib/dossier-v2/input-packet.ts";
import { auditCpiSurprises } from "../lib/dossier-v2/cpi-surprise-audit.ts";
import { buildResearchBrainPrompt } from "../lib/dossier-v2/research-brain-prompt.ts";
import { RESEARCH_BRAIN_INPUT_CONTRACT_VERSION } from "../lib/dossier-v2/research-brain-contracts.ts";

const NOW = "2026-10-20T20:00:00Z";
const BLS = "89bae72c-7734-475b-883f-deb45694fb44";
const CORE = "9f621fc8-9410-478a-91c7-9bb68a813dcb";
const EVENT = "2026-10-14T12:30:00Z";

function row(evidenceId: string, claim: string, observed: number, expected: number | null, previous: number | null): ObservedEvidence {
  return {
    evidence_id: evidenceId,
    canonical_record_backed: true,
    epistemic_label: "OBSERVED",
    claim_or_fact: claim,
    category: "MACRO",
    source_type: "VERIFIED_MACRO_DATA",
    available_at: "2026-10-20T15:37:43.623Z",
    occurrence_time: EVENT,
    metrics: {
      signal_kind: "economic_release",
      signal_context: "HOT_INFLATION_SURPRISE",
      measurement_unit: "percent",
      observed_value: observed,
      expected_value: expected,
      previous_value: previous,
      source_tier: evidenceId === BLS ? 1 : 3,
    },
    provenance: [{ source_type: "VERIFIED_MACRO_DATA", source_id: "source" }],
  };
}

function packet(...items: ObservedEvidence[]) {
  const result = assembleDossierV2InputPacket({ as_of: NOW }, { observed_evidence: [] });
  result.observed_evidence = items;
  result.rate_context = { evidence: items };
  return result;
}

test("September CPI cannot call a headline acceleration an above-consensus surprise", () => {
  const observations = packet(
    row(BLS,
      "September 2026 CPI-U rose 0.6% m/m (SA), versus August 0.4%; headline y/y 3.7% and core m/m 0.3%.",
      0.6, null, 0.4),
    row(CORE,
      "September core CPI was +0.3% m/m above the +0.2% forecast; headline +0.6% m/m met forecast.",
      0.3, 0.2, 0.3),
  );
  const audit = auditCpiSurprises(observations);
  assert.equal(audit.length, 2, "duplicate rate-context UUIDs cannot double-count a release");
  const headline = audit.find(item => item.evidence_id === BLS)!;
  assert.equal(headline.measure, "HEADLINE_MOM");
  assert.equal(headline.actual_minus_previous_pp, 0.2);
  assert.equal(headline.actual_minus_expected_pp, null);
  assert.equal(headline.outcome, "UNKNOWN_NO_COMPARATOR", "August 0.4 was NOT an October pre-release forecast");
  const core = audit.find(item => item.evidence_id === CORE)!;
  assert.equal(core.measure, "CORE_MOM");
  assert.equal(core.actual_minus_expected_pp, 0.1);
  assert.equal(core.actual_minus_previous_pp, 0);
  assert.equal(core.outcome, "ABOVE_FORECAST");
  assert.equal(core.comparator_vintage, "NOT_SEPARATELY_VERIFIED");
  assert.equal(core.source_tier, 3, "An after-release market report is not BLS primary consensus");
});

test("CPI forecast comparison can explicitly MET forecast and cannot be inferred from prose or future arrivals", () => {
  const match = row("0c8b42b9-2429-44c2-8ff6-b0c7cc21ee38",
    "Headline CPI rose 0.6% m/m and matched the separately reported forecast.", 0.6, 0.6, 0.4);
  const wrongUnit = { ...match, evidence_id: "b59416a0-bd9e-4025-86ae-e7d3e1480f06", metrics: { ...match.metrics, measurement_unit: "basis_points" } };
  const future = { ...match, evidence_id: "79ae22a7-0b2b-499d-8b95-5477fd1337d5", available_at: "2026-10-21T00:00:00Z" };
  const notCanonical = { ...match, evidence_id: "edee8744-bc1a-47c0-a63c-496c442ac93e", canonical_record_backed: false };
  const otherKind = { ...match, evidence_id: "51805d74-bfd8-4aa7-8448-18cbdcf202e8", metrics: { ...match.metrics, signal_kind: "market_reaction" } };
  const audit = auditCpiSurprises(packet(match, wrongUnit, future, notCanonical, otherKind));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].outcome, "MET_FORECAST");
  assert.equal(audit[0].actual_minus_expected_pp, 0);
});

test("Research Brain has measured-by-metric forecast warnings without changing the output contract", () => {
  const p = packet(row(BLS, "Headline CPI-U advanced 0.6% m/m from 0.4% previously.", 0.6, null, 0.4));
  const prompt = buildResearchBrainPrompt({
    contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
    as_of: p.as_of,
    packet: p,
  });
  const audit = prompt.boundedInput.system1_cpi_surprise_audit as ReturnType<typeof auditCpiSurprises>;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].outcome, "UNKNOWN_NO_COMPARATOR");
  assert.match(prompt.instructions, /previous is not expected/);
  assert.match(prompt.instructions, /point-in-time consensus receipt/);
  assert.match(prompt.instructions, /headline m\/m/);
  assert.match(prompt.instructions, /−4 bp/);
});
