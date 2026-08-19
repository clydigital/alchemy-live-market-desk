import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { startIntelligenceEngineRunWithClient } from "../lib/intelligence/engine-run-contract.ts";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("a nonterminal continuation reuses the exact engine row without rewriting lineage", async () => {
  const writes: Array<{ path: string; init?: RequestInit }> = [];
  const originalStartedAt = "2026-08-20T00:10:00.000Z";
  const result = await startIntelligenceEngineRunWithClient(async <T>(path: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET") {
      return [{
        id: "engine-1",
        status: "partial",
        stories_considered: 0,
        stories_published: 0,
        warnings: [],
        metadata: { frozenInputs: { analysisAsOf: originalStartedAt } },
        started_at: originalStartedAt,
      }] as T;
    }
    writes.push({ path, init });
    return [] as T;
  }, {
    researchRunId: "research-1",
    triggerKind: "new_evidence",
    runKey: "research:cron-v1:morning:2026-08-20",
    dryRun: false,
  });

  assert.equal(result.kind, "started");
  if (result.kind !== "started") return;
  assert.equal(result.reusedExisting, true);
  assert.equal(result.engineRunId, "engine-1");
  assert.equal(result.run.started_at, originalStartedAt);
  assert.equal(writes.length, 0, "continuation must not upsert or rewrite the engine row");
});

test("scheduled continuation exposes explicit state-machine outcomes", () => {
  const handler = source("../lib/cron-research-intelligence-handler.ts");
  for (const state of ["CONTINUE", "RETRY_STAGE", "COMPLETED", "TERMINAL_FAILURE"]) {
    assert.match(handler, new RegExp(`"${state}"`));
  }
  assert.match(handler, /intelligence_race_lost/);
});

test("canonical Scenario and Story Synthesis provider inputs strip critic compatibility state", () => {
  const openai = source("../lib/intelligence/openai.ts");
  assert.match(openai, /stageKey !== "scenario" && stageKey !== "story_synthesis"/);
  assert.match(openai, /challenger: _criticCompatibilityOnly/);
  assert.match(openai, /const modelInput = canonicalStageInput\(stageKey, input\)/);
  assert.match(openai, /input: JSON\.stringify\(modelInput\)/);
});

test("compatibility Challenger consumes no model call and cannot change confidence", () => {
  const openai = source("../lib/intelligence/openai.ts");
  const deterministicStart = openai.indexOf("function deterministicStage");
  const challengerStart = openai.indexOf('if (stageKey === "challenger")', deterministicStart);
  const providerInvocation = openai.indexOf("markModelStageInvoked(stageKey)");
  assert.ok(challengerStart > deterministicStart);
  assert.ok(providerInvocation > challengerStart, "deterministic Challenger must return before provider invocation");
  assert.match(openai, /model: "deterministic-nonblocking-critic"/);
  assert.match(openai, /confidenceAdjustment: 0/);
  assert.match(openai, /verdict: "promote"/);
});
