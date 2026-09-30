import assert from "node:assert/strict";
import test from "node:test";

import {
  AutomaticGapHandoffError,
  buildAutomaticResearchGapRun,
  handleAutomaticResearchGapHandoff,
  type CompletedResearchGapResult,
} from "../lib/research-gap-auto-handoff.ts";

function completed(overrides: Partial<CompletedResearchGapResult> = {}): CompletedResearchGapResult {
  return {
    gateRunId: "2026-10-01T0100Z",
    gapId: "rates-duration-confirmation",
    investigationId: "inv-duration-01",
    pulseRefs: ["pulse-2026-10-01-1"],
    affectedStorySlugs: ["us-rates-duration"],
    researchQuestion: "Has duration stress broadened beyond the next Fed meeting?",
    priorExpectation: "A front-end-only repricing should leave the long end comparatively contained.",
    finding: "The 20Y and 30Y remained elevated while the 2Y response was smaller.",
    confidence: 82,
    outcome: "CONFIRMING",
    remainsUnknown: ["Term premium versus inflation compensation is not fully resolved."],
    liveImplication: "Treat the move as broader duration stress.",
    nextTest: "Compare real yields, breakevens and auction demand.",
    completedAt: "2026-10-01T01:00:00.000Z",
    evidence: [{
      sourceId: "treasury-curve-2026-09-30",
      publisher: "U.S. Department of the Treasury",
      title: "Daily Treasury Par Yield Curve Rates",
      url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
      publishedAt: "2026-09-30T20:00:00.000Z",
      claim: "Long-end Treasury yields remained elevated relative to the front end.",
      sourceQuality: 100,
      relevance: 98,
      novelty: 78,
      materiality: 92,
    }],
    ...overrides,
  };
}

test("completed Gap result becomes a canonical manual research run automatically", () => {
  const run = buildAutomaticResearchGapRun(completed());
  assert.equal(run.runKey, "gap-gate:2026-10-01T0100Z:rates-duration-confirmation");
  assert.equal(run.scheduleSlot, "manual");
  assert.equal(run.scheduledFor, "2026-10-01T01:00:00.000Z");
  assert.deepEqual(run.sourceChecks, []);
  assert.equal(run.handoff?.kind, "research_gap_gate");
  assert.equal(run.handoff?.outcome, "CONFIRMING");
  assert.equal(run.items.length, 1);
  assert.match(run.items[0]?.itemKey ?? "", /^gap-source:[a-f0-9]{24}$/);
  assert.equal(run.items[0]?.recommendedAction, "collect_evidence");
  assert.equal(run.items[0]?.transcriptStatus, "not_applicable");
});

test("automatic handoff never caller-forces Story recalibration, including confirming results", () => {
  const confirming = buildAutomaticResearchGapRun(completed({ outcome: "CONFIRMING" }));
  const contradicting = buildAutomaticResearchGapRun(completed({ outcome: "CONTRADICTING" }));
  const noChange = buildAutomaticResearchGapRun(completed({ outcome: "NO_CHANGE" }));
  for (const run of [confirming, contradicting, noChange]) {
    assert.ok(run.items.every((item) => item.recommendedAction === "collect_evidence"));
    assert.equal(run.recalibrations, undefined);
  }
});

test("carrier pages cannot enter canonical Live as automatic Gap evidence", () => {
  assert.throws(
    () => buildAutomaticResearchGapRun(completed({
      evidence: [{
        publisher: "MacroPulse",
        title: "MacroPulse 1 Oct",
        url: "https://www.notion.so/macro-pulse",
        publishedAt: "2026-10-01T00:00:00.000Z",
        claim: "Rates are elevated.",
        sourceQuality: 50,
        relevance: 90,
        novelty: 70,
        materiality: 80,
      }],
    })),
    (error: unknown) => {
      assert.ok(error instanceof AutomaticGapHandoffError);
      assert.match(error.errors.join(" "), /underlying source/i);
      return true;
    },
  );
});

test("video evidence requires the transcript before automatic admission", () => {
  assert.throws(
    () => buildAutomaticResearchGapRun(completed({
      evidence: [{
        itemType: "video",
        publisher: "StockedUp",
        title: "Rates discussion",
        url: "https://www.youtube.com/watch?v=example123",
        publishedAt: "2026-10-01T00:00:00.000Z",
        claim: "Creator argues the long end is being driven by supply.",
        sourceQuality: 70,
        relevance: 90,
        novelty: 75,
        materiality: 70,
      }],
    })),
    (error: unknown) => {
      assert.ok(error instanceof AutomaticGapHandoffError);
      assert.match(error.errors.join(" "), /transcriptText is required/i);
      return true;
    },
  );
});

test("automatic bridge forwards the generated canonical run and preserves canonical status", async () => {
  let forwardedRun: unknown = null;
  let forwardedAuthorization: string | null = null;
  const request = new Request("https://live.example/api/research-gap/handoff", {
    method: "POST",
    headers: {
      authorization: "Bearer test-secret",
      "content-type": "application/json",
    },
    body: JSON.stringify(completed()),
  });

  const response = await handleAutomaticResearchGapHandoff(request, {
    authorize: () => true,
    publishCanonical: async (incoming, run) => {
      forwardedRun = run;
      forwardedAuthorization = incoming.headers.get("authorization");
      return Response.json({
        accepted: true,
        runId: "run-1",
        status: "completed",
      }, { status: 200 });
    },
  });

  assert.equal(response.status, 200);
  assert.equal(forwardedAuthorization, "Bearer test-secret");
  assert.equal((forwardedRun as { runKey?: string }).runKey, "gap-gate:2026-10-01T0100Z:rates-duration-confirmation");
  const body = await response.json();
  assert.equal(body.automaticHandoff, true);
  assert.equal(body.canonicalStatus, 200);
  assert.equal(body.canonicalBody.runId, "run-1");
});

test("canonical pending/replay responses pass through instead of creating another handoff identity", async () => {
  const request = new Request("https://live.example/api/research-gap/handoff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(completed()),
  });
  const response = await handleAutomaticResearchGapHandoff(request, {
    authorize: () => true,
    publishCanonical: async (_incoming, run) => Response.json({
      accepted: true,
      replayed: true,
      runId: "run-existing",
      runKey: run.runKey,
      status: "intelligence_pending",
    }, { status: 202 }),
  });

  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.runKey, "gap-gate:2026-10-01T0100Z:rates-duration-confirmation");
  assert.equal(body.canonicalBody.replayed, true);
});

test("automatic bridge rejects unauthorised callers before constructing or publishing a run", async () => {
  let published = false;
  const request = new Request("https://live.example/api/research-gap/handoff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(completed()),
  });
  const response = await handleAutomaticResearchGapHandoff(request, {
    authorize: () => false,
    publishCanonical: async () => {
      published = true;
      return Response.json({ accepted: true });
    },
  });

  assert.equal(response.status, 401);
  assert.equal(published, false);
});
