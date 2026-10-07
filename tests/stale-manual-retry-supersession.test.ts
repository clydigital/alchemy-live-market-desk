import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const handler = readFileSync(
  new URL("../lib/cron-research-intelligence-handler.ts", import.meta.url),
  "utf8",
);

test("stale manual retry supersession is exact-slot, newer-sibling and parent-CAS fenced", () => {
  assert.match(
    handler,
    /select\("id,run_key,schedule_slot,scheduled_for,started_at,status,accuracy_gate,source_checks,warnings,summary,updates_published,updated_at"\)/,
  );
  assert.match(handler, /staleManualRetryCanBeSuperseded\(run, now, publicationCheckpoint\)/);
  assert.match(handler, /\.eq\("schedule_slot", run\.schedule_slot\)/);
  assert.match(handler, /\.eq\("scheduled_for", run\.scheduled_for\)/);
  assert.match(handler, /\.eq\("status", "completed"\)/);
  assert.match(handler, /\.gt\("started_at", run\.started_at\)/);
  assert.match(handler, /supersedingRetryMatches\(run, data\)/);

  const terminalise = handler.match(
    /async function terminaliseSupersededRetry[\s\S]*?\n}\n\nasync function readPublicationCheckpoint/,
  )?.[0] ?? "";
  assert.match(terminalise, /\.from\("research_runs"\)/);
  assert.match(terminalise, /status: "failed"/);
  assert.match(terminalise, /\.eq\("id", run\.id\)/);
  assert.match(terminalise, /\.eq\("status", "running"\)/);
  assert.match(terminalise, /\.eq\("updated_at", run\.updated_at\)/);
  assert.match(terminalise, /if \(!data\) return \{ applied: false as const, warning \}/);

  const parentFence = terminalise.indexOf('if (!data) return { applied: false as const, warning };');
  const engineCleanup = terminalise.indexOf('.from("intelligence_engine_runs")');
  assert.ok(parentFence >= 0 && engineCleanup > parentFence);
  assert.match(terminalise, /\.eq\("research_run_id", run\.id\)/);
  assert.match(terminalise, /\.eq\("status", "started"\)/);
  assert.match(terminalise, /engineCleanupWarning/);
});

test("superseded retry exits before continuation/model work", () => {
  const supersession = handler.indexOf("staleManualRetryCanBeSuperseded");
  const decision = handler.indexOf("const decision = evaluateScheduledIntelligenceContinuation");
  assert.ok(supersession >= 0 && decision > supersession);
  assert.match(handler, /reason: "superseded_manual_retry"/);
  assert.match(handler, /supersededByRunId: sibling\.id/);
  assert.match(handler, /supersededByRunKey: sibling\.run_key/);
});
