import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("leased transcript worker reconciles each affected dedicated video run after a batch", () => {
  const handler = readFileSync(
    new URL("../lib/transcript-worker-handler.ts", import.meta.url),
    "utf8",
  );
  const worker = readFileSync(
    new URL("../lib/transcript-worker.ts", import.meta.url),
    "utf8",
  );

  assert.match(worker, /runId: string/);
  assert.match(worker, /runId: job\.runId/);
  assert.match(handler, /reconcileVideoRuns/);
  assert.match(handler, /new SupabaseTranscriptStore\(\)/);
  assert.match(handler, /recalculateRunState\(runId\)/);
  assert.match(
    handler,
    /const affectedRunIds = \[\.\.\.new Set\(result\.outcomes\.map\(\(outcome\) => outcome\.runId\)/,
  );
  assert.match(handler, /await dependencies\.reconcileVideoRuns\(affectedRunIds\)/);
  assert.match(handler, /checkpointReconciliationWarning/);
});
