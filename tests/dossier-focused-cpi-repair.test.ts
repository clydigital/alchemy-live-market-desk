import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyFocusedCpiRepair,
  buildFocusedCpiRepairRequest,
  isFocusedCpiRepairEligible,
} from "../lib/dossier-v2/research-brain-focused-cpi-repair.ts";
import type { DossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";

const cpi = "Unsupported headline CPI upside-surprise claim (0.6% m/m). Canonical metric-specific evidence does not show headline ABOVE_FORECAST. The previous month's CPI is NOT the expected forecast.";
const oil = 'market_verdict lens "OIL_WAR_INFLATION" non-null observed_reaction requires at least one market/pricing evidence reference (e.g., PRICING_FEED, MARKET_DATA, YIELD).';
const candidate = 'investigations[0] (inv:cpi-policy-transmission) candidate_explanations[1].evidence_for_ids references evidence outside this Investigation\'s observed_evidence: "treasury-auction:91282CRF0:2026-10-07".';
const errors = [cpi, oil, candidate];

function output() {
  return {
    contract_version: "research-brain/1",
    main_thread: {
      headline: "US yields remain elevated while CPI surprised on the upside (0.6% m/m).",
      answer: "September CPI surprised on the upside (0.6% m/m); real yields remain elevated.",
      evidence_references: ["bls:oct14"],
      regime_implication: "Rates sensitive.",
    },
    market_verdict: {
      lenses: {
        OIL_WAR_INFLATION: {
          observed_reaction: "Oil markets priced a strong near-term shock.",
          observed_reaction_evidence_refs: ["non-pricing:evidence"],
          cross_asset_readthrough: "Oil risks remain elevated.",
        },
      },
    },
    investigations: [{
      investigation_id: "inv:cpi-policy-transmission",
      observed_evidence: ["bls:oct14"],
      candidate_explanations: [
        { rank: 1, confidence: "LOW", evidence_for_ids: ["bls:oct14"], evidence_against_ids: [] },
        {
          rank: 2, confidence: "HIGH",
          evidence_for_ids: ["treasury-auction:91282CRF0:2026-10-07"],
          evidence_against_ids: [],
        },
      ],
    }],
    thesis_ledger: { entries: [{ thesis_id: "thesis:unchanged", version: 4 }] },
    motion_acceptance: { decisions: [] },
    diagnostics: { degraded: false, notes: [] },
  };
}

test("focused repair admits only the precise live CPI + source-reference signature", () => {
  assert.equal(isFocusedCpiRepairEligible(errors), true);
  assert.equal(isFocusedCpiRepairEligible([cpi]), true);
  assert.equal(isFocusedCpiRepairEligible([oil, candidate]), false);
  assert.equal(isFocusedCpiRepairEligible([...errors, "Major Story unsupported and unverified"]), false);
  assert.equal(isFocusedCpiRepairEligible(Array(9).fill(cpi)), false);
});

test("focused repair asks only for CPI prose, not another full Dossier", () => {
  const packet = { packet_id: "packet:fixture", as_of: "2026-10-20T20:00:00Z" } as DossierV2InputPacket;
  const audit = [{ measure: "HEADLINE_MOM", actual: 0.6, outcome: "UNKNOWN_NO_COMPARATOR" }];
  const request = buildFocusedCpiRepairRequest(output(), errors, packet, audit)!;
  assert.deepEqual(request.schema.required, ["headline", "answer"]);
  assert.deepEqual(Object.keys(request.schema.properties).sort(), ["answer", "headline"]);
  assert.deepEqual(request.boundedInput.metric_specific_cpi_audit, audit);
  const main = request.boundedInput.current_main_thread as { evidence_references: string[] };
  assert.equal(main.evidence_references[0], "bls:oct14");
  assert.ok(!("invalid_previous_output" in request.boundedInput));
});

test("scoped repair can downgrade unsupported interpretations but never promote evidence or alter identities", () => {
  const original = output();
  const fix = {
    headline: "US yields remain elevated following September CPI.",
    answer: "September headline CPI rose 0.6% month on month; real yields remain elevated.",
  };
  const patched = applyFocusedCpiRepair(original, fix, errors) as ReturnType<typeof output>;
  assert.ok(patched);
  assert.equal(patched.main_thread.headline, fix.headline);
  assert.equal(patched.main_thread.answer, fix.answer);
  assert.deepEqual(patched.main_thread.evidence_references, original.main_thread.evidence_references);
  assert.equal(patched.market_verdict.lenses.OIL_WAR_INFLATION.observed_reaction, null);
  assert.deepEqual(patched.market_verdict.lenses.OIL_WAR_INFLATION.observed_reaction_evidence_refs, []);
  assert.deepEqual(patched.investigations[0].candidate_explanations[1].evidence_for_ids, []);
  assert.equal(patched.investigations[0].candidate_explanations[1].confidence, "UNRESOLVED");
  assert.deepEqual(patched.thesis_ledger, original.thesis_ledger);
  assert.deepEqual(patched.motion_acceptance, original.motion_acceptance);
  assert.equal(original.investigations[0].candidate_explanations[1].confidence, "HIGH");
  assert.equal(original.market_verdict.lenses.OIL_WAR_INFLATION.observed_reaction !== null, true);
});

test("focused patch refuses extra model fields, missing cited source, mismatched investigation, unknown errors", () => {
  const o = output();
  const fix = { headline: "CPI rose by 0.6% m/m.", answer: "Headline CPI monthly rose 0.6%." };
  assert.equal(applyFocusedCpiRepair(o, { ...fix, thesis_ledger: {} }, errors), null);
  assert.equal(applyFocusedCpiRepair(o, { ...fix, headline: "" }, errors), null);
  assert.equal(applyFocusedCpiRepair(o, fix, [cpi, "unrecognised validator error"]), null);
  const wrong = output();
  wrong.investigations[0].investigation_id = "inv:another";
  assert.equal(applyFocusedCpiRepair(wrong, fix, errors), null);
  const noCitedSource = output();
  noCitedSource.investigations[0].candidate_explanations[1].evidence_for_ids = [];
  assert.equal(applyFocusedCpiRepair(noCitedSource, fix, errors), null);
});

test("integration retains full-output Research Brain validator and only one permitted scoped repair", () => {
  const runtime = readFileSync(new URL("../lib/dossier-v2/research-brain.ts", import.meta.url), "utf8");
  assert.match(runtime, /buildFocusedCpiRepairRequest/);
  assert.match(runtime, /stageKey: "research_brain_repair",[\s\S]{0,200}instructions: focused.instructions/);
  assert.match(runtime, /const focusedVal = validateResearchBrainOutput\(patched, packet\)/);
  assert.match(runtime, /return produceDegradedOutput\(packet, focusedVal.errors, true\)/);
  assert.match(runtime, /model_repair_used: true/);
});
