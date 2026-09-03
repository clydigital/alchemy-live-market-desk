export type EditionSnapshot = {
  id: string;
  research_run_id: string | null;
  story_id?: string | null;
  supersedes_snapshot_id: string | null;
  snapshot_type: string;
  payload: Record<string, unknown>;
  published_at: string;
};

type ResearchRunIdentity = {
  id: string;
  run_key?: string | null;
  schedule_slot?: string | null;
  scheduled_for?: string | null;
};

export type CanonicalEditionIndexEntry = {
  snapshotId: string;
  publishedAt: string;
  slot: string | null;
  scheduledFor: string | null;
  researchRunId: string | null;
  runKey: string | null;
  supersedesSnapshotId: string | null;
  freshness: "current" | "historical";
  immutable: true;
};

export type HistoricalEditionReplay = {
  storyStates: Array<Record<string, unknown>>;
  featuredStoryStates: Array<Record<string, unknown>>;
  limitation: string | null;
};

export function selectCanonicalEdition(index: CanonicalEditionIndexEntry[], requestedSnapshotId: string | null) {
  const current = index[0] || null;
  const selected = requestedSnapshotId ? index.find((edition) => edition.snapshotId === requestedSnapshotId) || current : current;
  return {
    current,
    selected,
    status: requestedSnapshotId
      ? selected && selected.snapshotId === requestedSnapshotId ? "historical" : "invalid_fallback_current"
      : "current",
  } as const;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function payloadString(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] : null;
}

/**
 * An edition is a terminal daily_brief snapshot. Retry rows remain immutable in
 * storage, but are intentionally excluded from the public edition index.
 */
export function buildCanonicalEditionIndex(
  snapshots: EditionSnapshot[],
  researchRuns: ResearchRunIdentity[] = [],
): CanonicalEditionIndexEntry[] {
  const dailyBriefs = snapshots.filter((snapshot) => snapshot.snapshot_type === "daily_brief");
  const supersededIds = new Set(dailyBriefs.flatMap((snapshot) => (
    snapshot.supersedes_snapshot_id ? [snapshot.supersedes_snapshot_id] : []
  )));
  const runById = new Map(researchRuns.map((run) => [run.id, run]));
  const terminal = dailyBriefs
    .filter((snapshot) => !supersededIds.has(snapshot.id))
    .map((snapshot) => {
      const run = snapshot.research_run_id ? runById.get(snapshot.research_run_id) : null;
      const scheduledFor = payloadString(snapshot.payload, "scheduledFor") || run?.scheduled_for || null;
      return {
        snapshot,
        run,
        scheduledFor,
        canonicalOrderAt: scheduledFor && Number.isFinite(Date.parse(scheduledFor)) ? scheduledFor : snapshot.published_at,
      };
    })
    // Canonical schedule identity outranks wall-clock publication time. A late
    // retry of an older slot may supersede its own lineage, but it cannot take
    // the current pointer from a newer completed slot.
    .sort((left, right) => right.canonicalOrderAt.localeCompare(left.canonicalOrderAt)
      || right.snapshot.published_at.localeCompare(left.snapshot.published_at)
      || right.snapshot.id.localeCompare(left.snapshot.id));

  return terminal.map(({ snapshot, run, scheduledFor }, index) => {
    return {
      snapshotId: snapshot.id,
      publishedAt: snapshot.published_at,
      slot: payloadString(snapshot.payload, "scheduleSlot") || run?.schedule_slot || null,
      scheduledFor,
      researchRunId: snapshot.research_run_id,
      runKey: payloadString(snapshot.payload, "runKey") || run?.run_key || null,
      supersedesSnapshotId: snapshot.supersedes_snapshot_id,
      freshness: index === 0 ? "current" : "historical",
      immutable: true,
    };
  });
}

function manifestReplay(payload: Record<string, unknown>): HistoricalEditionReplay | null {
  const manifest = payload.canonicalStoryManifest ?? payload.storyManifest;
  if (!Array.isArray(manifest)) return null;
  const entries = manifest.map(record);
  if (entries.some((entry) => !entry)) {
    return { storyStates: [], featuredStoryStates: [], limitation: "The persisted edition manifest is malformed; no Story state was replayed." };
  }
  const ordered = (entries as Record<string, unknown>[])
    .map((entry, index) => ({ entry, index, position: typeof entry.position === "number" ? entry.position : index + 1 }))
    .sort((left, right) => left.position - right.position || left.index - right.index);
  const storyStates = ordered.map(({ entry }) => {
    const state = record(entry.state);
    return state ? { ...state } : null;
  });
  if (storyStates.some((state) => !state)) {
    return { storyStates: [], featuredStoryStates: [], limitation: "The persisted edition manifest has no complete immutable Story presentation state." };
  }
  const exactStates = storyStates as Array<Record<string, unknown>>;
  return {
    storyStates: exactStates,
    featuredStoryStates: exactStates.filter((state) => state.featuredRank !== null && state.featuredRank !== undefined),
    limitation: null,
  };
}

/**
 * Legacy daily briefs can be replayed only when their persisted ordered IDs can
 * be resolved against immutable Story snapshots from the same research run.
 * This deliberately never consults the current stories table.
 */
function legacyReplay(snapshot: EditionSnapshot, snapshots: EditionSnapshot[]): HistoricalEditionReplay {
  const canonicalStoryIds = stringArray(snapshot.payload.canonicalStoryIds);
  if (!canonicalStoryIds) {
    return {
      storyStates: [],
      featuredStoryStates: [],
      limitation: "Legacy edition: immutable Story membership and order were not persisted, so Story state cannot be replayed exactly.",
    };
  }
  if (!snapshot.research_run_id) {
    return {
      storyStates: [],
      featuredStoryStates: [],
      limitation: "Legacy edition: canonicalStoryIds exist but no persisted research-run identity proves the matching immutable Story snapshots.",
    };
  }
  const statesByStoryId = new Map(
    snapshots
      .filter((candidate) => candidate.snapshot_type === "story" && candidate.research_run_id === snapshot.research_run_id)
      .flatMap((candidate): Array<readonly [string, Record<string, unknown>]> => {
        const state = record(candidate.payload.canonicalStoryState) || record(candidate.payload);
        const storyId = candidate.story_id || payloadString(candidate.payload, "storyId") || payloadString(candidate.payload, "id");
        return state && storyId ? [[storyId, state]] : [];
      })
      .map(([storyId, state]) => [storyId, state] as const),
  );
  const ordered = canonicalStoryIds.map((storyId) => {
    const state = statesByStoryId.get(storyId);
    return state ? { ...state } : null;
  });
  if (ordered.some((state) => !state)) {
    return {
      storyStates: [],
      featuredStoryStates: [],
      limitation: "Legacy edition: one or more persisted canonicalStoryIds have no matching immutable Story snapshot, so no partial replay was fabricated.",
    };
  }
  const storyStates = ordered as Array<Record<string, unknown>>;
  return {
    storyStates,
    featuredStoryStates: storyStates.filter((state) => state.featuredRank !== null && state.featuredRank !== undefined),
    limitation: null,
  };
}

export function replayImmutableEdition(snapshot: EditionSnapshot, snapshots: EditionSnapshot[]): HistoricalEditionReplay {
  return manifestReplay(snapshot.payload) || legacyReplay(snapshot, snapshots);
}

/**
 * This is the exact Live-to-Hybrid selection envelope. Keep the three
 * publication fields and canonical.snapshotId in lockstep: Hybrid only renders
 * historical state when these pin the requested immutable snapshot.
 */
export function buildCanonicalEditionResponseContract({
  snapshots,
  researchRuns = [],
  editionId = null,
  currentStoryStates,
  currentFeaturedStoryStates,
}: {
  snapshots: EditionSnapshot[];
  researchRuns?: ResearchRunIdentity[];
  editionId?: string | null;
  currentStoryStates: Array<Record<string, unknown>>;
  currentFeaturedStoryStates: Array<Record<string, unknown>>;
}) {
  const terminalIndex = buildCanonicalEditionIndex(snapshots, researchRuns);
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const currentSnapshotId = terminalIndex[0]?.snapshotId || null;
  const replayBySnapshotId = new Map<string, HistoricalEditionReplay>();
  const replayFor = (snapshotId: string) => {
    const cached = replayBySnapshotId.get(snapshotId);
    if (cached) return cached;
    const snapshot = snapshotById.get(snapshotId);
    if (!snapshot) return null;
    const replay = replayImmutableEdition(snapshot, snapshots);
    replayBySnapshotId.set(snapshotId, replay);
    return replay;
  };
  // The current Live edition remains available even if it predates manifests.
  // Older rows belong in the picker only when their own persisted immutable
  // state proves a complete replay.
  const editionIndex = terminalIndex.filter((edition) => (
    edition.snapshotId === currentSnapshotId || !replayFor(edition.snapshotId)?.limitation
  ));
  const selection = selectCanonicalEdition(editionIndex, editionId);
  const requestedEdition = selection.status === "historical" ? selection.selected : null;
  const selectedSnapshot = requestedEdition
    ? snapshots.find((snapshot) => snapshot.id === requestedEdition.snapshotId) || null
    : null;
  const replay = selectedSnapshot ? replayFor(selectedSnapshot.id) : null;
  const isHistoricalReplay = Boolean(selectedSnapshot && replay);
  const requestedSnapshot = editionId ? snapshotById.get(editionId) || null : null;
  const requestedReplay = requestedSnapshot ? replayFor(requestedSnapshot.id) : null;
  const limitation = selection.status === "invalid_fallback_current" && editionId
    ? (requestedSnapshot && !terminalIndex.some((edition) => edition.snapshotId === requestedSnapshot.id)
      ? "Requested edition is superseded and is not selectable."
      : requestedReplay?.limitation || (requestedSnapshot
        ? "Requested edition is not selectable from the canonical archive."
        : "Requested edition was not found in the canonical archive."))
    : replay?.limitation || null;
  const selectedEdition = selection.selected ? { ...selection.selected, status: selection.status } : null;

  return {
    publication: {
      currentEdition: selection.current,
      selectedEdition,
      editionIndex,
    },
    canonical: {
      snapshotId: selectedEdition?.snapshotId || null,
      storyStates: isHistoricalReplay ? replay!.storyStates : currentStoryStates,
      featuredStoryStates: isHistoricalReplay ? replay!.featuredStoryStates : currentFeaturedStoryStates,
    },
    selectedSnapshot,
    replay,
    isHistoricalReplay,
    selection,
    diagnostic: {
      requestedSnapshotId: editionId,
      status: selection.status,
      limitation,
    },
  };
}
