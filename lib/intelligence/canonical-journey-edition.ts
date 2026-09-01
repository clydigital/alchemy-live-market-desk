import "server-only";

import { getHybridDeskData } from "@/lib/data";
import { getHybridPublicationRecords, selectHybridPublicationStoryStates } from "@/lib/hybrid-publication";
import {
  composePersistedDossierStorylines,
  DOSSIER_STORYLINE_COMPOSITION_V1,
} from "@/lib/intelligence/dossier-storyline-composer";
import { composeAlchemyEdition, type AlchemyEdition } from "@/lib/intelligence/edition";
import { JOURNEY_BRIEFING_V1, type JourneyStorySource } from "@/lib/intelligence/journey-briefing";
import {
  CANONICAL_STORY_REASONING_V1,
  type CanonicalStoryReasoningV1,
} from "@/lib/intelligence/story-reasoning";
import { intelligenceRest } from "@/lib/intelligence/supabase";
import { buildEditionEventHorizon } from "@/lib/market-event-runtime";
import { getStoryHeaderImages } from "@/lib/story-images";

type StorySnapshotRow = {
  id: string;
  story_id: string | null;
  story_thesis_version_id: string | null;
  payload: Record<string, unknown>;
};

type DailyBriefRow = {
  id: string;
  research_run_id: string | null;
  slot_run_id: string | null;
  supersedes_snapshot_id: string | null;
  payload: Record<string, unknown>;
  public_summary: string;
  source_record_refs: Record<string, unknown>[];
  redaction_log?: unknown[];
  confidence: number;
  published_at: string;
};

function asPreviousEdition(payload: Record<string, unknown> | undefined): AlchemyEdition | null {
  return payload?.methodologyVersion === "alchemy-mixed-research-voice-v1"
    ? payload as unknown as AlchemyEdition
    : null;
}

function hasPersistedJourney(payload: Record<string, unknown> | undefined) {
  const journey = payload?.journey;
  return Boolean(
    journey
    && typeof journey === "object"
    && !Array.isArray(journey)
    && (journey as { contractVersion?: unknown }).contractVersion === JOURNEY_BRIEFING_V1,
  );
}

function hasComposedDossier(payload: Record<string, unknown> | undefined) {
  const dossier = payload?.dossier;
  return Boolean(
    dossier
    && typeof dossier === "object"
    && !Array.isArray(dossier)
    && (dossier as { compositionVersion?: unknown }).compositionVersion === DOSSIER_STORYLINE_COMPOSITION_V1,
  );
}

function currentDailyBrief(rows: DailyBriefRow[]) {
  const supersededIds = new Set(rows.flatMap((row) => row.supersedes_snapshot_id ? [row.supersedes_snapshot_id] : []));
  return rows.find((row) => !supersededIds.has(row.id)) || rows[0] || null;
}

async function dailyBriefsForResearchRun(researchRunId: string) {
  return intelligenceRest<DailyBriefRow[]>(
    `hybrid_publication_snapshots?select=*&snapshot_type=eq.daily_brief&research_run_id=eq.${encodeURIComponent(researchRunId)}&order=published_at.desc,id.desc&limit=20`,
  );
}

/**
 * Capture the exact current Story projection before the immutable edition is
 * written. This mirrors the normal runtime publication boundary; no mutable
 * Story state is consulted later during replay.
 */
async function captureCanonicalStoryStates() {
  const [desk, records] = await Promise.all([
    getHybridDeskData({ fresh: true }),
    getHybridPublicationRecords({ fresh: true }),
  ]);
  const storyImages = await getStoryHeaderImages(desk.stories.map((story) => story.id), desk.sources);
  return selectHybridPublicationStoryStates({
    stories: desk.stories,
    records,
    storyImages,
  }).storyStates;
}

async function persistCanonicalStoryManifest({
  researchRunId,
  canonicalStoryStates,
  publishedAt,
}: {
  researchRunId: string;
  canonicalStoryStates: Awaited<ReturnType<typeof captureCanonicalStoryStates>>;
  publishedAt: string;
}) {
  const existingRows = await intelligenceRest<StorySnapshotRow[]>(
    `hybrid_publication_snapshots?select=id,story_id,story_thesis_version_id,payload&snapshot_type=eq.story&research_run_id=eq.${encodeURIComponent(researchRunId)}&order=published_at.asc,id.asc`,
  );
  const existingStoryIds = new Set(existingRows.map((row) => row.story_id).filter(Boolean));
  const missingStates = canonicalStoryStates.filter((story) => !existingStoryIds.has(story.id));
  const insertedRows = missingStates.length
    ? await intelligenceRest<StorySnapshotRow[]>("hybrid_publication_snapshots", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(missingStates.map((story) => ({
          research_run_id: researchRunId,
          slot_run_id: null,
          story_id: story.id,
          story_thesis_version_id: story.thesisVersion?.id || null,
          supersedes_snapshot_id: null,
          snapshot_type: "story",
          public_summary: story.title,
          payload: { canonicalStoryState: story },
          source_record_refs: [],
          redaction_log: [],
          confidence: story.confidence,
          published_at: publishedAt,
        }))),
      })
    : [];

  const snapshotByStoryId = new Map(
    [...existingRows, ...insertedRows]
      .filter((row) => row.story_id)
      .map((row) => [row.story_id as string, row]),
  );

  const persisted = canonicalStoryStates.map((story, index) => {
    const snapshot = snapshotByStoryId.get(story.id);
    if (!snapshot) throw new Error(`Immutable Story snapshot was not persisted for edition Story ${story.id}.`);
    const state = snapshot.payload.canonicalStoryState;
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error(`Immutable Story snapshot state is unavailable for edition Story ${story.id}.`);
    }
    const stateVersionId = story.thesisVersion?.id || null;
    const thesisVersionId = snapshot.story_thesis_version_id;
    if (stateVersionId && thesisVersionId !== stateVersionId) {
      throw new Error(`Immutable Story snapshot thesis version mismatch for edition Story ${story.id}.`);
    }
    const candidateReasoning = snapshot.payload.canonicalStoryReasoning;
    const reasoning = candidateReasoning
      && typeof candidateReasoning === "object"
      && !Array.isArray(candidateReasoning)
      && (candidateReasoning as Partial<CanonicalStoryReasoningV1>).contractVersion === CANONICAL_STORY_REASONING_V1
      && (candidateReasoning as Partial<CanonicalStoryReasoningV1>).storyId === story.id
      && (candidateReasoning as Partial<CanonicalStoryReasoningV1>).storyVersionId === thesisVersionId
      ? candidateReasoning as CanonicalStoryReasoningV1
      : null;

    return {
      manifest: {
        position: index + 1,
        snapshotId: snapshot.id,
        storyId: story.id,
        thesisVersionId,
        state,
      },
      journeySource: reasoning && thesisVersionId ? {
        position: index + 1,
        publicationSnapshotId: snapshot.id,
        storyId: story.id,
        thesisVersionId,
        reasoning,
      } satisfies JourneyStorySource : null,
    };
  });

  return {
    manifest: persisted.map((entry) => entry.manifest),
    journeySources: persisted.flatMap((entry) => entry.journeySource ? [entry.journeySource] : []),
  };
}

/**
 * Ensure every completed research run owns at least one immutable canonical
 * edition. The normal intelligence runtime already persists the base edition
 * when at least one Story changes. The legitimate zero-change case reaches the
 * fallback below and receives the same canonical edition contract.
 */
export async function persistCanonicalJourneyEditionForResearchRun({
  researchRunId,
  runKey,
  publicSummary = null,
}: {
  researchRunId: string;
  runKey: string;
  publicSummary?: string | null;
}) {
  const existingRows = await dailyBriefsForResearchRun(researchRunId);
  const existing = currentDailyBrief(existingRows);
  if (existing) return existing.id;

  const generatedAt = new Date().toISOString();
  const researchRun = (await intelligenceRest<Array<{
    run_key: string;
    schedule_slot: string;
    scheduled_for: string;
  }>>(
    `research_runs?select=run_key,schedule_slot,scheduled_for&id=eq.${encodeURIComponent(researchRunId)}&limit=1`,
  ))[0] || null;

  const canonicalStoryStates = await captureCanonicalStoryStates();
  const { manifest: canonicalStoryManifest, journeySources } = await persistCanonicalStoryManifest({
    researchRunId,
    canonicalStoryStates,
    publishedAt: generatedAt,
  });
  const prior = await intelligenceRest<DailyBriefRow[]>(
    "hybrid_publication_snapshots?select=*&snapshot_type=eq.daily_brief&order=published_at.desc,id.desc&limit=1",
  );
  const previousEdition = asPreviousEdition(prior[0]?.payload);
  // A zero-change edition must not attach current Story IDs to forward events.
  // Event acquisition/coverage is still canonical, but Story linkage remains empty.
  const eventHorizon = await buildEditionEventHorizon([]);

  const edition = composeAlchemyEdition({
    generatedAt,
    comparisonWindowStart: previousEdition?.generatedAt
      || prior[0]?.published_at
      || new Date(Date.parse(generatedAt) - 86_400_000).toISOString(),
    previousEdition,
    stories: [],
    upcoming: eventHorizon.upcoming,
    journeyStorySources: journeySources,
    marketEvents: eventHorizon.events,
    diagnostics: {
      warnings: eventHorizon.warnings,
      eventHorizonCoverage: eventHorizon.coverage,
    },
  });
  if (!hasPersistedJourney(edition as unknown as Record<string, unknown>)) {
    throw new Error("Zero-change canonical edition did not compose journey-briefing/v1.");
  }

  const rows = await intelligenceRest<Array<{ id: string }>>("hybrid_publication_snapshots", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      research_run_id: researchRunId,
      slot_run_id: null,
      story_id: null,
      story_thesis_version_id: null,
      supersedes_snapshot_id: prior[0]?.id || null,
      snapshot_type: "daily_brief",
      public_summary: publicSummary || edition.finalBoard.highestConvictionChange,
      payload: {
        ...edition,
        contractVersion: 2,
        scheduleSlot: researchRun?.schedule_slot || null,
        scheduledFor: researchRun?.scheduled_for || null,
        runKey: researchRun?.run_key || runKey,
        canonicalStoryManifest,
      },
      source_record_refs: canonicalStoryManifest.map((entry) => ({
        type: "story",
        id: entry.storyId,
        snapshotId: entry.snapshotId,
      })),
      redaction_log: [],
      confidence: canonicalStoryManifest.length
        ? Math.round(canonicalStoryManifest.reduce(
            (sum, entry) => sum + Number((entry.state as { confidence?: number }).confidence || 0),
            0,
          ) / canonicalStoryManifest.length)
        : 50,
      published_at: generatedAt,
    }),
  });
  if (!rows[0]?.id) throw new Error("Unable to persist zero-change canonical Journey edition snapshot.");
  return rows[0].id;
}

/**
 * Final Live-owned edition-composition phase. It never mutates an existing
 * edition. Instead it reads the exact persisted base edition + Story manifest,
 * composes 1-3 causal storylines, and writes a superseding immutable daily
 * brief. Edition replay already removes superseded rows from the current index.
 */
export async function composeCanonicalDossierEditionForResearchRun({
  researchRunId,
}: {
  researchRunId: string;
}) {
  const rows = await dailyBriefsForResearchRun(researchRunId);
  const base = currentDailyBrief(rows);
  if (!base) throw new Error("Canonical base edition is unavailable for Dossier storyline composition.");
  if (hasComposedDossier(base.payload)) {
    return {
      editionId: base.id,
      status: "already_composed" as const,
      warnings: [] as string[],
      model: null,
    };
  }
  if (!Array.isArray(base.payload.canonicalStoryManifest)) {
    throw new Error("Canonical Story manifest is unavailable for Dossier storyline composition.");
  }

  const composed = await composePersistedDossierStorylines({ editionPayload: base.payload });
  if (!composed.dossier || !composed.composition) {
    return {
      editionId: base.id,
      status: "skipped" as const,
      warnings: composed.warnings,
      model: composed.model,
    };
  }

  const publishedAt = new Date().toISOString();
  const payload = {
    ...base.payload,
    dossier: composed.dossier,
    dossierComposition: {
      contractVersion: DOSSIER_STORYLINE_COMPOSITION_V1,
      parentEditionId: base.id,
      composedAt: publishedAt,
      model: composed.model,
    },
  };
  const inserted = await intelligenceRest<Array<{ id: string }>>("hybrid_publication_snapshots", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      research_run_id: researchRunId,
      slot_run_id: base.slot_run_id,
      story_id: null,
      story_thesis_version_id: null,
      supersedes_snapshot_id: base.id,
      snapshot_type: "daily_brief",
      public_summary: base.public_summary,
      payload,
      source_record_refs: Array.isArray(base.source_record_refs) ? base.source_record_refs : [],
      redaction_log: Array.isArray(base.redaction_log) ? base.redaction_log : [],
      confidence: base.confidence,
      published_at: publishedAt,
    }),
  });
  if (!inserted[0]?.id) throw new Error("Unable to persist composed canonical Dossier edition snapshot.");
  return {
    editionId: inserted[0].id,
    status: "composed" as const,
    warnings: composed.warnings,
    model: composed.model,
  };
}
