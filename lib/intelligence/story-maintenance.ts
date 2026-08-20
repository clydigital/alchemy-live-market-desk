import "server-only";

import { createHash } from "node:crypto";

import type { EvidencePackItem, MarketBeliefOutput } from "@/lib/intelligence/schemas";
import {
  effectiveMaintenanceDisposition,
  materialDecisiveEvidenceIds,
  materialMutationAuthorised,
  type MaintenanceDisposition,
} from "@/lib/intelligence/story-maintenance-policy";
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
  disposition: MaintenanceDisposition;
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
      maxItems: 4,
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
- Compare only the evidence supplied inside that target with the Story's current thesis, support, contradiction, catalyst, confirmation and invalidation.
- Distinguish a macro-driven price move from a change in the underlying Story fundamentals.
- Reconstruct the causal chain explicitly: driver -> mechanism -> market reaction -> implication.
- Distinguish the accepted headline explanation from the actual mechanism and scale supported by evidence.
- Capture observable thresholds, catalysts and next tests when supplied by evidence.
- Include the strongest case for why the existing thesis may still be right.
- Creator/video commentary is a research lead only. It can contextualise or suggest a test, but by itself it MUST NOT set materialChange=true.
- Set materialChange=false when evidence merely repeats, confirms without changing probability/conditions, or leaves the thesis intact.
- Set materialChange=true only when evidence changes the thesis, probability/confidence materially, confirmation/invalidation state, causal mechanism, next catalyst, or cross-asset transmission.
- Return exactly one assessment for every supplied target. Do not return an assessment for any Story that was not supplied as a target.
- Only use evidence IDs included inside that target.
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
  const maxStories = Math.max(1, Math.min(4, input.maxStories ?? 4));
  const maxEvidence = Math.max(1, Math.min(12, input.maxEvidencePerStory ?? 10));

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

function lifecycleFor(disposition: MaintenanceDisposition, currentStatus: string) {
  if (disposition === "invalidated") return "invalidated";
  if (disposition === "weakened") return "weakening";
  if (disposition === "reinforced") return currentStatus === "publish" ? "confirmed" : "developing";
  if (disposition === "reframed") return "developing";
  return currentStatus === "publish" ? "confirmed" : currentStatus === "develop" ? "developing" : "detected";
}

function publicStatusFor(disposition: MaintenanceDisposition, currentStatus: string) {
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

function ancestryGroups(ids: string[], evidenceById: Map<string, EvidencePackItem>) {
  return unique(ids.flatMap((id) => {
    const ancestry = evidenceById.get(id)?.ancestryGroupId;
    return ancestry ? [ancestry] : [];
  }));
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

type ExistingState = {
  id: string;
  lifecycle_status: string;
  publication_eligible: boolean;
  decisive_evidence_ids: string[];
  source_ancestry_group_ids: string[];
  last_evidence_at: string | null;
};

async function writeStoryState(input: {
  story: MaintenanceStory;
  assessment: StoryMaintenanceAssessment;
  materialChange: boolean;
  decisiveEvidenceIds: string[];
  allEvidenceIds: string[];
  evidenceById: Map<string, EvidencePackItem>;
  analysisAsOf: string;
}) {
  const story = input.story;
  const latestEvidenceAt = latestTimestamp(input.allEvidenceIds.flatMap((id) => input.evidenceById.has(id) ? [input.evidenceById.get(id)!] : []));
  const rows = await intelligenceRest<ExistingState[]>(
    `intelligence_story_states?select=id,lifecycle_status,publication_eligible,decisive_evidence_ids,source_ancestry_group_ids,last_evidence_at&story_id=eq.${encodeURIComponent(story.id)}&limit=1`,
  );
  const existing = rows[0];

  // No material thesis change: advance only freshness/watermark fields. This is
  // the key distinction between "reviewed and unchanged" and "not reviewed".
  if (existing && !input.materialChange) {
    await intelligenceRest(`intelligence_story_states?id=eq.${encodeURIComponent(existing.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        last_evidence_at: latestEvidenceAt || existing.last_evidence_at,
        last_evaluated_at: input.analysisAsOf,
        updated_at: input.analysisAsOf,
      }),
    });
    return;
  }

  if (!existing && !input.materialChange) {
    await intelligenceRest("intelligence_story_states", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        story_id: story.id,
        lifecycle_status: lifecycleFor("unchanged", story.status),
        publication_eligible: story.status !== "archived" && story.status !== "discarded",
        qualification_score: 50,
        event_signature: `maintenance:init:${hash(story.id, 24)}`,
        thesis_signature: hash(story.thesis),
        causal_mechanism: "",
        affected_assets: story.assets ?? [],
        decisive_evidence_ids: [],
        source_ancestry_group_ids: [],
        confirmation_criteria: story.confirmation_trigger ? [story.confirmation_trigger] : [],
        invalidation_criteria: story.invalidation_trigger ? [story.invalidation_trigger] : [],
        next_catalysts: story.next_catalyst ? [story.next_catalyst] : [],
        research_synthesis: "Existing Story reviewed against fresh routed evidence; no material canonical thesis change was authorised.",
        last_evidence_at: latestEvidenceAt,
        last_evaluated_at: input.analysisAsOf,
        strongest_support: story.strongest_support,
        strongest_contradiction: story.strongest_contradiction,
        updated_at: input.analysisAsOf,
      }),
    });
    return;
  }

  const payload = {
    lifecycle_status: lifecycleFor(input.assessment.disposition, story.status),
    publication_eligible: input.assessment.disposition !== "invalidated",
    event_signature: `maintenance:${hash(`${story.id}|${input.assessment.whatChanged}`, 24)}`,
    thesis_signature: hash(input.assessment.thesis),
    causal_mechanism: input.assessment.causalMechanism,
    affected_assets: story.assets ?? [],
    decisive_evidence_ids: input.decisiveEvidenceIds,
    source_ancestry_group_ids: ancestryGroups(input.decisiveEvidenceIds, input.evidenceById),
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
  if (existing) {
    await intelligenceRest(`intelligence_story_states?id=eq.${encodeURIComponent(existing.id)}`, {
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

async function findMaintenanceEvent(input: { storyId: string; analysisAsOf: string; stageRunId: string }) {
  const rows = await intelligenceRest<Array<{ id: string; metadata: Record<string, unknown> | null }>>(
    `story_events?select=id,metadata&story_id=eq.${encodeURIComponent(input.storyId)}&event_at=eq.${encodeURIComponent(input.analysisAsOf)}&limit=20`,
  );
  return rows.find((row) => row.metadata?.maintenanceStageRunId === input.stageRunId)?.id ?? null;
}

async function ensureStoryUpdate(input: {
  storyId: string;
  updateType: string;
  headline: string;
  detail: string;
  observedAt: string;
}) {
  const existing = await intelligenceRest<Array<{ id: string }>>(
    `story_updates?select=id&story_id=eq.${encodeURIComponent(input.storyId)}&observed_at=eq.${encodeURIComponent(input.observedAt)}&headline=eq.${encodeURIComponent(input.headline)}&limit=1`,
  );
  if (existing[0]) return;
  await intelligenceRest("story_updates", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      story_id: input.storyId,
      update_type: input.updateType,
      headline: input.headline,
      detail: input.detail,
      observed_at: input.observedAt,
    }),
  });
}

async function applyMaterialRevision(input: {
  story: MaintenanceStory;
  assessment: StoryMaintenanceAssessment;
  evidenceIds: string[];
  engineRunId: string;
  stageRunId: string;
  researchRunId: string | null;
  analysisAsOf: string;
}) {
  const latest = await intelligenceRest<Array<{ id: string; version_number: number; snapshot: Record<string, unknown> | null }>>(
    `story_thesis_versions?select=id,version_number,snapshot&story_id=eq.${encodeURIComponent(input.story.id)}&order=version_number.desc&limit=1`,
  );
  const alreadyApplied = latest[0]?.snapshot?.maintenanceStageRunId === input.stageRunId;
  let versionId = alreadyApplied ? latest[0]?.id ?? null : null;
  if (!alreadyApplied) {
    let eventId = await findMaintenanceEvent({ storyId: input.story.id, analysisAsOf: input.analysisAsOf, stageRunId: input.stageRunId });
    if (!eventId) {
      const events = await intelligenceRest<Array<{ id: string }>>("story_events", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          story_id: input.story.id,
          evidence_id: input.evidenceIds[0] ?? null,
          research_run_id: input.researchRunId,
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
      eventId = events[0]?.id ?? null;
    }
    const versions = await intelligenceRest<Array<{ id: string }>>("story_thesis_versions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        story_id: input.story.id,
        event_id: eventId,
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
  await ensureStoryUpdate({
    storyId: input.story.id,
    updateType: input.assessment.disposition === "invalidated" ? "invalidation" : input.assessment.disposition === "reinforced" ? "confirmation" : "recalibration",
    headline: input.assessment.whatChanged.slice(0, 90),
    detail: `${input.assessment.acceptedExplanation}\n\nCountercase: ${input.assessment.strongestCountercase}`,
    observedAt: input.analysisAsOf,
  });
  return updated[0] ?? { ...input.story, thesis: input.assessment.thesis, confidence: finiteConfidence(input.assessment.confidence, input.story.confidence) };
}

async function readMaintenanceMarker(engineRunId: string) {
  const rows = await intelligenceRest<Array<{ research_run_id: string | null; metadata: Record<string, unknown> | null }>>(
    `intelligence_engine_runs?select=research_run_id,metadata&id=eq.${encodeURIComponent(engineRunId)}&limit=1`,
  );
  const metadata = rows[0]?.metadata ?? {};
  const marker = metadata.storyMaintenance;
  return {
    researchRunId: rows[0]?.research_run_id ?? null,
    metadata,
    marker: marker && typeof marker === "object" && !Array.isArray(marker) ? marker as Record<string, unknown> : null,
  };
}

function markerIds(marker: Record<string, unknown> | null, key: string) {
  const value = marker?.[key];
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
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
      evaluatedStoryIds: markerIds(markerState.marker, "evaluatedStoryIds"),
      materiallyChangedStoryIds: markerIds(markerState.marker, "materiallyChangedStoryIds"),
      missingTargetStoryIds: markerIds(markerState.marker, "missingTargetStoryIds"),
      rejectedMaterialStoryIds: markerIds(markerState.marker, "rejectedMaterialStoryIds"),
      updatedStories: [] as MaintenanceStory[],
      reused: true,
    };
  }

  const storyById = new Map(input.stories.map((story) => [story.id, story]));
  const assessmentGroups = new Map<string, StoryMaintenanceAssessment[]>();
  for (const assessment of input.assessments ?? []) {
    const values = assessmentGroups.get(assessment.storyId) ?? [];
    values.push(assessment);
    assessmentGroups.set(assessment.storyId, values);
  }
  const evaluatedStoryIds: string[] = [];
  const materiallyChangedStoryIds: string[] = [];
  const missingTargetStoryIds: string[] = [];
  const rejectedMaterialStoryIds: string[] = [];
  const updatedStories: MaintenanceStory[] = [];

  // Iterate the deterministic target list, not arbitrary model output. A target
  // is only marked evaluated when exactly one valid assessment is returned.
  for (const target of input.targets) {
    const story = storyById.get(target.story.id);
    const matching = assessmentGroups.get(target.story.id) ?? [];
    if (!story || matching.length !== 1) {
      missingTargetStoryIds.push(target.story.id);
      continue;
    }
    const assessment = matching[0];
    const allowedIds = new Set(target.evidence.map((item) => item.id));
    const roles = evidenceRoleSets(assessment, allowedIds);
    if (!roles.all.length) {
      missingTargetStoryIds.push(story.id);
      continue;
    }

    const requestedMaterialChange = Boolean(assessment.materialChange) && assessment.disposition !== "unchanged";
    const authorised = materialMutationAuthorised({
      disposition: assessment.disposition,
      evidenceIds: roles.all,
      evidenceById: input.evidenceById,
    });
    const materialChange = requestedMaterialChange && authorised;
    const effectiveDisposition = effectiveMaintenanceDisposition({
      disposition: assessment.disposition,
      requestedMaterialChange,
      authorised,
    });
    const effectiveAssessment: StoryMaintenanceAssessment = {
      ...assessment,
      disposition: effectiveDisposition,
      materialChange,
    };
    const decisiveEvidenceIds = materialChange
      ? materialDecisiveEvidenceIds({ supporting: roles.supporting, contradicting: roles.contradicting })
      : [];
    if (requestedMaterialChange && !materialChange) rejectedMaterialStoryIds.push(story.id);
    evaluatedStoryIds.push(story.id);

    if (!input.dryRun) {
      await linkStoryEvidence(story.id, roles);
      await writeStoryState({
        story,
        assessment: effectiveAssessment,
        materialChange,
        decisiveEvidenceIds,
        allEvidenceIds: roles.all,
        evidenceById: input.evidenceById,
        analysisAsOf: input.analysisAsOf,
      });
      if (materialChange) {
        const updated = await applyMaterialRevision({
          story,
          assessment: effectiveAssessment,
          evidenceIds: decisiveEvidenceIds,
          engineRunId: input.engineRunId,
          stageRunId: input.stageRunId,
          researchRunId: markerState.researchRunId,
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
    await intelligenceRest(`intelligence_engine_runs?id=eq.${encodeURIComponent(input.engineRunId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        metadata: {
          ...markerState.metadata,
          storyMaintenance: {
            stageRunId: input.stageRunId,
            evaluatedStoryIds: unique(evaluatedStoryIds),
            materiallyChangedStoryIds: unique(materiallyChangedStoryIds),
            missingTargetStoryIds: unique(missingTargetStoryIds),
            rejectedMaterialStoryIds: unique(rejectedMaterialStoryIds),
            appliedAt: input.analysisAsOf,
          },
        },
      }),
    });
  }

  return {
    evaluatedStoryIds: unique(evaluatedStoryIds),
    materiallyChangedStoryIds: unique(materiallyChangedStoryIds),
    missingTargetStoryIds: unique(missingTargetStoryIds),
    rejectedMaterialStoryIds: unique(rejectedMaterialStoryIds),
    updatedStories,
    reused: false,
  };
}
