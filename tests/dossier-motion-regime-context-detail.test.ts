import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync(
  new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url),
  "utf8",
);

test("C1.5b2 Regime LIVE detail renders Dossier System 2 context as non-state", () => {
  assert.match(detail, /const dossierContext = regime\.dossierContext \?\? \[\]/);
  assert.match(detail, /SYSTEM 2 · DOSSIER CONTEXT/);
  assert.match(detail, /Non-state · cannot change Regime state by itself/);
  assert.match(detail, /durable Stories and System 1 telemetry still determine the structural state/);
  assert.match(detail, /dossierContext\.map/);
  assert.match(detail, /Non-state Regime context/);
});

test("C1.5b2 context links to Hybrid without gaining mutation authority", () => {
  assert.match(detail, /Link href=\{node\.hybridHref\}>Explain in Hybrid →<\/Link>/);
  assert.doesNotMatch(
    detail,
    /persistRegime|persistCanonicalStoryReasoning|apply_intelligence_story_assessment|supabase\.rpc/,
  );
});
