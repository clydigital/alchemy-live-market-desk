import test from "node:test";
import assert from "node:assert/strict";

import { resolvePresenterPrepExactSelection } from "../lib/presenter-prep-exact-edition.ts";
import { buildPresenterPrepSourceProjection } from "../lib/presenter-prep-source-projection.ts";
import type { EditionSnapshot } from "../lib/edition-replay.ts";

const DOSSIER_ID = "bd4979a1-4b34-45e0-9252-a92e5ee6db6a";
const DOSSIER_AS_OF = "2026-10-23T08:00:00.000Z";
const OLD_ID = "00000000-0000-4000-8000-000000000001";
const CURRENT_ID = "00000000-0000-4000-8000-000000000002";

function publishedEdition(id: string, day: number): EditionSnapshot {
  const scheduledFor = `2026-10-${day}T08:00:00.000Z`;
  return {
    id,
    snapshot_type: "daily_brief",
    research_run_id: id,
    published_at: `2026-10-${day}T08:30:00.000Z`,
    supersedes_snapshot_id: null,
    payload: {
      scheduleSlot: "morning",
      scheduledFor,
      presenterDossierContext: {
        contractVersion: "presenter-dossier-edition-context/1",
        status: "BOUND",
        dossierId: DOSSIER_ID,
        dossierAsOf: DOSSIER_AS_OF,
      },
    },
  };
}

test("explicit UUID for latest edition is CURRENT, with exact evidence identity intact", () => {
  const previous = publishedEdition(OLD_ID, 22);
  const latest = publishedEdition(CURRENT_ID, 23);
  const selection = resolvePresenterPrepExactSelection({
    recent: [latest, previous],
    requestedEditionId: latest.id,
    exactEdition: latest,
    directSuperseders: [],
  });

  assert.equal(selection.status, "current");
  assert.equal(selection.current?.snapshotId, latest.id);
  assert.equal(selection.selected?.snapshotId, latest.id);
  assert.equal(selection.selectedSnapshot?.id, latest.id);

  const projection = buildPresenterPrepSourceProjection({
    requestedEditionId: latest.id,
    selectedEditionId: selection.selected?.snapshotId ?? null,
    currentEditionId: selection.current?.snapshotId ?? null,
    editionSelectionStatus: selection.status,
    selectedEdition: selection.selectedSnapshot
      ? {
          id: selection.selectedSnapshot.id,
          publishedAt: selection.selectedSnapshot.published_at,
          payload: selection.selectedSnapshot.payload,
        }
      : null,
    exactDossier: { id: DOSSIER_ID, asOf: DOSSIER_AS_OF },
  });

  assert.equal(projection.status, "READY");
  assert.equal(projection.scope, "CURRENT");
  assert.equal(projection.pinned?.editionId, latest.id);
  assert.equal(projection.pinned?.dossierId, DOSSIER_ID);
  assert.notEqual(projection.reason, "EDITION_SCOPE_MISMATCH");
});

test("different older exact UUID remains HISTORICAL, and unknown UUID fails closed", () => {
  const previous = publishedEdition(OLD_ID, 22);
  const latest = publishedEdition(CURRENT_ID, 23);
  const selected = resolvePresenterPrepExactSelection({
    recent: [latest, previous],
    requestedEditionId: previous.id,
    exactEdition: previous,
    directSuperseders: [],
  });
  assert.equal(selected.status, "historical");
  assert.equal(selected.selectedSnapshot?.id, previous.id);

  const unknown = resolvePresenterPrepExactSelection({
    recent: [latest, previous],
    requestedEditionId: "00000000-0000-4000-8000-000000000003",
    exactEdition: null,
    directSuperseders: [],
  });
  assert.equal(unknown.status, "invalid_fallback_current");
  assert.equal(unknown.selectedSnapshot, null);
});
