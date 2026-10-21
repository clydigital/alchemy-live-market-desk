import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  POST_RESEARCH_DOSSIER_V1,
  handleScheduledPostResearchDossier,
  postResearchEligibility,
  type PostResearchRun,
  type PostResearchSlotRun,
} from "../lib/dossier-post-research-trigger.ts";

const now = new Date("2026-10-21T02:20:00.000Z");
const run: PostResearchRun = {
  id: "e801699b-6809-4d16-a61b-e777a1ebcf55",
  scheduled_for: "2026-10-21T01:30:00.000Z",
  completed_at: "2026-10-21T02:06:05.000Z",
  status: "completed",
};
function slot(overrides: Partial<PostResearchSlotRun> = {}): PostResearchSlotRun {
  return {
    id: "cfcb2bc9-5d9a-4a3a-96a5-28ed3ed7d750",
    research_run_id: run.id,
    slot_key: "morning",
    status: "completed",
    health_state: "healthy",
    live_publication_status: "complete",
    hybrid_handoff_status: "complete",
    stage_summary: {
      accuracy_gate: "open",
      evidence_gate_passed: true,
      required_sources_complete: true,
    },
    updated_at: "2026-10-21T02:06:06.000Z",
    ...overrides,
  };
}

test("Dossier handoff starts only after completed, healthy, evidence-gated Live and Hybrid publication", () => {
  assert.deepEqual(postResearchEligibility(run, slot(), now), {
    eligible: true, reason: "ready", previous: null,
  });
  assert.equal(postResearchEligibility({ ...run, status: "running" }, slot(), now).reason, "canonical_publication_incomplete");
  assert.equal(postResearchEligibility(run, slot({ health_state: "degraded" }), now).eligible, false);
  assert.equal(postResearchEligibility(run, slot({ hybrid_handoff_status: "partial" }), now).eligible, false);
  assert.equal(postResearchEligibility(run, slot({
    stage_summary: { accuracy_gate: "blocked", evidence_gate_passed: true, required_sources_complete: true },
  }), now).reason, "canonical_evidence_gate_incomplete");
  assert.equal(postResearchEligibility(run, slot({ research_run_id: "other" }), now).eligible, false);
});

test("previous NO_CHANGE and persistence are durable decisions, not fresh model work", () => {
  const state = (outcome: "NO_CHANGE" | "PERSISTED") => slot({
    stage_summary: {
      accuracy_gate: "open", evidence_gate_passed: true,
      required_sources_complete: true,
      postResearchDossier: {
        contractVersion: POST_RESEARCH_DOSSIER_V1,
        state: "DONE", attempt: 1,
        claimedAt: "2026-10-21T02:12:00.000Z",
        finishedAt: "2026-10-21T02:14:00.000Z", outcome,
      },
    },
  });
  assert.equal(postResearchEligibility(run, state("NO_CHANGE"), now).reason, "dossier_decision_recorded");
  assert.equal(postResearchEligibility(run, state("PERSISTED"), now).reason, "dossier_decision_recorded");
});

test("active claim blocks concurrent invocation; stale claim is bounded by exactly two attempts", () => {
  const withClaim = (claimedAt: string, attempt: number) => slot({
    stage_summary: {
      evidence_gate_passed: true, required_sources_complete: true,
      postResearchDossier: {
        contractVersion: POST_RESEARCH_DOSSIER_V1,
        state: "RUNNING", claimedAt, attempt,
      },
    },
  });
  assert.equal(postResearchEligibility(run, withClaim("2026-10-21T02:17:00.000Z", 1), now).reason, "dossier_claim_active");
  assert.equal(postResearchEligibility(run, withClaim("2026-10-21T02:10:00.000Z", 1), now).eligible, true);
  assert.equal(postResearchEligibility(run, withClaim("2026-10-21T02:10:00.000Z", 2), now).reason, "dossier_retry_budget_exhausted");
});

test("an old, missing or future research slot must not wake a Dossier", () => {
  assert.equal(postResearchEligibility({ ...run, scheduled_for: "2026-10-20T01:30:00Z" }, slot(), now).reason, "outside_post_research_window");
  assert.equal(postResearchEligibility({ ...run, completed_at: "2026-10-21T03:00:00Z" }, slot(), now).reason, "outside_post_research_window");
  assert.equal(postResearchEligibility(null, slot(), now).reason, "completed_run_unavailable");
});

test("cron endpoint rejects unauthorised invocation before database reads", async () => {
  let touched = false;
  const res = await handleScheduledPostResearchDossier(new Request("https://example.test/"), "morning", {
    authorize: () => false,
    enabled: () => { touched = true; return true; },
  });
  assert.equal(res.status, 401);
  assert.equal(touched, false);
});

test("new route stays inside existing paused/authenticated Vercel research scheduler", () => {
  const morning = readFileSync(new URL("../app/api/cron/research/morning-dossier/route.ts", import.meta.url), "utf8");
  const evening = readFileSync(new URL("../app/api/cron/research/evening-dossier/route.ts", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const source = readFileSync(new URL("../lib/dossier-post-research-trigger.ts", import.meta.url), "utf8");
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.match(middleware, /pathname\.startsWith\("\/api\/cron\/research\/"\)/);
  assert.match(source, /process\.env\.CRON_SECRET/);
  assert.match(source, /acceptsResearchAuthorization/);
  assert.match(source, /eq\("updated_at", slotRun\.updated_at\)/);
  assert.match(source, /runManualDossierV2/);
  // Injecting the Supabase client into manual-run is test-only and would
  // disable the authorised SEC/market data source bridges in production.
  assert.doesNotMatch(source, /evidenceLimit: 180,\\s*client,/);
  assert.match(source, /syncLatestPrioritisedResearchGapCasesWithD7/);
  assert.match(source, /Research Gap sync failed/);
  assert.match(morning, /handleScheduledPostResearchDossier\(request, "morning"\)/);
  assert.match(evening, /handleScheduledPostResearchDossier\(request, "evening"\)/);
  assert.equal(config.crons.filter((c: { path: string }) => c.path === "/api/cron/research/morning-dossier").length, 2);
  assert.equal(config.crons.filter((c: { path: string }) => c.path === "/api/cron/research/evening-dossier").length, 2);
  assert.doesNotMatch(source, /\.from\("story_thesis_versions"\)\.insert/);
});
