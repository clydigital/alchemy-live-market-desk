import assert from "node:assert/strict";
import test from "node:test";

import type { ResearchGapCaseRow } from "../lib/research-gap-lifecycle.ts";
import { handleManualResearchGapSnapshotHandoff } from "../lib/research-gap-manual-handoff-run.ts";
import { completedResearchGapResultFromSnapshot } from "../lib/research-gap-snapshot-handoff.ts";

function completedCase(overrides: Partial<ResearchGapCaseRow> = {}): ResearchGapCaseRow {
  return {
    id: "741ead34-09d2-40b4-b255-b56dd61ae717",
    gap_key: "gap:investigation:inv:duration-transmission:branch:test",
    status: "COMPLETED",
    research_outcome: "UNRESOLVED",
    source_kind: "research_now",
    source_ref: "research-now:1:test",
    question: null,
    action: "Decompose duration transmission.",
    reason: "Test rates transmission.",
    evidence_needed: [],
    linked_investigation_ids: ["inv:duration-transmission"],
    linked_story_ids: ["story:stale-noncanonical-ref"],
    blocking_refs: [],
    latest_work_id: "gap-work:test",
    latest_dossier_id: "33333333-3333-4333-8333-333333333333",
    latest_dossier_as_of: "2026-10-01T00:00:00.000Z",
    latest_priority_rank: 1,
    latest_priority_score: 51,
    first_seen_at: "2026-10-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    occurrence_count: 1,
    claim_token: null,
    claimed_by: null,
    claimed_at: null,
    claim_expires_at: null,
    attempt_count: 1,
    completed_at: "2026-10-02T08:07:13.628Z",
    handed_off_at: null,
    closed_at: null,
    research_plan_version: "research-gap-plan/1",
    research_plan: {
      contractVersion: "research-gap-plan/1",
      planId: "gap-plan:8470f7bc5e4c8781164ded46",
      researchQuestion: "Is duration repricing transmitting into broader risk?",
      priorExpectation: "Front-end-only repricing should leave broader risk contained.",
      linkedInvestigationIds: ["inv:duration-transmission"],
    },
    research_started_at: "2026-10-02T08:05:20.921Z",
    verdict_version: "research-gap-verdict/1",
    verdict: {
      contractVersion: "research-gap-verdict/1",
      evidenceSnapshotVersion: "research-gap-evidence-snapshot/1",
      evaluatedAt: "2026-10-02T08:07:13.628Z",
      outcome: "UNRESOLVED",
      confidence: 95,
      rationale: ["Strong independent evidence supports both sides."],
      missingRequirementIds: [],
      nextResearch: [],
      evidenceSnapshot: [{
        evidenceId: "gap-web:one",
        sourceClass: "official",
        sourceUrl: "https://www.federalreserve.gov/example",
        sourceTitle: "Federal Reserve source",
        publisher: "Federal Reserve Board",
        publishedAt: null,
        summary: "Evergreen official source.",
        requirementIds: ["req:1"],
        direction: "CONFIRMING",
        directness: "DIRECT",
        quality: 95,
        traceable: true,
        claim: "Official source confirms the mechanism is observable.",
      }, {
        evidenceId: "gap-web:two",
        sourceClass: "official",
        sourceUrl: "https://www.newyorkfed.org/example",
        sourceTitle: "New York Fed source",
        publisher: "Federal Reserve Bank of New York",
        publishedAt: "2026-09-30T00:00:00Z",
        summary: "Dated official source.",
        requirementIds: ["req:2"],
        direction: "CONTRADICTING",
        directness: "DIRECT",
        quality: 94,
        traceable: true,
        claim: "Official source contradicts the broad directional interpretation.",
      }],
    },
    handoff_run_key: null,
    handoff_canonical_status: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-02T08:07:14.000Z",
    ...overrides,
  };
}

const authorize = async () => ({
  authorized: true as const,
  actor: "clydigital",
  githubRunId: "144",
  workflowSha: "a".repeat(40),
});

function request(body: unknown = {}) {
  return new Request("https://live.example/api/admin/research-gap/handoff-one", {
    method: "POST",
    headers: {
      authorization: "Bearer oidc-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("persisted verdict snapshot becomes a deterministic completed handoff result", () => {
  const result = completedResearchGapResultFromSnapshot(completedCase());

  assert.equal(result.caseId, "741ead34-09d2-40b4-b255-b56dd61ae717");
  assert.equal(result.gateRunId, "gap-plan:8470f7bc5e4c8781164ded46");
  assert.equal(result.gapId, "741ead34-09d2-40b4-b255-b56dd61ae717");
  assert.equal(result.investigationId, "inv:duration-transmission");
  assert.equal(result.outcome, "UNRESOLVED");
  assert.equal(result.confidence, 95);
  assert.equal(result.affectedStorySlugs, undefined, "stale linked Story refs must not be guessed into slugs");
  assert.equal(result.evidence.length, 2);

  const undated = result.evidence[0]!;
  assert.equal(undated.publishedAt, "2026-10-02T08:07:13.628Z");
  assert.match(undated.summary ?? "", /did not expose a reliable publication timestamp/i);
  assert.equal(undated.sourceQuality, 95);
  assert.equal(undated.relevance, 85);
});

test("snapshot adapter uses the traceable hostname when publisher metadata is absent", () => {
  const row = completedCase();
  const verdict = structuredClone(row.verdict as Record<string, unknown>) as any;
  verdict.evidenceSnapshot[0].publisher = null;
  verdict.evidenceSnapshot[0].sourceTitle = null;

  const result = completedResearchGapResultFromSnapshot(completedCase({ verdict }));

  assert.equal(result.evidence[0]?.publisher, "federalreserve.gov");
  assert.equal(result.evidence[0]?.title, "federalreserve.gov source");
  assert.match(result.evidence[0]?.summary ?? "", /traceable hostname federalreserve\.gov/i);
});

test("snapshot adapter keeps traceable evidence when the source page has no durable title", () => {
  const row = completedCase();
  const verdict = structuredClone(row.verdict as Record<string, unknown>) as any;
  verdict.evidenceSnapshot[0].sourceTitle = null;
  verdict.evidenceSnapshot[0].publisher = "SEC EDGAR";

  const result = completedResearchGapResultFromSnapshot(completedCase({ verdict }));

  assert.equal(result.evidence[0]?.title, "SEC EDGAR source");
  assert.equal(result.evidence[0]?.publisher, "SEC EDGAR");
  assert.equal(result.evidence[0]?.url, "https://www.federalreserve.gov/example");
  assert.match(result.evidence[0]?.claim ?? "", /Official source confirms/);
});

test("snapshot adapter fails closed without durable traceable evidence", () => {
  assert.throws(
    () => completedResearchGapResultFromSnapshot(completedCase({
      verdict: {
        contractVersion: "research-gap-verdict/1",
        evidenceSnapshotVersion: "research-gap-evidence-snapshot/1",
        evaluatedAt: "2026-10-02T08:07:13.628Z",
        outcome: "UNRESOLVED",
        confidence: 95,
        rationale: ["Conflicting evidence."],
        evidenceSnapshot: [],
      },
    })),
    /empty evidence snapshot/i,
  );
});

test("manual handoff picks one completed case and forwards only the persisted snapshot result", async () => {
  const row = completedCase();
  let submittedCaseId: string | null = null;

  const response = await handleManualResearchGapSnapshotHandoff(request(), {
    authorize,
    listCases: async () => [
      row,
      completedCase({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        latest_priority_score: 40,
      }),
    ],
    buildResult: completedResearchGapResultFromSnapshot,
    submit: async (_request, result) => {
      submittedCaseId = result.caseId ?? null;
      return Response.json({
        automaticHandoff: true,
        runKey: "gap-gate:gap-plan:8470f7bc5e4c8781164ded46:741ead34-09d2-40b4-b255-b56dd61ae717",
        canonicalStatus: 202,
        canonicalBody: {
          accepted: true,
          runId: "canonical-run-1",
          status: "intelligence_pending",
        },
        lifecycle: {
          caseId: row.id,
          status: "handed_off",
          lifecycleStatus: "HANDED_OFF",
        },
      }, { status: 202 });
    },
    logger: () => undefined,
  });

  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.status, "handed_off");
  assert.equal(body.caseId, row.id);
  assert.equal(body.lifecycle.lifecycleStatus, "HANDED_OFF");
  assert.equal(submittedCaseId, row.id);
});

test("manual handoff closes a completed D7 case when current D7 state no longer routes it to research", async () => {
  const row = completedCase({
    source_kind: "research_gap",
    source_ref: "d7:d7:dossier-story:story:rates",
    gap_key: "gap:native:d7:dossier-story:story:rates",
  });
  let submitted = false;
  let closed = false;

  const response = await handleManualResearchGapSnapshotHandoff(request({ caseId: row.id }), {
    authorize,
    loadCase: async () => row,
    loadCurrentD7: async () => ({
      dossierId: row.latest_dossier_id,
      dossierAsOf: row.latest_dossier_as_of,
      snapshot: {
        contractVersion: "d7-cross-layer-divergence/1",
        asOf: row.latest_dossier_as_of,
        cases: [{
          id: "d7:dossier-story:story:rates",
          pair: "DOSSIER_STORY",
          state: "ALIGNMENT",
          severity: "LOW",
          reason: "The directional Dossier evidence delta has already received an accepted canonical Story review.",
          analyticalStoryId: "story:rates",
          persistentStoryId: "11111111-1111-4111-8111-111111111111",
          investigationId: null,
          regimeSlug: null,
          evidenceRefs: ["ev:one"],
          researchEligible: false,
        }],
        summary: { ALIGNMENT: 1, CONTRADICTION: 0, LAG: 0, UNRESOLVED: 0 },
        mutationBoundary: { mode: "READ_ONLY", statement: "test" },
      },
    }),
    closeSupersededD7: async () => {
      closed = true;
      return { ...row, status: "CLOSED", closed_at: "2026-10-07T14:00:00.000Z" };
    },
    submit: async () => {
      submitted = true;
      return Response.json({ error: "must not submit" }, { status: 500 });
    },
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "closed_superseded");
  assert.equal(body.lifecycleStatus, "CLOSED");
  assert.equal(closed, true);
  assert.equal(submitted, false);
});

test("manual handoff fails closed when current D7 state cannot validate a completed D7 case", async () => {
  const row = completedCase({
    source_kind: "research_gap",
    source_ref: "d7:d7:dossier-story:story:rates",
  });

  const response = await handleManualResearchGapSnapshotHandoff(request({ caseId: row.id }), {
    authorize,
    loadCase: async () => row,
    loadCurrentD7: async () => null,
    logger: () => undefined,
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).status, "preflight_unavailable");
});

test("canonical failure leaves the durable completed case available for retry", async () => {
  const row = completedCase();
  const response = await handleManualResearchGapSnapshotHandoff(request({ caseId: row.id }), {
    authorize,
    loadCase: async () => row,
    submit: async () => Response.json({
      error: "Canonical Live research handoff failed before acknowledgement.",
      runKey: "gap-gate:test",
    }, { status: 502 }),
    logger: () => undefined,
  });

  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.status, "failed");
  assert.equal(body.caseId, row.id);
});

test("manual handoff exits cleanly when no completed case awaits admission", async () => {
  const response = await handleManualResearchGapSnapshotHandoff(request(), {
    authorize,
    listCases: async () => [
      completedCase({ status: "QUEUED", research_outcome: null, completed_at: null }),
    ],
    logger: () => undefined,
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "empty");
});
