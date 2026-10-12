import assert from "node:assert/strict";
import test from "node:test";

import { assessHybridEditionRequest } from "../lib/hybrid-edition-request-guard.ts";

const current = {
  selectedEditionId: "edition-current",
  currentEditionId: "edition-current",
  selectorFellBack: false,
  exactHistoricalDossierBound: false,
};

test("Hybrid current URL remains unchanged without an edition parameter", () => {
  assert.equal(assessHybridEditionRequest({ ...current, requestedParam: undefined }), "CURRENT");
  assert.equal(assessHybridEditionRequest({ ...current, requestedParam: "edition-current" }), "CURRENT");
});

test("Hybrid never silently displays current when an explicit edition is invalid", () => {
  for (const requestedParam of ["missing-edition", "", " ", ["edition-current", "missing-edition"]]) {
    assert.equal(assessHybridEditionRequest({ ...current, requestedParam, selectorFellBack: true }), "INVALID_REQUEST");
  }
  assert.equal(assessHybridEditionRequest({ ...current, requestedParam: "missing-edition" }), "INVALID_REQUEST");
});

test("valid historical edition requires a bound, exact frozen Dossier", () => {
  const historical = {
    selectedEditionId: "edition-old",
    currentEditionId: "edition-current",
    requestedParam: "edition-old",
    selectorFellBack: false,
  };
  assert.equal(assessHybridEditionRequest({ ...historical, exactHistoricalDossierBound: false }), "HISTORICAL_DOSSIER_UNAVAILABLE");
  assert.equal(assessHybridEditionRequest({ ...historical, exactHistoricalDossierBound: true }), "HISTORICAL_READY");
});

test("a missing current index must not promote an explicit request to history", () => {
  assert.equal(assessHybridEditionRequest({
    selectedEditionId: null,
    currentEditionId: null,
    requestedParam: "edition-old",
    selectorFellBack: true,
    exactHistoricalDossierBound: false,
  }), "INVALID_REQUEST");
});

import { selectHybridEditionForRequest } from "../lib/hybrid-edition-request-guard.ts";
import type { EditionSnapshot } from "../lib/edition-replay.ts";
import { readFileSync } from "node:fs";

function snapshot(id: string, publishedAt: string, slot: string, supersedes: string | null = null, runId = "run-" + id): EditionSnapshot {
  return {
    id, published_at: publishedAt, research_run_id: runId,
    supersedes_snapshot_id: supersedes, snapshot_type: "daily_brief",
    payload: { scheduleSlot: slot, scheduledFor: publishedAt },
  };
}

test("Journey explicitly opens a cross-slot historical edition pinned by Presenter Prep", () => {
  const morning = snapshot("morning", "2026-10-11T01:30:00Z", "morning");
  const evening = snapshot("evening", "2026-10-11T13:30:00Z", "evening", "morning");
  const followingMorning = snapshot("following-morning", "2026-10-12T01:30:00Z", "morning", "evening");
  const editions = [morning, evening, followingMorning];
  const selected = selectHybridEditionForRequest(editions, [], "morning");
  assert.equal(selected.status, "historical");
  assert.equal(selected.selected?.snapshotId, "morning");
  assert.equal(selected.current?.snapshotId, "following-morning");
  assert.equal(selectHybridEditionForRequest(editions, [], null).selected?.snapshotId, "following-morning");
});

test("Journey keeps same-slot retries, unknown IDs and malformed requests fail-closed", () => {
  const previous = snapshot("old", "2026-10-11T13:30:00Z", "evening");
  const retry = snapshot("retry", "2026-10-11T13:45:00Z", "evening", "old");
  const editions = [previous, retry];
  for (const id of ["old", "nonexistent"]) {
    const read = selectHybridEditionForRequest(editions, [], id);
    assert.equal(read.status, "invalid_fallback_current");
    assert.equal(assessHybridEditionRequest({
      requestedParam: id,
      selectedEditionId: read.selected?.snapshotId ?? null,
      currentEditionId: read.current?.snapshotId ?? null,
      selectorFellBack: read.status === "invalid_fallback_current",
      exactHistoricalDossierBound: true,
    }), "INVALID_REQUEST");
  }
});

test("Hybrid route uses explicit-only archive lookup and exact historical Dossier guard", () => {
  const source = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  assert.match(source, /selectHybridEditionForRequest\(\s*presenterEditions,\s*data\.researchRuns,\s*requestedEditionId/);
  assert.match(source, /presenterHistoricalDossierReplay\?\.status === "BOUND"/);
  assert.match(source, /assessHybridEditionRequest\(/);
  assert.match(source, /HISTORICAL_DOSSIER_UNAVAILABLE/);
  assert.match(source, /No current analysis has been substituted/);
});

test("historical Journey binds every downstream research panel to frozen Dossier and edition", () => {
  const source = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const selection = editionRequestState === "HISTORICAL_READY"\s*\? presenterHistoricalDossierReplay!\.selection!/);
  assert.match(source, /const dossier = selection\.presentation;/);
  assert.match(source, /const presentedEdition = editionRequestState === "HISTORICAL_READY"\s*\? selectedPresenterEdition\s*: currentEdition;/);
  assert.match(source, /edition: presentedEdition,/);
  assert.match(source, /currentUpcoming\(presentedEdition\?\.payload\.upcoming\)/);
  assert.match(source, /loadHybridResearchGapStatus\(selection\.selectedDossierId\)/);
  assert.match(source, /loadRegimeAssumptionObservationReport\(\s*selection\.selectedDossierId,/);
});
