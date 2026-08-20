import "server-only";

import type { EvidencePackItem, MarketBeliefOutput } from "@/lib/intelligence/schemas";
import { intelligenceRest } from "@/lib/intelligence/supabase";
import {
  buildStoryReviewTargets,
  persistStoryMaintenanceAssessments,
  type MaintenanceStory,
} from "@/lib/intelligence/story-maintenance";

type StageRow = {
  id: string;
  output_payload: MarketBeliefOutput;
  completed_at: string | null;
};

type EvidenceRow = {
  id: string;
  source_id?: string;
  claim_text: string;
  summary: string | null;
  evidence_class: string;
  support_direction: string;
  event_at: string | null;
  published_at: string | null;
  affected_assets: string[];
  affected_topics: string[];
  provenance_urls: string[];
  source?: {
    source_name: string;
    source_tier: number;
    reliability_score: number;
    ancestry_group_id: string | null;
  } | Array<{
    source_name: string;
    source_tier: number;
    reliability_score: number;
    ancestry_group_id: string | null;
  }> | null;
};

export type StoryMaintenanceApplicationResult = {
  evaluatedStoryIds: string[];
  materiallyChangedStoryIds: string[];
  missingTargetStoryIds: string[];
  rejectedMaterialStoryIds: string[];
  updatedStories: MaintenanceStory[];
  reused: boolean;
  stageRunId: string | null;
};

function source(row: EvidenceRow) {
  return Array.isArray(row.source) ? row.source[0] : row.source;
}

function evidencePack(rows: EvidenceRow[]): EvidencePackItem[] {
  return rows.map((row) => {
    const evidenceSource = source(row);
    return {
      id: row.id,
      claim: row.claim_text,
      summary: row.summary,
      evidenceClass: row.evidence_class,
      sourceName: evidenceSource?.source_name || "Unknown source",
      sourceTier: evidenceSource?.source_tier ?? 5,
      reliabilityScore: Number(evidenceSource?.reliability_score ?? 0),
      ancestryGroupId: evidenceSource?.ancestry_group_id ?? null,
      supportDirection: row.support_direction,
      eventAt: row.event_at,
      publishedAt: row.published_at,
      affectedAssets: row.affected_assets ?? [],
      affectedTopics: row.affected_topics ?? [],
      provenanceUrls: row.provenance_urls ?? [],
    };
  });
}

function emptyResult(stageRunId: string | null): StoryMaintenanceApplicationResult {
  return {
    evaluatedStoryIds: [],
    materiallyChangedStoryIds: [],
    missingTargetStoryIds: [],
    rejectedMaterialStoryIds: [],
    updatedStories: [],
    reused: false,
    stageRunId,
  };
}

/**
 * The Market Belief model call already sees current evidence and existing
 * Stories. Its structured output includes a bounded Story-maintenance
 * assessment, so no second LLM call is needed. This function validates and
 * persists that maintenance after the checkpoint has completed.
 *
 * The read paths deliberately match the runtime frozen-read prefixes. A later
 * continuation must never validate a Market Belief checkpoint against newer
 * evidence that the model did not see.
 */
export async function applyMarketBeliefStoryMaintenance(input: {
  engineRunId: string;
  dryRun: boolean;
}): Promise<StoryMaintenanceApplicationResult> {
  const stages = await intelligenceRest<StageRow[]>(
    `intelligence_stage_runs?select=id,output_payload,completed_at&engine_run_id=eq.${encodeURIComponent(input.engineRunId)}&stage_key=eq.market_belief&status=eq.completed&order=completed_at.desc.nullslast&limit=1`,
  );
  const stage = stages[0];
  if (!stage) return emptyResult(null);
  const assessments = Array.isArray(stage.output_payload?.storyAssessments) ? stage.output_payload.storyAssessments : [];
  if (!assessments.length) return emptyResult(stage.id);

  const [stories, evidenceRows] = await Promise.all([
    intelligenceRest<MaintenanceStory[]>(
      "stories?select=id,slug,title,thesis,status,confidence,market_question,dominant_narrative,strongest_support,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,assets,created_by&status=neq.archived&status=neq.discarded&order=updated_at.desc",
    ),
    intelligenceRest<EvidenceRow[]>(
      "intelligence_evidence?select=id,source_id,claim_text,summary,evidence_class,support_direction,event_at,published_at,affected_assets,affected_topics,provenance_urls,source:intelligence_evidence_sources(id,external_source_id,source_name,source_tier,reliability_score,ancestry_group_id)&freshness_status=neq.superseded&order=event_at.desc.nullslast,received_at.desc&limit=72",
    ),
  ]);
  const evidence = evidencePack(evidenceRows);
  const analysisAsOf = stage.completed_at || new Date().toISOString();
  const targets = await buildStoryReviewTargets({
    stories,
    evidence,
    analysisAsOf,
    maxStories: 4,
    maxEvidencePerStory: 10,
  });
  const result = await persistStoryMaintenanceAssessments({
    engineRunId: input.engineRunId,
    stageRunId: stage.id,
    assessments,
    stories,
    targets,
    evidenceById: new Map(evidence.map((item) => [item.id, item])),
    analysisAsOf,
    dryRun: input.dryRun,
  });
  return { ...result, stageRunId: stage.id };
}
