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


test("manual snapshot handoff remains separate from web execution", () => {
  const route = readFileSync(new URL("../app/api/admin/research-gap/handoff-one/route.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../lib/research-gap-manual-handoff-run.ts", import.meta.url), "utf8");
  const adapter = readFileSync(new URL("../lib/research-gap-snapshot-handoff.ts", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

  assert.match(route, /handleManualResearchGapSnapshotHandoff/);
  assert.match(route, /maxDuration = 300/);
  assert.match(handler, /verifyGitHubActionsManualLiveTrigger/);
  assert.match(handler, /handleAutomaticResearchGapHandoff/);
  assert.match(handler, /status === "COMPLETED"/);
  assert.doesNotMatch(handler, /executeResearchGapWebPlan/);
  assert.doesNotMatch(handler, /claimResearchGapCases/);

  assert.match(adapter, /evidenceSnapshotVersion/);
  assert.doesNotMatch(adapter, /affectedStorySlugs:/);
  assert.match(adapter, /did not expose a reliable publication timestamp/);

  assert.match(workflow, /- research_gap_handoff_one/);
  assert.match(workflow, /env\.MODE == 'research_gap_handoff_one'/);
  assert.match(workflow, /api\/admin\/research-gap\/handoff-one/);
  assert.match(workflow, /research_gap_case_id:/);
  assert.match(workflow, /RESEARCH_GAP_CASE_ID: \${\{ inputs\.research_gap_case_id \}\}/);

  const handoffStart = workflow.indexOf("- name: Hand off one completed Research Gap case");
  const cycleStart = workflow.indexOf("- name: Run one scheduled Research Gap cycle", handoffStart);
  assert.ok(handoffStart >= 0 && cycleStart > handoffStart);
  const manualHandoff = workflow.slice(handoffStart, cycleStart);
  assert.match(manualHandoff, /--arg caseId "\$RESEARCH_GAP_CASE_ID"/);
  assert.match(manualHandoff, /if \$caseId == "" then \{\} else \{caseId:\$caseId\} end/);
  assert.match(manualHandoff, /--data "\$body"/);
});

test("manual Research Gap cycle stays one-case and retry-first after scheduled ownership moves to Vercel", () => {
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

  assert.doesNotMatch(workflow, /cron: "15 3 \* \* \*"/);
  assert.doesNotMatch(workflow, /cron: "15 15 \* \* \*"/);
  assert.match(workflow, /- research_gap_cycle/);
  assert.match(workflow, /env\.MODE == 'research_gap_cycle'/);
  assert.match(workflow, /group: production-live-research/);
  assert.match(workflow, /cancel-in-progress: false/);

  const cycleStart = workflow.indexOf("- name: Run one scheduled Research Gap cycle");
  const dossierStart = workflow.indexOf("- name: Run Dossier V2 production dry-run", cycleStart);
  assert.ok(cycleStart >= 0 && dossierStart > cycleStart);
  const cycle = workflow.slice(cycleStart, dossierStart);

  const retryHandoff = cycle.indexOf('invoke_json "/api/admin/research-gap/handoff-one"');
  const research = cycle.indexOf('invoke_json "/api/admin/research-gap/run-one"');
  const exactHandoff = cycle.lastIndexOf('invoke_json "/api/admin/research-gap/handoff-one"');
  assert.ok(retryHandoff >= 0 && research > retryHandoff && exactHandoff > research);
  assert.match(cycle, /case_id="\$\(jq -er '\.caseId' "\$RESEARCH_FILE"\)"/);
  assert.match(cycle, /--arg caseId "\$case_id" '\{caseId:\$caseId\}'/);
  assert.match(cycle, /Research Gap cycle skipped: no queued case is claimable/);
  assert.match(cycle, /pending canonical handoff; no new case will be researched/);
  assert.doesNotMatch(cycle, /for attempt|while |until /);
});


test("B3 canonical Research Gap handoff does not trigger Dossier V2", () => {
  const automatic = readFileSync(new URL("../lib/research-gap-auto-handoff.ts", import.meta.url), "utf8");
  const manual = readFileSync(new URL("../lib/research-gap-manual-handoff-run.ts", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

  assert.match(automatic, /\/api\/research-update/);
  assert.doesNotMatch(automatic, /runManualDossierV2|api\/admin\/dossier-v2\/run|syncLatestPrioritisedResearchGapCases/);
  assert.doesNotMatch(manual, /runManualDossierV2|api\/admin\/dossier-v2\/run|syncLatestPrioritisedResearchGapCases/);

  const cycleStart = workflow.indexOf("- name: Run one scheduled Research Gap cycle");
  const dossierStart = workflow.indexOf("- name: Run Dossier V2 production dry-run", cycleStart);
  assert.ok(cycleStart >= 0 && dossierStart > cycleStart);
  const cycle = workflow.slice(cycleStart, dossierStart);
  assert.match(cycle, /api\/admin\/research-gap\/handoff-one/);
  assert.doesNotMatch(cycle, /dossier_v2_persist|api\/admin\/dossier-v2\/run/);
});

test("B3 preserves historical market_motion Research Gap lifecycle compatibility", () => {
  const worker = readFileSync(new URL("../lib/research-gap-worker.ts", import.meta.url), "utf8");
  const lifecycle = readFileSync(new URL("../lib/research-gap-lifecycle.ts", import.meta.url), "utf8");
  const automatic = readFileSync(new URL("../lib/research-gap-auto-handoff.ts", import.meta.url), "utf8");

  assert.match(worker, /ResearchGapWorkSource[\s\S]*"market_motion"/);
  assert.match(lifecycle, /source_kind:\s*PrioritisedResearchGap\["sourceKind"\]/);
  assert.doesNotMatch(lifecycle, /source_kind\s*===\s*["']market_motion["']|source_kind\s*!==\s*["']market_motion["']/);
  assert.doesNotMatch(automatic, /source_kind\s*===\s*["']market_motion["']|source_kind\s*!==\s*["']market_motion["']/);
});
