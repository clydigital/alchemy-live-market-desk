import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  completeResearchGapCase,
  startResearchGapCase,
} from "../lib/research-gap-lifecycle.ts";

test("Research Gap execution endpoint is machine-authenticated and owns start/evaluate transitions", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/research-gap/execution/route.ts", import.meta.url), "utf8");

  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/research-gap\/execution"/);
  assert.match(route, /input\.action === "start"/);
  assert.match(route, /input\.action === "evaluate"/);
  assert.match(route, /buildResearchGapPlan/);
  assert.match(route, /loadResearchGapPlanContext/);
  assert.match(route, /evaluateResearchGapEvidence/);
  assert.match(route, /verdict\.shouldStop/);
  assert.match(route, /completeResearchGapCase/);
  assert.doesNotMatch(route, /research-update|recalibrate_story/);
});

test("start transition passes deterministic plan through owned database RPC", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const fakeClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return {
        data: [{
          id: args.p_case_id,
          status: "RESEARCHING",
          research_plan_version: args.p_plan_version,
          research_plan: args.p_plan,
        }],
        error: null,
      };
    },
  };

  const row = await startResearchGapCase({
    caseId: "11111111-1111-4111-8111-111111111111",
    claimToken: "22222222-2222-4222-8222-222222222222",
    planVersion: "research-gap-plan/1",
    plan: { contractVersion: "research-gap-plan/1", planId: "plan-1" },
    startedAt: "2026-10-01T01:00:00Z",
  }, fakeClient as never);

  assert.equal(calls[0]?.name, "start_research_gap_case");
  assert.equal(calls[0]?.args.p_claim_token, "22222222-2222-4222-8222-222222222222");
  assert.equal(row?.status, "RESEARCHING");
});

test("completion transition persists only the deterministic verdict outcome", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const fakeClient = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return {
        data: [{
          id: args.p_case_id,
          status: "COMPLETED",
          research_outcome: args.p_outcome,
          verdict_version: args.p_verdict_version,
          verdict: args.p_verdict,
        }],
        error: null,
      };
    },
  };

  const row = await completeResearchGapCase({
    caseId: "11111111-1111-4111-8111-111111111111",
    claimToken: "22222222-2222-4222-8222-222222222222",
    outcome: "UNRESOLVED",
    verdictVersion: "research-gap-verdict/1",
    verdict: {
      contractVersion: "research-gap-verdict/1",
      outcome: "UNRESOLVED",
      shouldStop: true,
      stopReason: "budget_exhausted",
    },
    completedAt: "2026-10-01T01:10:00Z",
  }, fakeClient as never);

  assert.equal(calls[0]?.name, "complete_research_gap_case");
  assert.equal(calls[0]?.args.p_outcome, "UNRESOLVED");
  assert.equal(row?.status, "COMPLETED");
});


test("manual one-case Gap executor is OIDC-gated, bounded and intentionally stops before handoff", () => {
  const route = readFileSync(new URL("../app/api/admin/research-gap/run-one/route.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../lib/research-gap-manual-web-run.ts", import.meta.url), "utf8");
  const webExecutor = readFileSync(new URL("../lib/research-gap-web-executor.ts", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

  assert.match(route, /handleManualResearchGapWebRun/);
  assert.match(route, /maxDuration = 300/);
  assert.match(handler, /verifyGitHubActionsManualLiveTrigger/);
  assert.match(handler, /batchSize: 1/);
  assert.match(handler, /leaseSeconds: 1800/);
  assert.match(handler, /executeResearchGapWebPlan/);
  assert.match(handler, /evaluateResearchGapEvidence/);
  assert.match(handler, /completeResearchGapCase/);
  assert.match(handler, /handoff: "not_attempted_portion_9b"/);
  assert.doesNotMatch(handler, /handleAutomaticResearchGapHandoff|research-update/);

  assert.match(webExecutor, /tools: \[\{ type: "web_search" \}\]/);
  assert.match(webExecutor, /max_tool_calls: 1/);
  assert.match(webExecutor, /sourceUrl: \{ type: "string", enum: allowedUrls \}/);
  assert.match(webExecutor, /Actively search for contradictory, neutral, or no-change evidence/);

  assert.match(workflow, /- research_gap_one/);
  assert.match(workflow, /env\.MODE == 'research_gap_one'/);
  assert.match(workflow, /api\/admin\/research-gap\/run-one/);
});
