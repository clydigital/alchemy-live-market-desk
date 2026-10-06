import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/regime-shadow/route.ts", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/run-live-research.yml", import.meta.url), "utf8");

test("Regime shadow POST keeps static auth and adds the trusted GitHub Actions OIDC verifier", () => {
  assert.match(route, /acceptsResearchAuthorization/);
  assert.match(route, /process\.env\.RESEARCH_UPDATE_TOKEN/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /verifyGitHubActionsManualLiveTrigger/);
  assert.match(route, /transport: "github-actions-oidc"/);
  assert.match(route, /regime_shadow_manual_projection_authorized/);
  assert.match(route, /trigger: "manual"/);
  assert.match(route, /persistRegimeShadowProjectionSafely/);
});

test("production workflow exposes one bounded Regime shadow projection mode over GitHub OIDC", () => {
  assert.match(workflow, /- regime_shadow/);
  assert.match(workflow, /name: Run Regime shadow projection/);
  assert.match(workflow, /env\.MODE == 'regime_shadow'/);
  assert.match(workflow, /OIDC_AUDIENCE: alchemy-live-market-desk:manual-research/);
  assert.match(workflow, /trigger_ref="github-actions:\$\{GITHUB_RUN_ID\}:\$\{GITHUB_RUN_ATTEMPT\}"/);
  assert.match(workflow, /"\$PROD_URL\/api\/regime-shadow"/);
  assert.match(workflow, /\.enabled == true/);
  assert.match(workflow, /\.runId \| type == "string" and length > 0/);
});
