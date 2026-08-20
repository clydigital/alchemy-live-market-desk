import "server-only";

import { createHash } from "node:crypto";

import type { EvidencePackItem, MarketBeliefOutput } from "@/lib/intelligence/schemas";
import { intelligenceRest } from "@/lib/intelligence/supabase";

export type MaintenanceStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  market_question: string | null;
  dominant_narrative: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  assets: string[];
};

export type StoryReviewTarget = {
  story: {
    id: string;
    slug: string;
    title: string;
    thesis: string;
    status: string;
    confidence: number;
    marketQuestion: string | null;
    dominantNarrative: string | null;
    strongestSupport: string | null;
    strongestContradiction: string | null;
    confirmationTrigger: string | null;
    invalidationTrigger: string | null;
    nextCatalyst: string | null;
    assets: string[];
    lastEvaluatedAt: string | null;
  };
  evidence: EvidencePackItem[];
};

export type StoryMaintenanceAssessment = {
  storyId: string;
  disposition: "unchanged" | "reinforced" | "weakened" | "reframed" | "invalidated";
  materialChange: boolean;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  contextEvidenceIds: string[];
  whatChanged: string;
  marketReaction: string;
  acceptedExplanation: string;
  causalMechanism: string;
  strongestSupport: string;
  strongestContradiction: string;
  strongestCountercase: string;
  thesis: string;
  confidence: number;
  pricedAssessment: string;
  confirmationTrigger: string;
  invalidationTrigger: string;
  nextCatalyst: string;
  changeKinds: Array<"evidence" | "catalyst" | "price_confirmation" | "probability" | "cross_asset_transmission" | "official_communication" | "management_communication" | "watchlist_state">;
};

export type MarketBeliefMaintenanceOutput = MarketBeliefOutput & {
  storyAssessments: StoryMaintenanceAssessment[];
};

const stringArray = { type: "array", items: { type: "string" }, uniqueItems: true };
const nullableString = { type: ["string", "null"] };

export const MARKET_BELIEF_MAINTENANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["beliefs", "storyAssessments"],
  properties: {
    beliefs: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["statement", "pricedState", "consensusStrength", "affectedAssets", "evidenceIds"],
        properties: {
          statement: { type: "string" },
          pricedState: nullableString,
          consensusStrength: { type: "number", minimum: 0, maximum: 100 },
          affectedAssets: stringArray,
          evidenceIds: stringArray,
        },
      },
    },
    storyAssessments: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "storyId", "disposition", "materialChange", "supportingEvidenceIds", "contradictingEvidenceIds", "contextEvidenceIds",
          "whatChanged", "marketReaction", "acceptedExplanation", "causalMechanism", "strongestSupport", "strongestContradiction",
          "strongestCountercase", "thesis", "confidence", "pricedAssessment", "confirmationTrigger", "invalidationTrigger",
          "nextCatalyst", "changeKinds",
        ],
        properties: {
          storyId: { type: "string" },
          disposition: { type: "string", enum: ["unchanged", "reinforced", "weakened", "reframed", "invalidated"] },
          materialChange: { type: "boolean" },
          supportingEvidenceIds: stringArray,
          contradictingEvidenceIds: stringArray,
          contextEvidenceIds: stringArray,
          whatChanged: { type: "string" },
          marketReaction: { type: "string" },
          acceptedExplanation: { type: "string" },
          causalMechanism: { type: "string" },
          strongestSupport: { type: "string" },
          strongestContradiction: { type: "string" },
          strongestCountercase: { type: "string" },
          thesis: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 100 },
          pricedAssessment: { type: "string" },
          confirmationTrigger: { type: "string" },
          invalidationTrigger: { type: "string" },
          nextCatalyst: { type: "string" },
          changeKinds: {
            type: "array",
            uniqueItems: true,
            items: { type: "string", enum: ["evidence", "catalyst", "price_confirmation", "probability", "cross_asset_transmission", "official_communication", "management_communication", "watchlist_state"] },
          },
        },
      },
    },
  },
} as const;

export const MARKET_BELIEF_STORY_MAINTENANCE_RULES = `Market Belief also owns a bounded maintenance pass for EXISTING Stories supplied in storyReviewTargets.
This maintenance pass is separate from new-Story discovery. Divergence is NOT required for an existing Story to be reviewed.

For every storyReviewTarget, answer the question: "Did anything actually change about this existing thesis?"
- Compare fresh routed evidence with the Story's current thesis, support, contradiction, catalyst, confirmation and invalidation.
- Distinguish a macro-driven price move from a change in the underlying Story fundamentals.
- Reconstruct the causal chain explicitly: driver -> mechanism -> market reaction -> implication.
- Distinguish the accepted headline explanation from the actual mechanism and scale supported by evidence.
- Capture observable thresholds, catalysts and next tests when supplied by evidence.
- Include the strongest case for why the existing thesis may still be right.
- Creator/video commentary is a research lead only. It can contextualise or suggest a test, but by itself it MUST NOT set materialChange=true.
- Set materialChange=false when evidence merely repeats, confirms without changing probability/conditions, or leaves the thesis intact.
- Set materialChange=true only when evidence changes the thesis, probability/confidence materially, confirmation/invalidation state, causal mechanism, next catalyst, or cross-asset transmission.
- Return exactly one assessment for every supplied target and only use evidence IDs included inside that target.
- Do not create new Stories here. New Story discovery remains the Divergence -> Hypothesis rail.`;

function hash(value: string, length = 64) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function finiteConfidence(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

function latestTimestamp(evidence: EvidencePackItem[]) {
  return evidence.map((item) => item.eventAt || item.publishedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

export async function buildStoryReviewTargets(input: {
  stories: MaintenanceStory[];
  evidence: EvidencePackItem[];
  analysisAsOf: string;
  maxStories?: number;
  maxEvidencePerStory?: number;
}) {
  if (!input.stories.length || !input.evidence.length) return [];
  const storyIds = input.stories.map((story) => story.id);
  const stateRows = await intelligenceRest<Array<{ story_id: string; last_evaluated_at: string | null }>>(
    `intelligence_story_states?select=story_id,last_evaluated_at&story_id=in.(${storyIds.join(",")})`,
  ).catch(() => []);
  const lastEvaluated = new Map(stateRows.map((row) => [row.story_id, row.last_evaluated_at]));
  const fallbackCutoff = Date.parse(input.analysisAsOf) - (72 * 60 * 60 * 1000);
  const maxStories = Math.max(1, Math.min(12, input.maxStories ?? 10));
  const maxEvidence = Math.max(1, Math.min(16, input.maxEvidencePerStory ?? 12));

  return input.stories.flatMap((story): StoryReviewTarget[] => {
    const watermarkRaw = lastEvaluated.get(story.id) ?? null;
    const watermark = watermarkRaw && Number.isFinite(Date.parse(watermarkRaw)) ? Date.parse(watermarkRaw) : fallbackCutoff;
    const relevant = input.evidence.filter((item) => {
      if (!(item.affectedTopics ?? []).includes(story.slug)) return false;
      const timestamp = item.eventAt || item.publishedAt;
      return Boolean(timestamp && Number.isFinite(Date.parse(timestamp)) && Date.parse(timestamp) > watermark);
    }).slice(0, maxEvidence);
    if (!relevant.length) return [];
    return [{
      story: {
        id: story.id,
        slug: story.slug,
        title: story.title,
        thesis: story.thesis,
        status: story.status,
        confidence: story.confidence,
        marketQuestion: story.market_question,
        dominantNarrative: story.dominant_narrative,
        strongestSupport: story.strongest_support,
        strongestContradiction: story.strongest_contradiction,
        confirmationTrigger: story.confirmation_trigger,
        invalidationTrigger: story.invalidation_trigger,
        nextCatalyst: story.next_catalyst,
        assets: story.assets ?? [],
        lastEvaluatedAt: watermarkRaw,
      },
      evidence: relevant,
    }];
  })
    .sort((left, right) => latestTimestamp(right.evidence)?.localeCompare(latestTimestamp(left.evidence) || "") || 0)
    .slice(0, maxStories);
}

function lifecycleFor(disposition: StoryMaintenanceAssessment["disposition"], currentStatus: string) {
  if (disposition === "invalidated") return "invalidated";
  if (disposition === "weakened") return "weakening";
  if (disposition === "reinforced") return currentStatus === "publish" ? "confirmed" : "developing";
  if (disposition === "reframed") return "developing";
  return currentStatus === "publish" ? "confirmed" : currentStatus === "develop" ? "developing" : "detected";
}

function publicStatusFor(disposition: StoryMaintenanceAssessment["disposition"], currentStatus: string) {
  if (disposition === "invalidated") return "archived";
  if (disposition === "weakened" || disposition === "reframed") return "develop";
  return currentStatus;
}

function evidenceRoleSets(assessment: StoryMaintenanceAssessment, allowed: Set<string>) {
  const supporting = unique(assessment.supportingEvidenceIds.filter((id) => allowed.has(id)));
  const contradicting = unique(assessment.contradictingEvidenceIds.filter((id) => allowed.has(id) && !supporting.includes(id)));
  const context = unique(assessment.contextEvidenceIds.filter((id) => allowed.has(id) && !supporting.includes(id) && !contradicting.includes(id)));
  return { supporting, contradicting, context, all: unique([...supporting, ...contradicting, ...context]) };
}

function materialEvidenceAllowed(ids: string[], evidenceById: Map<string, EvidencePackItem>) {
  return ids.some((id) => {
    const item = evidenceById.get(id);
    return Boolean(item && item.evidenceClass !== "transcript" && item.evidenceClass !== "research_analysis" && item.sourceTier <= 4);
  });
}

async function linkStoryEvidence(storyId: string, roles: ReturnType<typeof evidenceRoleSets>) {
  const links = [
    ...roles.supporting.map((evidenceId) => ({ story_id: storyId, evidence_id: evidenceId, evidence_role: "supporting", weight: 65, rationale: "Fresh evidence routed to this existing Story and classified during Story maintenance." })),
    ...roles.contradicting.map((evidenceId) => ({ story_id: storyId, evidence_id: evidenceId, evidence_role: "contradicting", weight: 70, rationale: "Fresh evidence routed to this existing Story and classified as contradictory during Story maintenance." })),
    ...roles.context.map((evidenceId) => ({ story_id: storyId, evidence_id: evidenceId, evidence_role: "context", weight: 45, rationale: "Fresh contextual evidence routed to this existing Story during Story maintenance." })),
  ];
  if (!links.length) return;
  await intelligenceRest("intelligence_story_evidence?on_conflict=story_id,evidence_id,evidence_role", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(links),
  });
}

async function writeStoryState(input: {
  story: MaintenanceStory;
  assessment: StoryMaintenanceAssessment;
  evidenceIds: string[];
  evidenceById: Map<string, EvidencePackItem>;
  analysisAsOf: string;
}) {
  const story = input.story;
  const latestEvidenceAt = latestTimestamp(input.evidenceIds.flatMap((id) => input.evidenceById.has(id) ? [input.evidenceById.get(id)!] : []));
  const rows = await intelligenceRest<Array<{ id: string }>>(
    `intelligence_story_states?select=id&story_id=eq.${encodeURIComponent(story.id)}&limit=1`,
  );
  const payload = {
    lifecycle_status: lifecycleFor(input.assessment.disposition, story.status),
    publication_eligible: input.assessment.disposition !== "invalidated",
    event_signature: `maintenance:${hash(`${story.id}|${input.assessment.whatChanged}`, 24)}`,
    thesis_signature: hash(input.assessment.materialChange ? input.assessment.thesis : story.thesis),
    causal_mechanism: input.assessment.causalMechanism,
    affected_assets: story.assets ?? [],
    decisive_evidence_ids: input.evidenceIds,
    confirmation_criteria: input.assessment.confirmationTrigger ? [input.assessment.confirmationTrigger] : [],
    invalidation_criteria: input.assessment.invalidationTrigger ? [input.assessment.invalidationTrigger] : [],
    next_catalysts: input.assessment.nextCatalyst ? [input.assessment.nextCatalyst] : [],
    research_synthesis: `${input.assessment.whatChanged}\nCountercase: ${input.assessment.strongestCountercase}`,
    last_evidence_at: latestEvidenceAt,
    last_evaluated_at: input.analysisAsOf,
    strongest_support: input.assessment.strongestSupport,
    strongest_contradiction: input.assessment.strongestContradiction,
    updated_at: input.analysisAsOf,
  };
  if (rows[0]?.id) {
    await intelligenceRest(`intelligence_story_states?id=eq.${encodeURIComponent(rows[0].id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    return;
  }
  await intelligenceRest("intelligence_story_states", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ story_id: story.id, qualification_score: 50, ...payload }),
  });
}

async function applyMaterialRevision(input: {
  story: MaintenanceStory;
  assessment: StoryMaintenanceAssessment;
  evidenceIds: string[];
  engineRunId: string;
  stageRunId: string;
  analysisAsOf: string;
}) {
  const latest = await intelligenceRest<Array<{ id: string; version_number: number; snapshot: Record<string, unknown> | null }>>(
    `story_thesis_versions?select=id,version_number,snapshot&story_id=eq.${encodeURIComponent(input.story.id)}&order=version_number.desc&limit=1`,
  );
  const alreadyApplied = latest[0]?.snapshot?.maintenanceStageRunId === input.stageRunId;
  let versionId = latest[0]?.id ?? null;
  if (!alreadyApplied) {
    const events = await intelligenceRest<Array<{ id: string }>>("story_events", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        story_id: input.story.id,
        evidence_id: input.evidenceIds[0] ?? null,
        research_run_id: null,
        event_type: input.assessment.disposition === "invalidated" ? "invalidation" : input.assessment.disposition === "reinforced" ? "confirmation" : "thesis_revision",
        headline: input.assessment.whatChanged.slice(0, 180),
        detail: `${input.assessment.acceptedExplanation}\n\nCountercase: ${input.assessment.strongestCountercase}`,
        confidence_delta: finiteConfidence(input.assessment.confidence, input.story.confidence) - input.story.confidence,
        event_at: input.analysisAsOf,
        metadata: {
          automatic: true,
          origin: "existing_story_maintenance",
          maintenanceEngineRunId: input.engineRunId,
          maintenanceStageRunId: input.stageRunId,
          disposition: input.assessment.disposition,
          evidenceIds: input.evidenceIds,
          marketReaction: input.assessment.marketReaction,
          changeKinds: input.assessment.changeKinds,
        },
      }),
    });
    const versions = await intelligenceRest<Array<{ id: string }>>("story_thesis_versions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        story_id: input.story.id,
        event_id: events[0]?.id ?? null,
        version_number: (latest[0]?.version_number ?? 0) + 1,
        title: input.story.title,
        thesis: input.assessment.thesis,
        status: publicStatusFor(input.assessment.disposition, input.story.status),
        confidence: finiteConfidence(input.assessment.confidence, input.story.confidence),
        market_question: input.story.market_question,
        dominant_narrative: input.assessment.acceptedExplanation || input.story.dominant_narrative,
        best_explanation: input.assessment.causalMechanism,
        strongest_support: input.assessment.strongestSupport,
        strongest_contradiction: input.assessment.strongestContradiction,
        priced_assessment: input.assessment.pricedAssessment,
        confirmation_trigger: input.assessment.confirmationTrigger,
        invalidation_trigger: input.assessment.invalidationTrigger,
        next_catalyst: input.assessment.nextCatalyst,
        article_angle: `${input.assessment.whatChanged}\n\nMarket reaction: ${input.assessment.marketReaction}\n\nCountercase: ${input.assessment.strongestCountercase}`,
        provisional_title: input.story.title,
        article_verdict: "story_maintenance",
        assets: input.story.assets ?? [],
        snapshot: {
          origin: "existing_story_maintenance",
          maintenanceEngineRunId: input.engineRunId,
          maintenanceStageRunId: input.stageRunId,
          disposition: input.assessment.disposition,
          evidenceIds: input.evidenceIds,
          marketReaction: input.assessment.marketReaction,
          changeKinds: input.assessment.changeKinds,
          priorVersion: latest[0]?.version_number ?? null,
        },
        change_reason: "material_evidence_recalibration",
        effective_at: input.analysisAsOf,
      }),
    });
    versionId = versions[0]?.id ?? null;
  }

  const updated = await intelligenceRest<MaintenanceStory[]>(`stories?id=eq.${encodeURIComponent(input.story.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      thesis: input.assessment.thesis,
      status: publicStatusFor(input.assessment.disposition, input.story.status),
      confidence: finiteConfidence(input.assessment.confidence, input.story.confidence),
      dominant_narrative: input.assessment.acceptedExplanation || input.story.dominant_narrative,
      best_explanation: input.assessment.causalMechanism,
      strongest_support: input.assessment.strongestSupport,
      strongest_contradiction: input.assessment.strongestContradiction,
      priced_assessment: input.assessment.pricedAssessment,
      confirmation_trigger: input.assessment.confirmationTrigger,
      invalidation_trigger: input.assessment.invalidationTrigger,
      next_catalyst: input.assessment.nextCatalyst,
      ...(versionId ? { current_thesis_version_id: versionId } : {}),
      updated_at: input.analysisAsOf,
    }),
  });
  await intelligenceRest("story_updates", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      story_id: input.story.id,
      update_type: input.assessment.disposition === "invalidated" ? "invalidation" : input.assessment.disposition === "reinforced" ? "confirmation" : "recalibration",
      headline: input.assessment.whatChanged.slice(0, 90),
      detail: `${input.assessment.acceptedExplanation}\n\nCountercase: ${input.assessment.strongestCountercase}`,
      observed_at: input.analysisAsOf,
    }),
  });
  return updated[0] ?? { ...input.story, thesis: input.assessment.thesis, confidence: finiteConfidence(input.assessment.confidence, input.story.confidence) };
}

async function readMaintenanceMarker(engineRunId: string) {
  const rows = await intelligenceRest<Array<{ metadata: Record<string, unknown> | null }>>(
    `intelligence_engine_runs?select=metadata&id=eq.${encodeURIComponent(engineRunId)}&limit=1`,
  );
  const metadata = rows[0]?.metadata ?? {};
  const marker = metadata.storyMaintenance;
  return {
    metadata,
    marker: marker && typeof marker === "object" && !Array.isArray(marker) ? marker as Record<string, unknown> : null,
  };
}

export async function persistStoryMaintenanceAssessments(input: {
  engineRunId: string;
  stageRunId: string;
  assessments: StoryMaintenanceAssessment[] | undefined;
  stories: MaintenanceStory[];
  targets: StoryReviewTarget[];
  evidenceById: Map<string, EvidencePackItem>;
  analysisAsOf: string;
  dryRun: boolean;
}) {
  const markerState = await readMaintenanceMarker(input.engineRunId);
  if (markerState.marker?.stageRunId === input.stageRunId) {
    return {
      evaluatedStoryIds: Array.isArray(markerState.marker.evaluatedStoryIds) ? markerState.marker.evaluatedStoryIds.filter((id): id is string => typeof id === "string") : [],
      materiallyChangedStoryIds: Array.isArray(markerState.marker.materiallyChangedStoryIds) ? markerState.marker.materiallyChangedStoryIds.filter((id): id is string => typeof id === "string") : [],
      updatedStories: [] as MaintenanceStory[],
      reused: true,
    };
  }

  const storyById = new Map(input.stories.map((story) => [story.id, story]));
  const targetById = new Map(input.targets.map((target) => [target.story.id, target]));
  const evaluatedStoryIds: string[] = [];
  const materiallyChangedStoryIds: string[] = [];
  const updatedStories: MaintenanceStory[] = [];

  for (const assessment of input.assessments ?? []) {
    const story = storyById.get(assessment.storyId);
    const target = targetById.get(assessment.storyId);
    if (!story || !target) continue;
    const allowedIds = new Set(target.evidence.map((item) => item.id));
    const roles = evidenceRoleSets(assessment, allowedIds);
    if (!roles.all.length) continue;
    evaluatedStoryIds.push(story.id);
    const requestedMaterialChange = Boolean(assessment.materialChange) && assessment.disposition !== "unchanged";
    const materialChange = requestedMaterialChange && materialEvidenceAllowed(roles.all, input.evidenceById);

    if (!input.dryRun) {
      await linkStoryEvidence(story.id, roles);
      await writeStoryState({ story, assessment: { ...assessment, materialChange }, evidenceIds: roles.all, evidenceById: input.evidenceById, analysisAsOf: input.analysisAsOf });
      if (materialChange) {
        const updated = await applyMaterialRevision({
          story,
          assessment: { ...assessment, materialChange: true },
          evidenceIds: roles.all,
          engineRunId: input.engineRunId,
          stageRunId: input.stageRunId,
          analysisAsOf: input.analysisAsOf,
        });
        updatedStories.push(updated);
        materiallyChangedStoryIds.push(story.id);
      }
    } else if (materialChange) {
      materiallyChangedStoryIds.push(story.id);
    }
  }

  if (!input.dryRun) {
    const metadata = markerState.metadata;
    await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(input.engineRunId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        metadata: {
          ...metadata,
          storyMaintenance: {
            stageRunId: input.stageRunId,
            evaluatedStoryIds: unique(evaluatedStoryIds),
            materiallyChangedStoryIds: unique(materiallyChangedStoryIds),
            appliedAt: input.analysisAsOf,
          },
        },
      }),
    });
  }

  return {
    evaluatedStoryIds: unique(evaluatedStoryIds),
    materiallyChangedStoryIds: unique(materiallyChangedStoryIds),
    updatedStories,
    reused: false,
  };
}
