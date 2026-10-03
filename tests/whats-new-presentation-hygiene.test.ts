import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const page = fs.readFileSync(path.join(process.cwd(), "app/whats-new/page.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(process.cwd(), "components/live-desk/WhatsNewWorkspace.tsx"), "utf8");
const presentation = fs.readFileSync(path.join(process.cwd(), "lib/market-motion-presentation.ts"), "utf8");

test("What’s New sanitises machine event text and assigns age metadata", () => {
  assert.match(page, /readerFacingText\(event\.headline\)/);
  assert.match(page, /presentationAge\(delta\.timestamp, now\)/);
});

test("historical records remain visible but clearly labelled", () => {
  assert.match(workspace, /ageState === "historical"/);
  assert.match(workspace, /Historical context/);
});


test("What’s New bundles exact-video creator Motion before applying the 60-unit presentation ceiling", () => {
  assert.match(page, /buildMarketMotionPresentationUnits\(motionRecords\)/);
  const bundle = page.indexOf("buildMarketMotionPresentationUnits(motionRecords)");
  const ceiling = page.indexOf(".slice(0, 60)");
  assert.ok(bundle >= 0 && ceiling > bundle);
  assert.match(page, /motionBundle:/);
  assert.match(page, /previewClaimIds/);
});

test("creator bundles remain searchable through every underlying claim and preserve exact claim anchors", () => {
  assert.match(workspace, /delta\.motionBundle\?\.children\.flatMap/);
  assert.match(workspace, /child\.whatHappened/);
  assert.match(workspace, /child\.nextTest/);
  assert.match(workspace, /id=\{\`record-\$\{child\.id\}\`\}/);
  assert.match(workspace, /Show all \{delta\.motionBundle\.underlyingCount\} underlying claims/);
  assert.match(workspace, /previewClaimIds\.includes\(child\.id\)/);
});

test("Motion counts distinguish presentation units from underlying creator claims", () => {
  assert.match(workspace, /motionClaimCount/);
  assert.match(workspace, /underlying claim/);
  assert.match(workspace, /presentation unit/);
});

test("presentation bundling stays isolated from canonical Motion and Research Gap plumbing", () => {
  assert.match(presentation, /source_kind !== "creator"/);
  assert.match(presentation, /creator-transcript-motion-lead\/v1/);
  assert.match(presentation, /itemKey/);
  assert.doesNotMatch(presentation, /market-motion-ingestion/);
  assert.doesNotMatch(presentation, /market-motion-promotion/);
  assert.doesNotMatch(presentation, /supabase/);
  assert.doesNotMatch(presentation, /research-gap/);
  assert.doesNotMatch(presentation, /hybrid/);
});
