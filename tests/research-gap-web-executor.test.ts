import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { ResearchGapCaseRow } from "../lib/research-gap-lifecycle.ts";
import type { ResearchGapPlan, ResearchGapVerdict } from "../lib/research-gap-plan.ts";
import {
  admitWebResearchEvidence,
  buildCompletedResearchGapHandoff,
  collectConsultedSources,
} from "../lib/research-gap-web-executor.ts";

function plan(): ResearchGapPlan {
  return {
    contractVersion: "research-gap-plan/1",
    planId: "plan-1",
    caseId: "11111111-1111-4111-8111-111111111111",
    gapKey: "gap:rates",
    generatedAt: "2026-10-02T00:00:00.000Z",
    researchQuestion: "Is long-end stress a term-premium shock?",
    priorExpectation: "Real yields and term premium should lead.",
    objective: "Decompose 10Y/30Y yields and cross-check market transmission.",
    subquestions: [],
    requirements: [{
      id: "req:1:rates",
      description: "10Y/30Y real-yield versus breakeven decomposition",
      required: true,
      preferredSourceClasses: ["official", "market_data", "reporting"],
    }],
    linkedInvestigationIds: ["inv:duration"],
    linkedStoryIds: ["story:rates"],
    blockingRefs: [],
    budget: { maxSources: 8, maxBranches: 3, maxRequirements: 6 },
    stopPolicy: {
      minimumQuality: 65,
      strongQuality: 80,
      authoritativeQuality: 90,
      minimumIndependentStrongSources: 2,
      rules: [],
    },
  };
}

function gap(): ResearchGapCaseRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    gap_key: "gap:rates",
    status: "COMPLETED",
    research_outcome: "CONFIRMING",
    source_kind: "investigation",
    source_ref: "inv:duration",
    question: "Is duration stress broadening?",
    action: "Decompose yields.",
    reason: "Test rates transmission.",
    evidence_needed: ["10Y/30Y decomposition"],
    linked_investigation_ids: ["inv:duration"],
    linked_story_ids: ["story:rates"],
    blocking_refs: [],
    latest_work_id: "work-1",
    latest_dossier_id: "22222222-2222-4222-8222-222222222222",
    latest_dossier_as_of: "2026-10-02T00:00:00.000Z",
    latest_priority_rank: 1,
    latest_priority_score: 90,
    first_seen_at: "2026-10-02T00:00:00.000Z",
    last_seen_at: "2026-10-02T00:00:00.000Z",
    occurrence_count: 1,
    claim_token: null,
    claimed_by: null,
    claimed_at: null,
    claim_expires_at: null,
    attempt_count: 1,
    completed_at: "2026-10-02T00:10:00.000Z",
    handed_off_at: null,
    closed_at: null,
    research_plan_version: "research-gap-plan/1",
    research_plan: plan(),
    research_started_at: "2026-10-02T00:01:00.000Z",
    verdict_version: "research-gap-verdict/1",
    verdict: null,
    handoff_run_key: null,
    handoff_canonical_status: null,
    created_at: "2026-10-02T00:00:00.000Z",
    updated_at: "2026-10-02T00:10:00.000Z",
  };
}

function verdict(): ResearchGapVerdict {
  return {
    contractVersion: "research-gap-verdict/1",
    evidenceSnapshotVersion: "research-gap-evidence-snapshot/1",
    evidenceSnapshot: [{
      evidenceId: "web:abc",
      independenceKey: "treasury.gov",
      sourceClass: "official",
      sourceUrl: "https://home.treasury.gov/source",
      sourceTitle: "Treasury market source",
      publisher: "home.treasury.gov",
      publishedAt: "2026-10-02T00:05:00.000Z",
      summary: "Official rates evidence.",
      requirementIds: ["req:1:rates"],
      direction: "CONFIRMING",
      directness: "DIRECT",
      quality: 95,
      traceable: true,
      claim: "Official data supports the tested rates mechanism.",
    }],
    evaluatedAt: "2026-10-02T00:10:00.000Z",
    planId: "plan-1",
    outcome: "CONFIRMING",
    confidence: 92,
    shouldStop: true,
    stopReason: "direction_resolved",
    eligibleEvidenceIds: ["web:abc"],
    supportingEvidenceIds: ["web:abc"],
    contradictingEvidenceIds: [],
    neutralEvidenceIds: [],
    unresolvedEvidenceIds: [],
    coveredRequirementIds: ["req:1:rates"],
    missingRequirementIds: [],
    strongIndependentConfirming: 1,
    strongIndependentContradicting: 0,
    strongIndependentNeutral: 0,
    authoritativeConfirming: true,
    authoritativeContradicting: false,
    authoritativeNeutral: false,
    sourceCount: 1,
    branchCount: 1,
    rationale: ["Authoritative direct evidence covers all required branches."],
    nextResearch: [],
  };
}

test("consulted source extraction captures tool sources and URL citations", () => {
  const sources = collectConsultedSources({
    output: [
      {
        type: "web_search_call",
        action: {
          type: "search",
          sources: [{ url: "https://example.com/a?utm_source=test", title: "A" }],
        },
      },
      {
        type: "message",
        content: [{
          annotations: [{
            type: "url_citation",
            url: "https://example.org/b",
            title: "B",
          }],
        }],
      },
    ],
  });

  assert.equal(sources.size, 2);
  assert.equal(sources.get("https://example.com/a")?.title, "A");
  assert.equal(sources.get("https://example.org/b")?.title, "B");
});

test("executor admits only actually consulted traceable sources and server-owns quality", () => {
  const consulted = new Map([
    ["https://home.treasury.gov/data", { url: "https://home.treasury.gov/data", title: "Treasury Data" }],
  ]);
  const evidence = admitWebResearchEvidence({
    plan: plan(),
    consulted,
    now: new Date("2026-10-02T00:10:00Z"),
    candidates: [
      {
        sourceUrl: "https://home.treasury.gov/data",
        sourceTitle: "Model title",
        publishedAt: "2026-10-02T00:05:00Z",
        summary: "Treasury decomposition.",
        sourceClass: "reporting",
        requirementIds: ["req:1:rates"],
        direction: "CONFIRMING",
        directness: "DIRECT",
        claim: "Treasury data directly supports the tested mechanism.",
      },
      {
        sourceUrl: "https://hallucinated.example/not-consulted",
        sourceTitle: "Hallucinated",
        publishedAt: "2026-10-02T00:05:00Z",
        summary: "Should be rejected.",
        sourceClass: "official",
        requirementIds: ["req:1:rates"],
        direction: "CONFIRMING",
        directness: "DIRECT",
        claim: "Not actually searched.",
      },
    ],
  });

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.sourceUrl, "https://home.treasury.gov/data");
  assert.equal(evidence[0]?.sourceTitle, "Treasury Data");
  assert.equal(evidence[0]?.sourceClass, "official");
  assert.equal(evidence[0]?.quality, 95);
  assert.equal(evidence[0]?.independenceKey, "home.treasury.gov");
});

test("completed web verdict rebuilds a replayable canonical handoff", () => {
  const handoff = buildCompletedResearchGapHandoff({
    gap: gap(),
    plan: plan(),
    verdict: verdict(),
  });

  assert.equal(handoff.caseId, gap().id);
  assert.equal(handoff.outcome, "CONFIRMING");
  assert.equal(handoff.evidence.length, 1);
  assert.equal(handoff.evidence[0]?.publisher, "home.treasury.gov");
  assert.equal(handoff.evidence[0]?.title, "Treasury market source");
  assert.match(handoff.finding, /^CONFIRMING:/);
});

test("manual web route and workflow remain explicit-only", () => {
  const route = readFileSync(new URL("../app/api/research-gap/web-executor/route.ts", import.meta.url), "utf8");
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

  assert.match(config, /"\/api\/research-gap\/web-executor"/);
  assert.match(route, /action === "run"/);
  assert.match(route, /action === "retry_handoff"/);
  assert.match(route, /handleAutomaticResearchGapHandoff/);
  assert.match(workflow, /- research_gap_web/);
  assert.match(workflow, /env\.MODE == 'research_gap_web'/);
  assert.match(workflow, /\/api\/research-gap\/web-executor/);
  assert.doesNotMatch(workflow, /schedule:[\s\S]{0,500}research_gap_web/);
});
