import "server-only";

import { getHybridDeskData } from "@/lib/data";
import { getHybridPublicationRecords, selectHybridPublicationStoryStates } from "@/lib/hybrid-publication";
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
  payload: Record<string, unknown>;
  published_at: string;
};

function recruitmentDiagnostics(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const number = (key: string) => Number.isFinite(candidate[key]) ? Number(candidate[key]) : 0;
  return {
    asOf: typeof candidate.asOf === "string" ? candidate.asOf : new Date(0).toISOString(),
    evidenceCount: number("evidenceCount"),
    eligibleCount: number("eligibleCount"),
    scheduledOnlyCount: number("scheduledOnlyCount"),
    staleCount: number("staleCount"),
    futureTimestampCount: number("futureTimestampCount"),
    duplicateCount: number("duplicateCount"),
    recruitedClusterCount: number("recruitedClusterCount"),
    contextClusterCount: number("contextClusterCount"),
    deferredClusterCount: number("deferredClusterCount"),
  };
}

async function recruitmentForResearchRun(researchRunId: string) {
  const rows = await intelligenceRest<Array<{ metadata: Record<string, unknown> | null }>>(
    `intelligence_engine_runs?select=metadata&research_run_id=eq.${encodeURIComponent(researchRunId)}&order=started_at.desc&limit=1`,
  ).catch(() => []);
  return recruitmentDiagnostics(rows[0]?.metadata?.recruitment);
}

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
 * Ensure every completed research run owns one immutable canonical edition.
 * The normal intelligence runtime already persists the edition when at least
 * one Story changes; that row is returned unchanged. Only the legitimate
 * zero-change case reaches the fallback below, where the same deterministic
 * composeAlchemyEdition contract produces an explicitly sparse Journey.
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
  const existing = await intelligenceRest<DailyBriefRow[]>(
    `hybrid_publication_snapshots?select=id,payload,published_at&snapshot_type=eq.daily_brief&research_run_id=eq.${encodeURIComponent(researchRunId)}&limit=1`,
  );
  if (existing[0]) return existing[0].id;

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
    "hybrid_publication_snapshots?select=id,payload,published_at&snapshot_type=eq.daily_brief&order=published_at.desc,id.desc&limit=1",
  );
  const previousEdition = asPreviousEdition(prior[0]?.payload);
  // A zero-change edition must not attach current Story IDs to forward events.
  // Event acquisition/coverage is still canonical, but Story linkage remains empty.
  const eventHorizon = await buildEditionEventHorizon([]);
  const recruitment = await recruitmentForResearchRun(researchRunId);

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
      recruitment,
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
