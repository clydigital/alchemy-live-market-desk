import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchGapCaseRow } from "../lib/research-gap-lifecycle.ts";
import { buildResearchGapPlan } from "../lib/research-gap-plan.ts";
import {
  researchGapEvidenceSchema,
  researchGapSearchBranches,
} from "../lib/research-gap-web-executor.ts";

function gap(): ResearchGapCaseRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    gap_key: "gap:investigation:inv:duration",
    status: "CLAIMED",
    research_outcome: null,
    source_kind: "investigation",
    source_ref: "inv:duration",
    question: "Is duration stress broadening beyond the front end?",
    action: "Decompose long-end yields and verify cross-asset transmission.",
    reason: "Tests broader financial tightening.",
    evidence_needed: [
      "10Y/30Y real-yield versus breakeven decomposition",
      "HY/IG and MOVE/VIX confirmation",
    ],
    linked_investigation_ids: ["inv:duration"],
    linked_story_ids: ["story:rates"],
    blocking_refs: [],
    latest_work_id: "gap-work:duration",
    latest_dossier_id: "22222222-2222-4222-8222-222222222222",
    latest_dossier_as_of: "2026-10-01T00:00:00.000Z",
    latest_priority_rank: 1,
    latest_priority_score: 88,
    first_seen_at: "2026-10-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    occurrence_count: 1,
    claim_token: "33333333-3333-4333-8333-333333333333",
    claimed_by: "worker",
    claimed_at: "2026-10-01T00:05:00.000Z",
    claim_expires_at: "2026-10-01T00:35:00.000Z",
    attempt_count: 1,
    completed_at: null,
    handed_off_at: null,
    closed_at: null,
    research_plan_version: null,
    research_plan: null,
    research_started_at: null,
    verdict_version: null,
    verdict: null,
    handoff_run_key: null,
    handoff_canonical_status: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:05:00.000Z",
  };
}

test("web executor uses exactly the bounded three-branch research design", () => {
  const plan = buildResearchGapPlan(gap());
  const branches = researchGapSearchBranches(plan);

  assert.equal(branches.length, plan.budget.maxBranches);
  assert.match(branches[0]!, /strongest direct primary\/authoritative evidence/i);
  assert.match(branches[1]!, /independent market-data/i);
  assert.match(branches[2]!, /contradictory, neutral, or no-change evidence/i);
});

test("assessment schema cannot cite a URL outside the web-search source set", () => {
  const plan = buildResearchGapPlan(gap());
  const urls = [
    "https://home.treasury.gov/source-a",
    "https://fred.stlouisfed.org/source-b",
  ];
  const schema = researchGapEvidenceSchema(plan, urls) as any;
  const evidence = schema.properties.evidence;

  assert.equal(evidence.maxItems, plan.budget.maxSources);
  assert.deepEqual(evidence.items.properties.sourceUrl.enum, urls);
  assert.deepEqual(
    evidence.items.properties.requirementIds.items.enum,
    plan.requirements.map((item) => item.id),
  );
  assert.deepEqual(evidence.items.properties.traceable.enum, [true]);
});


test("oil original-file search happens automatically in the existing bounded three research branches", () => {
  const oil = gap();
  oil.question = "Retrieve original WTI and ICE Brent F1/F2 contract settlements on 14 October 2026";
  oil.evidence_needed = [
    "Original dated FINAL CME WTI and ICE Brent futures curve settles with exact contract month",
  ];
  const plan = buildResearchGapPlan(oil);
  const queries = researchGapSearchBranches(plan);
  assert.equal(queries.length, plan.budget.maxBranches);
  assert.match(queries[0]!, /original document discovery/i);
  assert.match(queries[0]!, /NYMEX CME Daily Bulletin Section 61/i);
  assert.match(queries[0]!, /ICE Brent Futures original exchange/i);
  assert.match(queries[0]!, /not CME BZ/i);
  assert.match(queries[0]!, /current\/rotating PDFs.*ACCESS BLOCKERS/i);
  assert.match(queries[0]!, /Do not invent an archival URL/i);
  assert.match(queries[1]!, /separate F1\/F2 contract symbols/i);
  assert.match(queries[1]!, /SECONDARY CURVE CROSS-CHECK.*RESEARCH LEADS ONLY/i);
  assert.match(queries[1]!, /named, single-expiry historical contract quotes/i);
  assert.match(queries[1]!, /settlement, end-of-day close or last trade/i);
  assert.match(queries[1]!, /two genuinely independent publishers per leg/i);
  assert.match(queries[1]!, /provisional context only, not.*DIRECT evidence/i);
  assert.match(queries[1]!, /UNRESOLVED until original proof passes/i);
  assert.match(queries[2]!, /disagreements in named-expiry prices/i);
  assert.match(queries[2]!, /unresolved conflicts remain research gaps/i);

  const rates = buildResearchGapPlan(gap());
  const standard = researchGapSearchBranches(rates);
  assert.equal(standard.some(q => q.includes("NYMEX CME Daily Bulletin")), false,
    "Rates research is not burdened with irrelevant oil publisher requests");
  assert.equal(standard.some(q => q.includes("SECONDARY CURVE CROSS-CHECK")), false,
    "Secondary oil curve research is conditional, not added to every rates run");
});
