import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { MARKET_BELIEF_SCHEMA, type EvidencePackItem } from "../lib/intelligence/schemas.ts";
import {
  materialAssessmentHasEligibleEvidence,
  selectStoryReviewTargets,
  type StoryReviewStory,
} from "../lib/intelligence/story-review.ts";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260823193000_existing_story_maintenance_contract_v1.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");
const sqlContract = fs.readFileSync(
  path.join(root, "supabase", "tests", "existing_story_maintenance_contract.sql"),
  "utf8",
);

function storyAssessmentSchema() {
  const schema = MARKET_BELIEF_SCHEMA as any;
  return schema.properties.storyAssessments.items;
}

function evidence(overrides: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id: "evidence-1",
    claim: "Fresh official evidence supports the existing mechanism.",
    summary: null,
    evidenceClass: "official_release",
    sourceName: "Official source",
    sourceTier: 1,
    reliabilityScore: 95,
    ancestryGroupId: "official:one",
    supportDirection: "supporting",
    eventAt: "2026-08-24T01:00:00.000Z",
    publishedAt: "2026-08-24T01:00:00.000Z",
    affectedAssets: ["SPX"],
    affectedTopics: ["ai-capex"],
    provenanceUrls: ["https://example.gov/release"],
    ...overrides,
  };
}

function story(): StoryReviewStory {
  return {
    id: "story-1",
    slug: "ai-capex",
    title: "AI capex stays supportive",
    thesis: "AI capex remains supportive while funding conditions stay loose and demand holds.",
    status: "developing",
    confidence: 65,
    marketQuestion: "Can AI capex remain supportive?",
    dominantNarrative: "AI investment remains resilient.",
    strongestSupport: "Capex guidance remains firm.",
    strongestContradiction: "Funding costs are rising.",
    confirmationTrigger: "Capex guidance remains firm through the next results cycle.",
    invalidationTrigger: "Demand weakens while funding costs rise.",
    nextCatalyst: "2026-08-23 Earnings call",
    assets: ["SPX", "NVDA"],
    lastEvaluatedAt: "2026-08-22T00:00:00.000Z",
    lastEvidenceAt: "2026-08-22T00:00:00.000Z",
    nextCatalysts: [
      "2026-08-23 Earnings call",
      "2026-08-28 PCE release",
    ],
  };
}

test("Market Belief requires the complete frozen StoryAssessmentOutputV1 proposal contract", () => {
  const assessment = storyAssessmentSchema();
  assert.equal(assessment.additionalProperties, false);
  assert.deepEqual(new Set(assessment.required), new Set([
    "storyId",
    "disposition",
    "rationale",
    "confidenceDelta",
    "evidenceIds",
    "proposedTitle",
    "proposedThesis",
    "proposedMarketQuestion",
    "proposedConfirmation",
    "proposedInvalidation",
    "proposedNextCatalyst",
  ]));
  assert.ok(assessment.properties.proposedNextCatalyst);
  assert.equal(assessment.properties.proposedCausalChain, undefined);
  assert.equal(assessment.properties.proposedAcceptedExplanation, undefined);
  assert.equal(assessment.properties.proposedScenario, undefined);
  assert.equal(assessment.properties.proposedAssetImplications, undefined);
});

test("Story review freezes deterministic catalyst candidates for server validation", () => {
  const targets = selectStoryReviewTargets({
    stories: [story()],
    evidence: [evidence()],
    evidenceLinks: [{
      storyId: "story-1",
      evidenceId: "evidence-1",
      evidenceRole: "supporting",
      linkedAt: "2026-08-24T01:00:00.000Z",
    }],
    queue: [],
    debt: [],
    now: new Date("2026-08-24T02:00:00.000Z"),
  });

  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0].reviewContext?.catalystCandidates, [
    { label: "2026-08-23 Earnings call", catalystRef: null },
    { label: "2026-08-28 PCE release", catalystRef: null },
  ]);
  assert.deepEqual(targets[0].reviewContext?.dueCatalysts, ["2026-08-23 Earnings call"]);
});

test("creator-only evidence still cannot authorise a material Story mutation", () => {
  const target = selectStoryReviewTargets({
    stories: [story()],
    evidence: [evidence({
      id: "transcript-1",
      evidenceClass: "transcript",
      sourceName: "Creator",
      sourceTier: 5,
      ancestryGroupId: "creator:one",
    })],
    evidenceLinks: [{
      storyId: "story-1",
      evidenceId: "transcript-1",
      evidenceRole: "supporting",
      linkedAt: "2026-08-24T01:00:00.000Z",
    }],
    queue: [{
      id: "queue-1",
      storyId: "story-1",
      status: "pending",
      reason: "creator lead",
      priority: 80,
      availableAt: "2026-08-24T00:00:00.000Z",
      createdAt: "2026-08-24T00:00:00.000Z",
    }],
    debt: [],
    now: new Date("2026-08-24T02:00:00.000Z"),
  })[0];

  assert.ok(target);
  assert.equal(materialAssessmentHasEligibleEvidence("reinforced", ["transcript-1"], target), false);
  assert.equal(materialAssessmentHasEligibleEvidence("invalidated", ["transcript-1"], target), false);
  assert.equal(materialAssessmentHasEligibleEvidence("reinforced", ["not-in-frozen-evidence"], target), false);
});

test("database freezes the full proposal object from the persisted Market Belief stage output", () => {
  assert.match(migration, /add column if not exists proposed_updates jsonb not null default '\{\}'::jsonb/);
  assert.match(migration, /freeze_story_assessment_proposed_updates/);
  assert.match(migration, /stage\.output_payload -> 'storyAssessments'/);
  assert.match(migration, /jsonb_array_length\(matching_assessments\) <> 1/);
  assert.match(migration, /'title', nullif\(btrim\(stage_assessment ->> 'proposedTitle'\)/);
  assert.match(migration, /'marketQuestion', nullif\(btrim\(stage_assessment ->> 'proposedMarketQuestion'\)/);
  assert.match(migration, /'confirmation'.*proposed_confirmation/s);
  assert.match(migration, /'invalidation'.*proposed_invalidation/s);
  assert.match(migration, /'nextCatalyst'.*proposed_next_catalyst/s);
});

test("server-side disposition matrix owns all six maintenance categories", () => {
  assert.match(migration, /when 'unchanged' then array\['nextCatalyst'\]::text\[\]/);
  assert.match(migration, /when 'reinforced' then array\['confirmation','invalidation','nextCatalyst'\]::text\[\]/);
  assert.match(migration, /when 'weakened' then array\['confirmation','invalidation','nextCatalyst'\]::text\[\]/);
  assert.match(migration, /when 'reframed' then array\['title','thesis','marketQuestion','confirmation','invalidation','nextCatalyst'\]::text\[\]/);
  assert.match(migration, /when 'invalidated' then array\[\]::text\[\]/);
  for (const disposition of ["unchanged", "reinforced", "weakened", "reframed", "invalidated"]) {
    assert.match(sqlContract, new RegExp(`'${disposition}'`));
  }
  for (const category of ["title", "thesis", "marketQuestion", "confirmation", "invalidation", "nextCatalyst"]) {
    assert.match(sqlContract, new RegExp(`'${category}'`));
  }
});

test("required negative maintenance cases fail closed or ignore illegal fields", () => {
  assert.match(sqlContract, /Reinforced must not rewrite title/);
  assert.match(sqlContract, /Weakened must not rewrite thesis/);
  assert.match(sqlContract, /A reframe without proposed thesis must fail closed/);
  assert.match(sqlContract, /A mechanism-changing reframe must fail closed/);
  assert.match(migration, /assessment\.disposition <> 'reframed' or proposal_thesis is not null/);
  assert.match(migration, /mechanism_reframe_blocked := not public\.story_maintenance_reframe_is_lightweight/);
  assert.match(migration, /when effective_status='invalidated' then 'archived'/);
  assert.match(migration, /new_invalidation := story_row\.invalidation_trigger/);
  assert.doesNotMatch(
    migration.match(/if material_allowed then[\s\S]*?story_changed :=/)?.[0] ?? "",
    /effective_status='invalidated'[\s\S]*new_invalidation\s*:=\s*proposal/,
  );
});

test("lightweight reframe validation is symmetric and covers every mutable prose projection", () => {
  assert.match(migration, /story_maintenance_text_reframe_is_lightweight/);
  assert.match(migration, /\(select old_tokens from old_tokens\) = \(select new_tokens from new_tokens\)/);
  assert.match(migration, /proposal_title is not null[\s\S]*story_row\.title/);
  assert.match(migration, /proposal_question is not null[\s\S]*story_row\.market_question/);
  assert.match(migration, /proposal_confirmation_text is not null[\s\S]*story_row\.confirmation_trigger/);
  assert.match(migration, /proposal_invalidation_text is not null[\s\S]*story_row\.invalidation_trigger/);
  for (const adversarialCase of [
    "supply rather than demand",
    "credit rather than rates",
    "overlooked variable becomes",
    "asset transmission changes",
  ]) {
    assert.match(sqlContract, new RegExp(adversarialCase));
  }
});

test("unchanged next-catalyst rolling is conditional and cannot invent a candidate", () => {
  assert.match(migration, /story_maintenance_catalyst_candidate_is_valid/);
  assert.match(migration, /review_context -> 'catalystCandidates'/);
  assert.match(migration, /review_context -> 'dueCatalysts'/);
  assert.match(migration, /assessment\.disposition = 'unchanged'[\s\S]*candidate_valid[\s\S]*current_catalyst_due/);
  for (const catalystCase of [
    "not-yet-due catalyst",
    "wrong catalystRef",
    "invented candidate",
    "null proposed label",
    "legitimate due candidate",
  ]) {
    assert.match(sqlContract, new RegExp(catalystCase));
  }
});

test("a later applied assessment makes an older pending assessment stale", () => {
  assert.match(migration, /newer\.story_id = assessment\.story_id/);
  assert.match(migration, /newer\.applied_at is not null/);
  assert.match(migration, /row\(newer\.selected_at,newer\.created_at\)[\s\S]*row\(assessment\.selected_at,assessment\.created_at\)/);
  assert.match(migration, /Story assessment was superseded by a newer applied assessment/);
});

test("maintenance versions preserve prior V1 reasoning and patch only lifecycle or criteria", () => {
  assert.match(migration, /version\.snapshot -> 'reasoning'/);
  assert.match(migration, /p_prior_reasoning ->> 'contractVersion' <> 'canonical-story-reasoning\/v1'/);
  assert.match(migration, /return p_prior_reasoning \|\| p_reasoning_patch/);
  assert.match(migration, /jsonb_build_object\('lifecycle', new_lifecycle_status\)/);
  assert.match(migration, /jsonb_build_object\('confirmation', proposal_confirmation\)/);
  assert.match(migration, /jsonb_build_object\('invalidation', proposal_invalidation\)/);
  assert.match(migration, /p_reasoning_patch - array\['lifecycle','confirmation','invalidation'\]/);
  for (const protectedComponent of [
    "causalChain",
    "assetImplications",
    "countercase",
    "overlookedVariable",
    "claims",
    "visualPlan",
    "nextTest",
  ]) {
    assert.match(sqlContract, new RegExp(`Protected V1 ${protectedComponent}`));
  }
});

test("legacy maintenance cannot synthesize a reasoning object", () => {
  assert.match(migration, /if p_prior_reasoning is null then[\s\S]*return null/);
  assert.match(sqlContract, /Legacy maintenance must leave reasoning absent/);
});

test("maintenance context is consumed before the nested pointer update", () => {
  assert.match(
    migration,
    /set_config\('alchemy\.story_maintenance_context', '', true\)[\s\S]*set current_thesis_version_id = new_version_id/,
  );
});

test("PR2 stays inside the existing Market Belief maintenance path", () => {
  assert.doesNotMatch(migration, /create table/i);
  assert.doesNotMatch(migration, /scenario.*insert|insert.*scenario/i);
  assert.doesNotMatch(migration, /challenger.*insert|insert.*challenger/i);
  assert.match(migration, /stage_key='market_belief'/);
  assert.match(migration, /Divergence -> Hypothesis -> Challenger -> Scenario -> Story Synthesis/);
});
