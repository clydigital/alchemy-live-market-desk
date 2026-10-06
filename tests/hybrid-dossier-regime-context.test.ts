import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../app/hybrid-output/page.tsx", import.meta.url),
  "utf8",
);

test("C1.5c1 Hybrid resolves exact immutable Dossier Regime context by Motion ID", () => {
  assert.match(
    page,
    /const motionRegimeContext =[\s\S]*presenterDossier\.motionRegimeContext/,
  );
  assert.match(
    page,
    /const motionRegimeContextById = new Map[\s\S]*item\.motionId/,
  );
  assert.match(
    page,
    /const focusedDossierRegimeContext = motionId[\s\S]*motionRegimeContextById\.get\(motionId\)/,
  );
  assert.match(
    page,
    /presenterEditionStatus === "historical"[\s\S]*presenterHistoricalDossierReplay\?\.status !== "BOUND"/,
  );
  assert.match(page, /title="Dossier System 2 Regime context"/);
  assert.match(page, /id="dossier-regime-context"/);
  assert.match(page, /focusedDossierRegimeContext\.conclusion/);
  assert.match(page, /focusedDossierRegimeContext\.rationale/);
  assert.match(page, /focusedDossierRegimeContext\.nextTest/);
  assert.match(page, /focusedDossierRegimeContext\.canonicalEvidenceRefs\.length/);
});

test("C1.5c1 keeps Dossier judgement authoritative and raw Motion discovery-only", () => {
  assert.match(page, /This is analytical context only; it does not change Regime state by itself/);
  assert.match(
    page,
    /The original Motion remains discovery context and cannot become Regime state or evidence by itself/,
  );
  assert.match(
    page,
    /The raw discovery Motion is no longer in the selected Motion context\. The immutable Dossier System 2 judgement above remains the authoritative explanation/,
  );
});

test("C1.5c1 preserves exact Regime routing without fuzzy recovery", () => {
  assert.match(
    page,
    /href=\{\`\/regimes\/\$\{focusedDossierRegimeContext\.regimeSlug\}\?view=live#dossier-regime-context\`\}/,
  );
  assert.doesNotMatch(
    page,
    /focusedDossierRegimeContext[\s\S]{0,240}(similarity|fuzzy|headline match|semantic)/i,
  );
});
