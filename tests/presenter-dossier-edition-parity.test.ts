import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { reconcilePresenterDossierEdition } from "../lib/presenter-dossier-edition-parity.ts";

const OLD = "711e90f2-ba74-4da7-9d88-c836ff4e184d";
const NEW = "8af1f9f7-1552-41cf-85a9-d8667c8311e8";
const OLD_AS_OF = "2026-10-10T08:42:00.746+00:00";
const NEW_AS_OF = "2026-10-10T18:51:09.076+00:00";

function edition(
  frozenId = OLD,
  frozenAsOf = OLD_AS_OF,
) {
  return {
    id: "88008ef8-c439-4aa3-9c7c-10ba5ced2502",
    published_at: "2026-10-10T16:20:21.263+00:00",
    payload: {
      presenterDossierContext: {
        contractVersion: "presenter-dossier-edition-context/1",
        status: "BOUND",
        dossierId: frozenId,
        dossierAsOf: frozenAsOf,
        latestDossierId: frozenId,
        latestAsOf: frozenAsOf,
        selectionStatus: "degraded_latest",
        usingFallback: false,
        capturedAt: "2026-10-10T16:20:21.263Z",
      },
      canonicalStoryManifest: [], // valid zero-change brief; no Story fabrication
    },
    source_record_refs: [{
      type: "market_dossier_v2",
      id: frozenId,
      asOf: frozenAsOf,
      selectionStatus: "degraded_latest",
      usingFallback: false,
    }],
  };
}
function selection(id: string = OLD, asOf: string = OLD_AS_OF, status: "current" | "degraded_latest" | "fallback_previous_healthy" = "degraded_latest") {
  return { selectedDossierId: id, selectedAsOf: asOf, status };
}

test("Partition B: frozen exact Dossier and source reference match; degraded status remains explicit", () => {
  const parity = reconcilePresenterDossierEdition({ selection: selection(), edition: edition() });
  assert.equal(parity.contractVersion, "presenter-dossier-edition-parity/1");
  assert.equal(parity.status, "SAME");
  assert.equal(parity.reason, "MATCHED");
  assert.equal(parity.dossierHealth, "DEGRADED_LATEST");
  assert.equal(parity.frozenDossierId, OLD);
  assert.equal(parity.currentDossierId, OLD);
});

test("Partition B: actual 10 Oct incident is OUT_OF_SYNC, not current Dossier provenance", () => {
  const parity = reconcilePresenterDossierEdition({
    selection: selection(NEW, NEW_AS_OF, "current"),
    edition: edition(),
  });
  assert.equal(parity.status, "OUT_OF_SYNC");
  assert.equal(parity.reason, "DOSSIER_CHANGED_AFTER_EDITION");
  assert.equal(parity.dossierHealth, "HEALTHY");
  assert.equal(parity.frozenDossierId, OLD);
  assert.equal(parity.currentDossierId, NEW);
  assert.equal(parity.editionId, "88008ef8-c439-4aa3-9c7c-10ba5ced2502");
});

test("Partition B: ISO timezone variation is same observation time, not false mismatch", () => {
  const parity = reconcilePresenterDossierEdition({
    selection: selection(OLD, "2026-10-10T08:42:00.746Z", "current"),
    edition: edition(),
  });
  assert.equal(parity.status, "SAME");
});

test("Partition B: damaged source refs, absent context and changed as-of fail closed", () => {
  const brokenRef = edition();
  brokenRef.source_record_refs[0]!.id = NEW;
  let result = reconcilePresenterDossierEdition({ selection: selection(), edition: brokenRef });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.reason, "UNVERIFIED_DOSSIER_SOURCE_REF");

  const noContext = edition();
  noContext.payload.presenterDossierContext.contractVersion = "old-or-invented";
  result = reconcilePresenterDossierEdition({ selection: selection(), edition: noContext });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.reason, "NO_VALID_FROZEN_DOSSIER_CONTEXT");

  result = reconcilePresenterDossierEdition({ selection: selection(), edition: null });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.reason, "NO_TERMINAL_EDITION");

  result = reconcilePresenterDossierEdition({
    selection: { selectedDossierId: null, selectedAsOf: null, status: "unavailable" },
    edition: edition(),
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.reason, "NO_CURRENT_DOSSIER");

  result = reconcilePresenterDossierEdition({
    selection: selection(OLD, "2026-10-10T08:43:00.746Z", "current"),
    edition: edition(),
  });
  assert.equal(result.status, "OUT_OF_SYNC");
});

test("Partition B: no silent backfill, immutable manifest remains empty, and presenter actually loads source refs", () => {
  const source = readFileSync(new URL("../lib/presenter-dossier-edition-parity.ts", import.meta.url), "utf8");
  const publicReader = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  assert.match(source, /presenterDossierEditionContextFromPayload/);
  assert.match(source, /source_record_refs/);
  assert.match(publicReader, /select=id,research_run_id,supersedes_snapshot_id,snapshot_type,payload,source_record_refs,published_at/);
  assert.match(page, /reconcilePresenterDossierEdition\(/);
  assert.match(page, /edition: currentEdition/);
  assert.match(page, /OUT_OF_SYNC/);
  assert.match(page, /never silently copied into an old edition/i);
  assert.equal(source.includes(".from("), false);
  assert.doesNotMatch(source, /persistCanonical|story_thesis_versions|supabase/i);
  assert.equal(edition().payload.canonicalStoryManifest.length, 0);
});
