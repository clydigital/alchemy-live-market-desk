import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { DossierPresentationSelection } from "../lib/dossier-v2/presentation-reader.ts";
import {
  buildPresenterDossierEditionContext,
  presenterDossierEditionSourceRef,
  PRESENTER_DOSSIER_EDITION_CONTEXT_VERSION,
} from "../lib/presenter-dossier-edition-context.ts";

function selection(
  overrides: Partial<DossierPresentationSelection> = {},
): DossierPresentationSelection {
  return {
    status: "current",
    presentation: null,
    latestDossierId: "11111111-1111-4111-8111-111111111111",
    selectedDossierId: "11111111-1111-4111-8111-111111111111",
    latestAsOf: "2026-10-05T03:00:00.000Z",
    selectedAsOf: "2026-10-05T03:00:00.000Z",
    usingFallback: false,
    calibrationHistory: [],
    calibrationLineages: [],
    notice: {
      tone: "ready",
      label: "Current Dossier",
      detail: "Showing the latest healthy persisted Dossier V2.",
    },
    ...overrides,
  };
}

test("P1.5 freezes exact selected Dossier identity and presentation-selection state", () => {
  const context = buildPresenterDossierEditionContext(
    selection(),
    "2026-10-05T03:05:00.000Z",
  );

  assert.equal(context.contractVersion, PRESENTER_DOSSIER_EDITION_CONTEXT_VERSION);
  assert.equal(context.status, "BOUND");
  assert.equal(context.dossierId, "11111111-1111-4111-8111-111111111111");
  assert.equal(context.dossierAsOf, "2026-10-05T03:00:00.000Z");
  assert.equal(context.latestDossierId, context.dossierId);
  assert.equal(context.latestAsOf, context.dossierAsOf);
  assert.equal(context.selectionStatus, "current");
  assert.equal(context.usingFallback, false);
  assert.equal(context.capturedAt, "2026-10-05T03:05:00.000Z");
});

test("P1.5 preserves exact prior-healthy fallback identity rather than latest degraded identity", () => {
  const context = buildPresenterDossierEditionContext(
    selection({
      status: "fallback_previous_healthy",
      latestDossierId: "22222222-2222-4222-8222-222222222222",
      latestAsOf: "2026-10-05T03:02:00.000Z",
      selectedDossierId: "11111111-1111-4111-8111-111111111111",
      selectedAsOf: "2026-10-05T03:00:00.000Z",
      usingFallback: true,
    }),
    "2026-10-05T03:05:00.000Z",
  );

  assert.equal(context.status, "BOUND");
  assert.equal(context.selectionStatus, "fallback_previous_healthy");
  assert.equal(context.usingFallback, true);
  assert.equal(context.latestDossierId, "22222222-2222-4222-8222-222222222222");
  assert.equal(context.dossierId, "11111111-1111-4111-8111-111111111111");
});

test("P1.5 unavailable Dossier capture is explicit and non-blocking", () => {
  const context = buildPresenterDossierEditionContext(
    null,
    "2026-10-05T03:05:00.000Z",
  );

  assert.equal(context.status, "UNAVAILABLE");
  assert.equal(context.dossierId, null);
  assert.equal(context.dossierAsOf, null);
  assert.equal(context.selectionStatus, "unavailable");
  assert.equal(context.usingFallback, false);
  assert.equal(presenterDossierEditionSourceRef(context), null);
});

test("P1.5 immutable source ref points to the exact selected Market Dossier V2 row", () => {
  const context = buildPresenterDossierEditionContext(
    selection({
      status: "fallback_previous_healthy",
      usingFallback: true,
    }),
    "2026-10-05T03:05:00.000Z",
  );

  assert.deepEqual(presenterDossierEditionSourceRef(context), {
    type: "market_dossier_v2",
    id: "11111111-1111-4111-8111-111111111111",
    asOf: "2026-10-05T03:00:00.000Z",
    selectionStatus: "fallback_previous_healthy",
    usingFallback: true,
  });
});

test("P1.5 capture uses the same Dossier presentation selector as Hybrid and fails to UNAVAILABLE rather than guessing", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const capture = fs.readFileSync(
    path.join(root, "lib", "presenter-dossier-edition-capture.ts"),
    "utf8",
  );

  assert.match(capture, /getDossierV2PresentationSelection\(\)/);
  assert.match(capture, /\.catch\(\(\) => null\)/);
  assert.match(capture, /buildPresenterDossierEditionContext\(selection, capturedAt\)/);
  assert.doesNotMatch(capture, /getDossierV2PresentationSelectionById/);
  assert.doesNotMatch(capture, /Date\.parse|nearest|closest/i);
});

test("P1.5 both canonical base-edition writers persist Presenter Dossier identity and source ref", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const writers = [
    ["lib", "intelligence", "runtime.ts"],
    ["lib", "intelligence", "canonical-journey-edition.ts"],
  ].map((segments) => ({
    name: segments.join("/"),
    source: fs.readFileSync(path.join(root, ...segments), "utf8"),
  }));

  for (const writer of writers) {
    assert.match(writer.source, /capturePresenterDossierEditionContext\(generatedAt\)/, writer.name);
    assert.match(writer.source, /presenterDossierEditionSourceRef\(presenterDossierContext\)/, writer.name);
    assert.match(writer.source, /payload:[\s\S]*presenterDossierContext/, writer.name);
    assert.match(
      writer.source,
      /source_record_refs:[\s\S]*presenterDossierSourceRef \? \[presenterDossierSourceRef\] : \[\]/,
      writer.name,
    );
  }
});

test("P1.5 runtime normal and explicit canonical publication paths both freeze the identity", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");

  const explicitStart = runtime.indexOf("export async function persistCanonicalEditionForResearchRun");
  const dailyStart = runtime.indexOf("async function persistDailyBrief", explicitStart);
  const engineStart = runtime.indexOf("function recruitmentRunMetadata", dailyStart);

  assert.notEqual(explicitStart, -1);
  assert.ok(dailyStart > explicitStart);
  assert.ok(engineStart > dailyStart);

  const explicit = runtime.slice(explicitStart, dailyStart);
  const daily = runtime.slice(dailyStart, engineStart);

  for (const section of [explicit, daily]) {
    assert.match(section, /capturePresenterDossierEditionContext\(generatedAt\)/);
    assert.match(section, /presenterDossierContext/);
    assert.match(section, /presenterDossierSourceRef/);
  }
});

test("P1.5 composed Journey editions inherit frozen Dossier identity from immutable base edition", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const writer = fs.readFileSync(
    path.join(root, "lib", "intelligence", "canonical-journey-edition.ts"),
    "utf8",
  );

  const start = writer.indexOf("export async function composeCanonicalDossierEditionForResearchRun");
  assert.notEqual(start, -1);
  const section = writer.slice(start);

  assert.match(section, /const payload = \{\s*\.\.\.base\.payload,/);
  assert.match(section, /source_record_refs: Array\.isArray\(base\.source_record_refs\) \? base\.source_record_refs : \[\]/);
  assert.doesNotMatch(section, /capturePresenterDossierEditionContext/);
});

test("P1.5 does not yet enable historical Dossier replay", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const boundary = fs.readFileSync(
    path.join(root, "lib", "presenter-historical-context-boundary.ts"),
    "utf8",
  );
  const page = fs.readFileSync(
    path.join(root, "app", "hybrid-output", "page.tsx"),
    "utf8",
  );

  assert.match(boundary, /historicalDossierReplayAvailable: false/);
  assert.doesNotMatch(page, /getDossierV2PresentationSelectionById/);
  assert.doesNotMatch(page, /presenterDossierContext.*getDossierV2PresentationSelectionById/);
});
