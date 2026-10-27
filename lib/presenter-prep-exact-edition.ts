/**
 * Presenter-only exact source selection. Latest-24 remains the lightweight
 * default picker; explicit UUIDs read one immutable archive row plus a bounded
 * successor probe, so a valid old edition is not rejected merely for its age.
 *
 * The canonical Journey's edition selector and immutable archive are unchanged.
 */
import type { EditionSnapshot } from "./edition-replay.ts";
import { buildPresenterPrepEditionIndex } from "./presenter-prep-edition-index.ts";

type Runs = Parameters<typeof buildPresenterPrepEditionIndex>[1];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolvePresenterPrepExactSelection(input: {
  recent: EditionSnapshot[];
  requestedEditionId: string | null;
  exactEdition: EditionSnapshot | null;
  directSuperseders: EditionSnapshot[] | null;
  researchRuns?: Runs;
}) {
  const currentIndex = buildPresenterPrepEditionIndex(input.recent, input.researchRuns);
  const current = currentIndex[0] ?? null;
  if (input.requestedEditionId === null) {
    return {
      current,
      selected: current,
      selectedSnapshot: current
        ? input.recent.find(item => item.id === current.snapshotId) ?? null : null,
      status: "current" as const,
    };
  }

  const requested = input.requestedEditionId;
  const invalid = () => ({
    current,
    selected: null,
    selectedSnapshot: null,
    status: "invalid_fallback_current" as const,
  });
  if (!UUID.test(requested)
    || !input.exactEdition
    || input.exactEdition.id !== requested
    || input.exactEdition.snapshot_type !== "daily_brief"
    || input.directSuperseders === null
    || input.directSuperseders.some(row =>
      row.snapshot_type !== "daily_brief" || row.supersedes_snapshot_id !== requested)) {
    return invalid();
  }

  // Source identity, not the current live Story state, decides replayability.
  // The existing Presenter retry/cross-slot selector rejects superseded
  // same-slot rows but retains separately published morning/evening slots.
  const byId = new Map(
    [...input.recent, ...input.directSuperseders, input.exactEdition]
      .map(row => [row.id, row] as const),
  );
  const candidates = [...byId.values()];
  const index = buildPresenterPrepEditionIndex(candidates, input.researchRuns);
  const selected = index.find(item => item.snapshotId === requested) ?? null;
  if (!selected) return invalid();
  const selectedSnapshot = byId.get(selected.snapshotId) ?? null;
  if (!selectedSnapshot) return invalid();

  return {
    current,
    selected,
    selectedSnapshot,
    status: selected.snapshotId === current?.snapshotId ? "current" as const : "historical" as const,
  };
}
