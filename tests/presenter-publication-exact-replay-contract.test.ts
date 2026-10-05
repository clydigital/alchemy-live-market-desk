import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("Presenter publication freezes hydrated reasoning from the exact thesis version", () => {
  const publication = fs.readFileSync(path.join(root, "lib", "hybrid-publication.ts"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
  const canonical = fs.readFileSync(path.join(root, "lib", "intelligence", "canonical-journey-edition.ts"), "utf8");

  assert.match(publication, /materialiseCanonicalStoryReasoningV1/);
  assert.match(publication, /story\.thesisVersion\?\.id === exactVersion\.id/);
  assert.match(publication, /canonicalStoryReasoning/);

  for (const writer of [runtime, canonical]) {
    assert.match(writer, /canonicalStoryState/);
    assert.match(writer, /canonicalStoryReasoning/);
    assert.match(writer, /story\.canonicalStoryReasoning\?\.storyVersionId === thesisVersionId/);
    assert.match(writer, /reasoning,/);
  }
});

test("Presenter publication freezes exact Dossier identity without creating another reasoning writer", () => {
  const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
  const canonical = fs.readFileSync(path.join(root, "lib", "intelligence", "canonical-journey-edition.ts"), "utf8");
  const capture = fs.readFileSync(path.join(root, "lib", "presenter-dossier-edition-capture.ts"), "utf8");
  const combined = [runtime, canonical, capture].join("\n");

  assert.match(runtime, /capturePresenterDossierEditionContext\(generatedAt\)/);
  assert.match(canonical, /capturePresenterDossierEditionContext\(generatedAt\)/);
  assert.match(runtime, /presenterDossierContext/);
  assert.match(canonical, /presenterDossierContext/);
  assert.doesNotMatch(capture, /insert into|create table|story_thesis_versions/i);
  assert.doesNotMatch(combined, /executeDossierStoryCanonicalMutation/);
});

test("historical Presenter replay remains exact-ID only and fails closed for legacy editions", () => {
  const replay = fs.readFileSync(path.join(root, "lib", "presenter-historical-dossier-replay.ts"), "utf8");
  const context = fs.readFileSync(path.join(root, "lib", "presenter-dossier-edition-context.ts"), "utf8");
  const boundary = fs.readFileSync(path.join(root, "lib", "presenter-historical-context-boundary.ts"), "utf8");

  assert.match(replay, /getDossierV2PresentationSelectionById\(context\.dossierId!\)/);
  assert.doesNotMatch(replay, /nearest|closest|Date\.parse/);
  assert.match(context, /presenterDossierEditionContextFromPayload/);
  assert.match(boundary, /HISTORICAL_STORY_REASONING_ONLY/);
  assert.match(boundary, /HISTORICAL_FULL_CASE/);
});
