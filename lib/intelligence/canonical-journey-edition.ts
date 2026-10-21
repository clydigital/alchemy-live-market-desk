import { nearestImmutableDossierContext, MAX_ZERO_CHANGE_EDITION_LOOKBACK } from "./zero-change-immutable-context.ts";
import {
  composeFrozenMarketEditorial, prepareFrozenMarketEditorial,
  EDITORIAL_SCHEMA, EDITORIAL_INSTRUCTIONS, editorialCandidateModelInput,
} from "@/lib/market-editorial-runtime";
import { augmentDossierWithEditorial } from "@/lib/market-editorial-combined";
import {
  ARTICLE_SECTIONS_V2, MODEL_ARTICLE_SECTIONS_V2_SCHEMA,
  eligibleForArticleSectionsV2,validateArticleSectionsV2,
  type ArticleSectionsV2,type ModelArticleSectionsV2,
} from "@/lib/market-editorial-sections-v2";
import { runStructuredStage } from "@/lib/intelligence/openai";
import {
  MARKET_EDITORIAL_V1, validateMarketEditorialOutput,
  type EditorialCandidate, type MarketEditorialArticleV1, type ModelEditorialOutput,
} from "@/lib/market-editorial-v1";
import { currentIntelligenceInvocation } from "@/lib/intelligence/invocation-context";
import { decideEditorialStage } from "@/lib/intelligence/editorial-stage-gate";
import { buildMarketImpactPacketsV1 } from "@/lib/market-impact-packet";
import "server-only";

import { captureCanonicalPublicationStoryStates } from "@/lib/hybrid-publication";
import {
  composePersistedDossierStorylines,
  buildDossierComposerCandidates,
  DOSSIER_STORYLINE_COMPOSITION_V1,
} from "@/lib/intelligence/dossier-storyline-composer";
import { composeAlchemyEdition, type AlchemyEdition } from "@/lib/intelligence/edition";
import type { CandidateContractDiagnostic } from "@/lib/intelligence/candidate-evidence-contract";
import { persistOrReuseCanonicalArtifact } from "@/lib/intelligence/canonical-publication-idempotency";
import { JOURNEY_BRIEFING_V1, type JourneyStorySource } from "@/lib/intelligence/journey-briefing";
import {
  CANONICAL_STORY_REASONING_V1,
  type CanonicalStoryReasoningV1,
} from "@/lib/intelligence/story-reasoning";
import { intelligenceRest } from "@/lib/intelligence/supabase";
import { buildEditionEventHorizon } from "@/lib/market-event-runtime";
import {
  captureMarketMotionEditionAttachment,
  emptyMarketMotionEditionAttachment,
  marketMotionEditionSourceRefs,
} from "@/lib/market-motion-edition";
import { capturePresenterDossierEditionContext } from "@/lib/presenter-dossier-edition-capture";
import { presenterDossierEditionSourceRef } from "@/lib/presenter-dossier-edition-context";

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
  edition_phase: "base" | "composed";
  payload: Record<string, unknown>;
  public_summary: string;
  source_record_refs: Record<string, unknown>[];
  redaction_log?: unknown[];
  confidence: number;
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

function contractDiagnostics(value: unknown): CandidateContractDiagnostic[] {
  if (!Array.isArray(value)) return [];
  const validCodes = new Set<CandidateContractDiagnostic["code"]>([
    "repaired_contract_format",
    "rejected_unknown_evidence",
    "rejected_missing_required_evidence",
    "story_omitted_after_contract_failure",
  ]);
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.code !== "string" || typeof candidate.candidateKey !== "string" || typeof candidate.detail !== "string") return [];
    const code = candidate.code as CandidateContractDiagnostic["code"];
    if (!validCodes.has(code)) return [];
    return [{
      code,
      candidateKey: candidate.candidateKey,
      primaryHypothesisId: typeof candidate.primaryHypothesisId === "string" ? candidate.primaryHypothesisId : null,
      title: typeof candidate.title === "string" ? candidate.title : null,
      detail: candidate.detail,
    }];
  });
}

async function contractDiagnosticsForResearchRun(researchRunId: string) {
  const rows = await intelligenceRest<Array<{ metadata: Record<string, unknown> | null }>>(
    `intelligence_engine_runs?select=metadata&research_run_id=eq.${encodeURIComponent(researchRunId)}&order=started_at.desc&limit=1`,
  ).catch(() => []);
  return contractDiagnostics(rows[0]?.metadata?.contractDiagnostics);
}

function asPreviousEdition(payload: Record<string, unknown> | undefined): AlchemyEdition | null {
  return payload?.methodologyVersion === "alchemy-mixed-research-voice-v1"
    ? payload as unknown as AlchemyEdition
    : null;
}

export function priorImmutableDossierStorySources(previousEdition: AlchemyEdition | null): JourneyStorySource[] {
  if (!previousEdition) return [];
  const manifest = (previousEdition as unknown as { canonicalStoryManifest?: unknown }).canonicalStoryManifest;
  if (!Array.isArray(manifest)) return [];

  return manifest.flatMap((raw, index): JourneyStorySource[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const entry = raw as Record<string, unknown>;
    const snapshotId = typeof entry.snapshotId === "string" ? entry.snapshotId : null;
    const storyId = typeof entry.storyId === "string" ? entry.storyId : null;
    const thesisVersionId = typeof entry.thesisVersionId === "string" ? entry.thesisVersionId : null;
    const reasoning = entry.reasoning;
    if (
      !snapshotId
      || !storyId
      || !thesisVersionId
      || !reasoning
      || typeof reasoning !== "object"
      || Array.isArray(reasoning)
    ) return [];

    const candidate = reasoning as Partial<CanonicalStoryReasoningV1>;
    if (
      candidate.contractVersion !== CANONICAL_STORY_REASONING_V1
      || candidate.storyId !== storyId
      || candidate.storyVersionId !== thesisVersionId
    ) return [];

    return [{
      position: Number.isInteger(entry.position) && Number(entry.position) > 0 ? Number(entry.position) : index + 1,
      publicationSnapshotId: snapshotId,
      storyId,
      thesisVersionId,
      reasoning: candidate as CanonicalStoryReasoningV1,
    }];
  });
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

function hasCompletedPublicationComposition(payload: Record<string, unknown> | undefined) {
  const editorial = payload?.marketEditorial;
  return hasComposedDossier(payload) || Boolean(
    editorial && typeof editorial === "object" && !Array.isArray(editorial)
    && (editorial as { contractVersion?: unknown }).contractVersion === MARKET_EDITORIAL_V1
    && Array.isArray((editorial as { articles?: unknown }).articles)
    && (editorial as { articles: unknown[] }).articles.length > 0
  );
}

function dailyBriefForPhase(rows: DailyBriefRow[], phase: DailyBriefRow["edition_phase"]) {
  return rows.find((row) => row.edition_phase === phase) || null;
}

function isCanonicalBaseEdition(row: DailyBriefRow | null): row is DailyBriefRow {
  return Boolean(
    row
    && row.edition_phase === "base"
    && Array.isArray(row.payload.canonicalStoryManifest)
    && hasPersistedJourney(row.payload),
  );
}

async function dailyBriefsForResearchRun(researchRunId: string) {
  return intelligenceRest<DailyBriefRow[]>(
    `hybrid_publication_snapshots?select=*&snapshot_type=eq.daily_brief&research_run_id=eq.${encodeURIComponent(researchRunId)}&order=published_at.desc,id.desc&limit=20`,
  );
}

async function storySnapshotsForResearchRun(researchRunId: string) {
  return intelligenceRest<StorySnapshotRow[]>(
    `hybrid_publication_snapshots?select=id,story_id,story_thesis_version_id,payload&snapshot_type=eq.story&research_run_id=eq.${encodeURIComponent(researchRunId)}&order=published_at.asc,id.asc`,
  );
}

/**
 * Capture the exact current Story projection before the immutable edition is
 * written. This mirrors the normal runtime publication boundary; no mutable
 * Story state is consulted later during replay.
 */
async function captureCanonicalStoryStates() {
  return captureCanonicalPublicationStoryStates({ fresh: true });
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
  const existingRows = await storySnapshotsForResearchRun(researchRunId);
  const existingStoryIds = new Set(existingRows.map((row) => row.story_id).filter(Boolean));
  const missingStates = canonicalStoryStates.filter((story) => !existingStoryIds.has(story.id));
  const expectedStoryIds = new Set(canonicalStoryStates.map((story) => story.id));
  const complete = (rows: StorySnapshotRow[]) => {
    const persistedStoryIds = new Set(rows.map((row) => row.story_id).filter(Boolean));
    return [...expectedStoryIds].every((storyId) => persistedStoryIds.has(storyId));
  };
  const { value: persistedRows } = await persistOrReuseCanonicalArtifact({
    readExisting: async () => {
      const rows = await storySnapshotsForResearchRun(researchRunId);
      return complete(rows) ? rows : null;
    },
    insert: async () => {
      if (!missingStates.length) return existingRows;
      const insertedRows = await intelligenceRest<StorySnapshotRow[]>("hybrid_publication_snapshots", {
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
          payload: {
            canonicalStoryState: (({ canonicalStoryReasoning: _reasoning, ...state }) => state)(story),
            ...(story.canonicalStoryReasoning ? { canonicalStoryReasoning: story.canonicalStoryReasoning } : {}),
          },
          source_record_refs: [],
          redaction_log: [],
          confidence: story.confidence,
          published_at: publishedAt,
        }))),
      });
      return [...existingRows, ...insertedRows];
    },
    isValid: complete,
    missingMessage: "Unable to persist the complete immutable Story snapshot manifest.",
  });

  const snapshotByStoryId = new Map(
    persistedRows
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
      && story.canonicalStoryReasoning?.storyVersionId === thesisVersionId
      ? candidateReasoning as CanonicalStoryReasoningV1
      : null;

    return {
      manifest: {
        position: index + 1,
        snapshotId: snapshot.id,
        storyId: story.id,
        thesisVersionId,
        state,
        reasoning,
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
  storiesPublished = null,
}: {
  researchRunId: string;
  runKey: string;
  publicSummary?: string | null;
  storiesPublished?: number | null;
}) {
  const existingRows = await dailyBriefsForResearchRun(researchRunId);
  const existing = dailyBriefForPhase(existingRows, "base");
  if (isCanonicalBaseEdition(existing)) return existing.id;

  const generatedAt = new Date().toISOString();
  const presenterDossierContext = await capturePresenterDossierEditionContext(generatedAt);
  const presenterDossierSourceRef = presenterDossierEditionSourceRef(presenterDossierContext);
  const researchRun = (await intelligenceRest<Array<{
    run_key: string;
    schedule_slot: string;
    scheduled_for: string;
  }>>(
    `research_runs?select=run_key,schedule_slot,scheduled_for&id=eq.${encodeURIComponent(researchRunId)}&limit=1`,
  ))[0] || null;

  // A zero-change run has no changed Story to replay. Avoid rebuilding the
  // entire mutable desk projection (including publication archive and images)
  // just to persist an empty immutable manifest. This keeps completed-engine
  // publication recovery bounded and leaves the full freeze path unchanged
  // whenever the engine actually published one or more Stories.
  let canonicalStoryManifest: Awaited<ReturnType<typeof persistCanonicalStoryManifest>>["manifest"] = [];
  let journeySources: JourneyStorySource[] = [];
  if (storiesPublished !== 0) {
    const canonicalStoryStates = await captureCanonicalStoryStates();
    const persistedStories = await persistCanonicalStoryManifest({
      researchRunId,
      canonicalStoryStates,
      publishedAt: generatedAt,
    });
    canonicalStoryManifest = persistedStories.manifest;
    journeySources = persistedStories.journeySources;
  }

  const prior = await intelligenceRest<DailyBriefRow[]>(
    "hybrid_publication_snapshots?select=*&snapshot_type=eq.daily_brief&order=published_at.desc,id.desc&limit=1",
  );
  const previousEdition = asPreviousEdition(prior[0]?.payload);
  const immediateDossierSources = priorImmutableDossierStorySources(previousEdition);
  let recoveredDossierContext: { sources: JourneyStorySource[]; publishedAt: string } | null = null;
  if (storiesPublished === 0 && immediateDossierSources.length === 0) {
    // Use only dated immutable base editions, never a mutable current-Story query.
    const priorBases = await intelligenceRest<Array<{
      published_at: string;
      payload: Record<string, unknown>;
    }>>(
      `hybrid_publication_snapshots?select=published_at,payload&snapshot_type=eq.daily_brief&edition_phase=eq.base&published_at=lt.${encodeURIComponent(generatedAt)}&order=published_at.desc,id.desc&limit=${MAX_ZERO_CHANGE_EDITION_LOOKBACK}`,
    );
    recoveredDossierContext = nearestImmutableDossierContext(
      priorBases,
      generatedAt,
      (payload) => priorImmutableDossierStorySources(asPreviousEdition(payload)),
    );
  }
  const dossierStorySources = storiesPublished === 0
    ? (immediateDossierSources.length ? immediateDossierSources : recoveredDossierContext?.sources || [])
    : journeySources;
  const contextWarnings = recoveredDossierContext
    ? [`Dossier commentary uses immutable Story context from ${recoveredDossierContext.publishedAt}; this run has no new accepted Story change and the historical context is not current evidence.`]
    : [];
  // A zero-change edition must not attach current Story IDs to forward events.
  // Event acquisition/coverage is still canonical, but Story linkage remains empty.
  const motionWarnings: string[] = [];
  const marketMotion = await captureMarketMotionEditionAttachment({
    researchRunId,
    capturedAt: generatedAt,
  }).catch((error) => {
    motionWarnings.push(`Market Motion edition snapshot unavailable: ${error instanceof Error ? error.message : "unknown failure"}`);
    return emptyMarketMotionEditionAttachment(researchRunId, generatedAt);
  });
  const eventHorizon = await buildEditionEventHorizon([]);
  const [recruitment, contractDiagnostics] = await Promise.all([
    recruitmentForResearchRun(researchRunId),
    contractDiagnosticsForResearchRun(researchRunId),
  ]);

  const edition = composeAlchemyEdition({
    generatedAt,
    comparisonWindowStart: previousEdition?.generatedAt
      || prior[0]?.published_at
      || new Date(Date.parse(generatedAt) - 86_400_000).toISOString(),
    previousEdition,
    stories: [],
    upcoming: eventHorizon.upcoming,
    journeyStorySources: journeySources,
    dossierStorySources,
    marketEvents: eventHorizon.events,
    marketMotion: marketMotion.items,
    diagnostics: {
      warnings: [...eventHorizon.warnings, ...motionWarnings, ...contextWarnings],
      eventHorizonCoverage: eventHorizon.coverage,
      recruitment,
      contractDiagnostics,
    },
  });
  if (!hasPersistedJourney(edition as unknown as Record<string, unknown>)) {
    throw new Error("Zero-change canonical edition did not compose journey-briefing/v1.");
  }

  const { value: canonicalBase } = await persistOrReuseCanonicalArtifact({
    readExisting: async () => {
      const row = dailyBriefForPhase(await dailyBriefsForResearchRun(researchRunId), "base");
      return isCanonicalBaseEdition(row) ? row : null;
    },
    insert: async () => {
      const rows = await intelligenceRest<DailyBriefRow[]>("hybrid_publication_snapshots", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          research_run_id: researchRunId,
          slot_run_id: null,
          story_id: null,
          story_thesis_version_id: null,
          supersedes_snapshot_id: prior[0]?.id || null,
          snapshot_type: "daily_brief",
          edition_phase: "base",
          public_summary: publicSummary || edition.finalBoard.highestConvictionChange,
          payload: {
            ...edition,
            contractVersion: 2,
            scheduleSlot: researchRun?.schedule_slot || null,
            scheduledFor: researchRun?.scheduled_for || null,
            runKey: researchRun?.run_key || runKey,
            canonicalStoryManifest,
            presenterDossierContext,
            marketMotion,
            marketImpactPackets: buildMarketImpactPacketsV1({
              payload: { ...edition, canonicalStoryManifest, marketMotion },
              asOf: generatedAt,
            }),
          },
          source_record_refs: [
            ...canonicalStoryManifest.map((entry) => ({
              type: "story",
              id: entry.storyId,
              snapshotId: entry.snapshotId,
            })),
            ...(presenterDossierSourceRef ? [presenterDossierSourceRef] : []),
            ...marketMotionEditionSourceRefs(marketMotion),
          ],
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
      if (!rows[0]) throw new Error("Unable to persist zero-change canonical Journey edition snapshot.");
      return rows[0];
    },
    isValid: isCanonicalBaseEdition,
    missingMessage: "Unable to persist zero-change canonical Journey edition snapshot.",
  });
  return canonicalBase.id;
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
  const existingComposition = dailyBriefForPhase(rows, "composed");
  if (existingComposition && hasCompletedPublicationComposition(existingComposition.payload)) {
    return {
      editionId: existingComposition.id,
      status: "already_composed" as const,
      warnings: [] as string[],
      model: null,
    };
  }
  const base = dailyBriefForPhase(rows, "base");
  if (!base) throw new Error("Canonical base edition is unavailable for Dossier storyline composition.");
  if (!Array.isArray(base.payload.canonicalStoryManifest)) {
    throw new Error("Canonical Story manifest is unavailable for Dossier storyline composition.");
  }

  const dossierHasModelCandidates = buildDossierComposerCandidates(base.payload).length > 0;
  const editorialWarnings: string[] = [];
  let combinedCandidates: EditorialCandidate[] = [];
  let combinedArticles: MarketEditorialArticleV1[] = [];
  let combinedFullArticles: ArticleSectionsV2[] = [];
  // Safe initial rollout: no extra schema load on the critical canonical
  // Dossier stage until a dedicated preview has verified provider capacity.
  const sectionsV2Enabled = process.env.MARKET_EDITORIAL_SECTIONS_V2_ENABLED === "true";

  // Source admission precedes the existing Dossier model invocation. It is
  // read-only and capped at ONE editorial article on the first combined rollout.
  // Qualification failure must never prevent normal Dossier composition.
  if (dossierHasModelCandidates) {
    try {
      combinedCandidates = await prepareFrozenMarketEditorial({
        editionPayload: base.payload,
        asOf: base.published_at,
        maxArticles: 1,
      });
    } catch (error) {
      editorialWarnings.push("Combined editorial source admission failed; Dossier composition remains independent.");
      console.error("Combined editorial source admission unavailable", error instanceof Error ? error.name : "unknown");
    }
  }

  // Reuse exactly the existing dossier_storyline_composer provider invocation
  // and its canonical output sanitizer. No additional model stage, DB phase or
  // Story reasoning path. The extra array is optional *content* inside that
  // same strict JSON response, and is validated separately against exact facts.
  const combinedRunner: NonNullable<Parameters<typeof composePersistedDossierStorylines>[0]["modelRunner"]> | undefined =
    combinedCandidates.length ? async <T>(stage: Parameters<typeof runStructuredStage>[0]) => {
      const fullCandidate = sectionsV2Enabled
        ? combinedCandidates.find(eligibleForArticleSectionsV2) : undefined;
      const augmented = augmentDossierWithEditorial(stage, {
        editorialSchema: EDITORIAL_SCHEMA as unknown as Record<string, unknown>,
        editorialInstructions: EDITORIAL_INSTRUCTIONS,
        candidates: combinedCandidates,
        candidateInput: editorialCandidateModelInput,
        fullArticle: fullCandidate ? {
          fingerprint: fullCandidate.fingerprint,
          schema: {type:"array",items:MODEL_ARTICLE_SECTIONS_V2_SCHEMA} as Record<string,unknown>,
          instructions: [
            "This is article-sections/2 for a frozen, source-qualified Story; never modify Dossier output.",
            "reportingFactIds: select three to five DISTINCT exact IDs from verifiedFacts.",
            "Do not write freeform reporting text. The renderer will use exact issuer/source claim text.",
            "interpretation: write two to five substantive conditional paragraphs (45–720 chars),",
            "each linked to one existing support: mechanism, asset, countercase or nextTest.",
            "For asset support, provide an exact asset from marketEffects; otherwise asset must be null.",
            "At least one mechanism and one linked asset interpretation must qualify.",
            "Do not claim a realised price reaction, new measurement or fresh change without dated tape.",
            "Historical CONTEXT_ONLY mechanism remains labelled historical, not a new Story verdict.",
            "If the eligible facts or market reasoning cannot support this count, return [] instead.",
          ].join("\n"),
        } : null,
      });
      const response = await runStructuredStage<T & ModelEditorialOutput>(augmented);
      combinedArticles = validateMarketEditorialOutput(response.data, combinedCandidates);
      if (fullCandidate) {
        const output = response.data as ModelEditorialOutput & {articleSections?: ModelArticleSectionsV2[]};
        const rawSection = Array.isArray(output.articleSections)
          ? output.articleSections.find(x=>x?.fingerprint===fullCandidate.fingerprint) : null;
        const admitted = validateArticleSectionsV2(rawSection,fullCandidate);
        if (admitted?.readiness==="FULL_ARTICLE") combinedFullArticles=[admitted];
        else editorialWarnings.push("V2 full article did not pass exact-source and conditional-impact admission.");
      }
      return response;
    } : undefined;

  const composed = await composePersistedDossierStorylines({
    editionPayload: base.payload,
    ...(combinedRunner ? { modelRunner: combinedRunner } : {}),
  });
  const hasStoryline = Boolean(composed.dossier && composed.composition);
  const invocation = currentIntelligenceInvocation();
  const editorialStage = decideEditorialStage({
    dossierModelWasUsed: Boolean(composed.model),
    oneModelStage: invocation?.oneModelStage ?? true,
    invokedModelStage: invocation?.invokedModelStage ?? null,
  });
  let marketEditorial: Awaited<ReturnType<typeof composeFrozenMarketEditorial>> | null =
    combinedArticles.length
      ? { contractVersion: MARKET_EDITORIAL_V1, articles: combinedArticles, warnings: [] }
      : null;

  // When no immutable Dossier grouping is necessary, use the sole available
  // model slot for editorial; when grouping did happen, never make a second
  // model request to fill missing paragraphs.
  if (!dossierHasModelCandidates && editorialStage.permitted) {
    try {
      marketEditorial = await composeFrozenMarketEditorial({
        editionPayload: base.payload,
        asOf: base.published_at,
        maxArticles: 3,
      });
      editorialWarnings.push(...marketEditorial.warnings);
    } catch (error) {
      editorialWarnings.push("Bounded market editorial composition failed without affecting the canonical Dossier.");
      console.error("Market editorial composition unavailable", error instanceof Error ? error.name : "unknown");
    }
  } else if (dossierHasModelCandidates && combinedCandidates.length && !combinedArticles.length) {
    editorialWarnings.push("Combined Dossier composition completed, but no article passed exact-source editorial validation.");
  } else if (dossierHasModelCandidates && !combinedCandidates.length) {
    editorialWarnings.push("Dossier composition proceeded without a qualified, dated original-source editorial candidate.");
  } else if (!editorialStage.permitted) {
    editorialWarnings.push(
      `Market editorial model omitted: ${editorialStage.reason}; preserved the one-model-stage and immutable-edition contract.`,
    );
  }
  const hasEditorial = Boolean(marketEditorial?.articles.length);
  const hasFullArticle = combinedFullArticles.length > 0;
  if (!hasStoryline && !hasEditorial && !hasFullArticle) {
    return {
      editionId: base.id,
      status: "skipped" as const,
      warnings: [...composed.warnings, ...editorialWarnings],
      model: composed.model,
    };
  }

  const publishedAt = new Date().toISOString();
  const payload = {
    ...base.payload,
    ...(hasStoryline ? {
      dossier: composed.dossier,
      dossierComposition: {
        contractVersion: DOSSIER_STORYLINE_COMPOSITION_V1,
        parentEditionId: base.id,
        composedAt: publishedAt,
        model: composed.model,
      },
    } : {}),
    ...(hasEditorial ? {
      marketEditorial: {
        ...marketEditorial,
        parentEditionId: base.id,
        composedAt: publishedAt,
      },
    } : {}),
    ...(hasFullArticle ? {
      marketEditorialSectionsV2: {
        contractVersion: ARTICLE_SECTIONS_V2,
        parentEditionId: base.id,
        composedAt: publishedAt,
        articles: combinedFullArticles,
      },
    } : {}),
  };
  const { value: canonicalComposition, reused } = await persistOrReuseCanonicalArtifact({
    readExisting: async () => {
      const row = dailyBriefForPhase(await dailyBriefsForResearchRun(researchRunId), "composed");
      return row && hasCompletedPublicationComposition(row.payload) ? row : null;
    },
    insert: async () => {
      const inserted = await intelligenceRest<DailyBriefRow[]>("hybrid_publication_snapshots", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          research_run_id: researchRunId,
          slot_run_id: base.slot_run_id,
          story_id: null,
          story_thesis_version_id: null,
          supersedes_snapshot_id: base.id,
          snapshot_type: "daily_brief",
          edition_phase: "composed",
          public_summary: base.public_summary,
          payload,
          source_record_refs: Array.isArray(base.source_record_refs) ? base.source_record_refs : [],
          redaction_log: Array.isArray(base.redaction_log) ? base.redaction_log : [],
          confidence: base.confidence,
          published_at: publishedAt,
        }),
      });
      if (!inserted[0]) throw new Error("Unable to persist composed canonical Dossier edition snapshot.");
      return inserted[0];
    },
    isValid: (row) => Boolean(row.id && row.edition_phase === "composed" && hasCompletedPublicationComposition(row.payload)),
    missingMessage: "Unable to persist composed canonical Dossier edition snapshot.",
  });
  return {
    editionId: canonicalComposition.id,
    status: reused ? "already_composed" as const : "composed" as const,
    warnings: [...composed.warnings, ...editorialWarnings],
    model: composed.model,
  };
}
