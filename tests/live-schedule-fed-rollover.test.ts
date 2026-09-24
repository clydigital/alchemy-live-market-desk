import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../components/MarketWorkspace.tsx", import.meta.url), "utf8");
const calendar = readFileSync(new URL("../lib/calendar.ts", import.meta.url), "utf8");
const researchState = readFileSync(new URL("../lib/intelligence/research-state.ts", import.meta.url), "utf8");
const routing = readFileSync(new URL("../lib/research-automation-routing.ts", import.meta.url), "utf8");

test("full Live research is scheduled at the two canonical Malaysia slots through GitHub Actions", () => {
  assert.match(workflow, /cron:\s*"15 1 \* \* \*"/);
  assert.match(workflow, /cron:\s*"15 13 \* \* \*"/);
  assert.match(workflow, /github\.event_name == 'schedule'/);
  assert.match(workflow, /github\.event\.schedule == '15 1 \* \* \*'/);
  assert.match(workflow, /MODE:.*research/);
  assert.match(routing, /GITHUB_ACTIONS_RESEARCH_AUTOMATION_ENABLED = true/);
  assert.match(routing, /PRODUCTION_RESEARCH_AUTOMATION_PAUSED = true/);
});

test("reader and research fallbacks no longer frame the completed September FOMC as unresolved", () => {
  assert.doesNotMatch(workspace, /keep a September hike credible/i);
  assert.doesNotMatch(workspace, /September hike risk survives/i);
  assert.match(workspace, /October Fed hike risk after September/);
  assert.match(workspace, /3\.75%-4\.00% on 16 September/);

  assert.doesNotMatch(calendar, /changed the September policy path/i);
  assert.match(calendar, /October meeting after September’s 25bp increase/);

  assert.doesNotMatch(researchState, /September Fed policy pricing/i);
  assert.match(researchState, /Next-meeting Fed policy pricing/);
});
