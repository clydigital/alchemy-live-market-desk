/**
 * Presenter Prep-only edition selection. Do not modify the Journey's legacy
 * replay index: earlier publications sometimes use supersedes_snapshot_id to
 * chain distinct broadcast slots, not only retries of one slot.
 */
import {
  buildCanonicalEditionIndex,
  type EditionSnapshot,
} from "./edition-replay";

type ResearchRun = NonNullable<Parameters<typeof buildCanonicalEditionIndex>[1]>[number];

function value(payload: Record<string, unknown>, field: string): string | null {
  const v = payload[field];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function isSameSlotRetry(
  newer: EditionSnapshot,
  previous: EditionSnapshot,
  runsById: Map<string, ResearchRun>,
): boolean {
  if (newer.research_run_id && newer.research_run_id === previous.research_run_id) return true;
  const newerRun = newer.research_run_id ? runsById.get(newer.research_run_id) : null;
  const previousRun = previous.research_run_id ? runsById.get(previous.research_run_id) : null;
  const newerSlot = value(newer.payload, "scheduleSlot") ?? newerRun?.schedule_slot ?? null;
  const previousSlot = value(previous.payload, "scheduleSlot") ?? previousRun?.schedule_slot ?? null;
  if (newerSlot && previousSlot && newerSlot !== previousSlot) return false;
  const newerAt = value(newer.payload, "scheduledFor") ?? newerRun?.scheduled_for ?? null;
  const previousAt = value(previous.payload, "scheduledFor") ?? previousRun?.scheduled_for ?? null;
  if (newerAt && previousAt) {
    if (newerSlot === "manual" || previousSlot === "manual") return newerAt === previousAt;
    const a = Date.parse(newerAt);
    const b = Date.parse(previousAt);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      if (newerSlot && newerSlot === previousSlot) {
        return new Date(a).toISOString().slice(0, 10)
          === new Date(b).toISOString().slice(0, 10);
      }
      return a === b;
    }
  }
  // Missing publication-clock evidence must not invent a distinct old edition.
  return true;
}

export function buildPresenterPrepEditionIndex(
  snapshots: EditionSnapshot[],
  researchRuns: ResearchRun[] = [],
) {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const runs = new Map(researchRuns.map((run) => [run.id, run]));
  const projectorCopies = snapshots.map((snapshot) => {
    const previous = snapshot.supersedes_snapshot_id
      ? byId.get(snapshot.supersedes_snapshot_id) : null;
    if (!previous || isSameSlotRetry(snapshot, previous, runs)) return snapshot;
    // Remove only the cross-slot supersedes edge in an in-memory copy.
    // Both the frozen source row and the original Journey selector stay untouched.
    return { ...snapshot, supersedes_snapshot_id: null };
  });
  return buildCanonicalEditionIndex(projectorCopies, researchRuns).map((item) => ({
    ...item,
    supersedesSnapshotId: byId.get(item.snapshotId)?.supersedes_snapshot_id ?? null,
  }));
}
