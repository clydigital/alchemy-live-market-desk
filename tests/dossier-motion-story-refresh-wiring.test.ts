import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const execution = readFileSync(
  new URL("../lib/dossier-v2/execution.ts", import.meta.url),
  "utf8",
);
const manualRun = readFileSync(
  new URL("../lib/dossier-v2/manual-run.ts", import.meta.url),
  "utf8",
);

test("C1.2b exact Motion Story refresh runs only after persisted Dossier and before broad refresh agenda", () => {
  const persistAt = execution.indexOf("persistMarketDossierV2");
  const requestAt = execution.indexOf("buildDossierMotionStoryRefreshRequests");
  const exactQueueAt = execution.indexOf("enqueueDossierMotionStoryRefreshRequests");
  const broadAgendaAt = execution.indexOf("enqueueDossierStoryRefreshAgenda");

  assert.ok(persistAt >= 0);
  assert.ok(requestAt > persistAt);
  assert.ok(exactQueueAt > requestAt);
  assert.ok(broadAgendaAt > exactQueueAt);
});

test("C1.2b exact Story refresh wiring uses the same Motion attention and assessments produced by Dossier System 2", () => {
  assert.match(execution, /motionAttention,/);
  assert.match(execution, /assessments: analyticalOutput\.motion_attention_assessments \?\? \[\]/);
  assert.match(execution, /availableAt: packet\.as_of/);
  assert.match(execution, /client: options\.client/);
});

test("C1.2b keeps queue failure diagnostic and non-authoritative", () => {
  assert.match(execution, /motionStoryRefresh\.status === "failed"/);
  assert.match(execution, /dossier_motion_story_refresh_warning/);
  assert.match(execution, /story_refresh_agenda: storyRefreshAgenda/);
  assert.match(execution, /motion_story_refresh: motionStoryRefresh/);
});

test("C1.2b no-change reuse emits an explicit empty Motion Story refresh result", () => {
  assert.match(
    execution,
    /motion_story_refresh:\s*\{[\s\S]*status: "empty" as const,[\s\S]*considered: 0,[\s\S]*resolved: 0,[\s\S]*enqueued: 0/,
  );
});

test("C1.2b manual persisted runs expose exact Motion Story refresh diagnostics", () => {
  assert.match(manualRun, /motion_story_refresh\?: DossierMotionStoryRefreshQueueResult/);
  assert.match(manualRun, /motion_story_refresh: result\.motion_story_refresh/);
});
