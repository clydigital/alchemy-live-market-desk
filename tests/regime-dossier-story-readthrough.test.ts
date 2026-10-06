import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Regime LIVE preserves Story-routed Dossier judgement as read-through only", () => {
  const page = readFileSync(
    new URL("../app/regimes/[slug]/page.tsx", import.meta.url),
    "utf8",
  );
  const workspace = readFileSync(
    new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const regimes = readFileSync(
    new URL("../lib/regimes.ts", import.meta.url),
    "utf8",
  );

  assert.match(page, /motionAdjudicationContext/);
  assert.match(page, /item\.regimeSlug === regime\.slug && !item\.directRegimeRoute/);
  assert.match(page, /dossierReadThrough=\{dossierReadThrough\}/);

  assert.match(workspace, /STORY-ROUTED READ-THROUGH/);
  assert.match(workspace, /excluded from Regime projection/);
  assert.match(workspace, /route to[\s\S]*a Story rather than directly to this Regime/);
  assert.match(workspace, /do not change Regime state, confidence, as-of/);
  assert.match(workspace, /canonical evidence ref/);
  assert.match(workspace, /Open exact Hybrid judgement/);
  assert.match(workspace, /#dossier-story-readthrough/);
  assert.doesNotMatch(workspace, /motion=\$\{encodeURIComponent\(item\.motionId\)\}#presenter-reasoning/);
  assert.match(workspace, /id="dossier-story-readthrough"/);
  assert.match(workspace, /id="dossier-regime-context"/);
  assert.match(workspace, /dossier-story-readthrough-\$\{item\.motionId\}/);
  assert.match(workspace, /dossier-regime-context-\$\{node\.motionId\}/);
  assert.match(regimes, /motionId: item\.motionId/);

  assert.match(regimes, /dossier\.motionRegimeContext/);
  assert.doesNotMatch(regimes, /motionAdjudicationContext/);
  assert.doesNotMatch(
    [page, workspace].join("\n"),
    /story_thesis_versions.*insert|market_regime_story_links.*insert|market_regime_projection_runs.*insert/i,
  );
});
