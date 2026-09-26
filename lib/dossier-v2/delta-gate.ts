import type { SupabaseClient } from "@supabase/supabase-js";

import type { MarketDossierV2 } from "./contracts.ts";
import type { DossierV2InputPacket } from "./input-packet.ts";
import {
  MAX_MAJOR_STORIES,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
  type MajorStory,
  type ResearchBrainOutputV1,
  type ThesisLedgerEntryV2,
} from "./research-brain-contracts.ts";
import {
  buildValidationIndexes,
  validateResearchBrainOutput,
} from "./research-brain-validation.ts";

export type DossierDeltaAction = "NO_CHANGE" | "PATCH" | "REBASE";
export type DossierDeltaMode = "auto" | "rebase";

export type DossierIntelligenceState = {
  story_id: string;
  lifecycle_status: string | null;
  publication_eligible: boolean | null;
  qualification_score: number | null;
  thesis_signature: string | null;
  causal_mechanism: string | null;
  affected_assets: string[] | null;
  decisive_evidence_ids: string[] | null;
  source_ancestry_group_ids: string[] | null;
  confirmation_criteria: string[] | null;
  invalidation_criteria: string[] | null;
  next_catalysts: string[] | null;
  novelty_class: string | null;
  research_synthesis: string | null;
  market_belief: string | null;
  divergence_summary: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  last_material_update_at: string | null;
  last_evidence_at: string | null;
  last_evaluated_at: string | null;
};

export type DossierStoryRecord = {
  id: string;
  title: string;
  thesis: string;
  market_question: string | null;
  best_explanation: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  assets: string[] | null;
  confidence: number | null;
};

export type DossierDeltaContext = {
  available: boolean;
  states: DossierIntelligenceState[];
  stories: DossierStoryRecord[];
  warning: string | null;
};

export type DossierDeltaDecision = {
  action: DossierDeltaAction;
  reason: string;
  previousDossierId: string | null;
  previousAsOf: string | null;
  changedStoryIds: string[];
  newObservedEvidence: number;
  postIntelligenceModelCallBudget: 0 | 2;
  validationErrors?: string[];
};

export type DeterministicPatchResult = {
  output: ResearchBrainOutputV1 | null;
  errors: string[];
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))]
    : [];
}

function previousAnalyticalOutput(
  dossier: MarketDossierV2 | null,
): ResearchBrainOutputV1 | null {
  const analytical = dossier?.payload?.analytical_output;
  if (!analytical || typeof analytical !== "object" || Array.isArray(analytical)) {
    return null;
  }
  return cloneJson(analytical as ResearchBrainOutputV1);
}

function evidenceAncestryKey(
  packet: DossierV2InputPacket,
  evidenceId: string,
): string | null {
  const evidence = [
    ...packet.observed_evidence,
    ...(packet.rate_context?.evidence ?? []),
  ].find((item) => item.evidence_id === evidenceId);
  const provenance = evidence?.provenance?.[0];
  if (!evidence || !provenance) return null;
  return [
    provenance.publisher ?? "",
    provenance.source_type ?? evidence.source_type,
    provenance.source_id,
  ].join(":").toUpperCase();
}

function independentEvidenceCount(
  packet: DossierV2InputPacket,
  evidenceIds: string[],
): number {
  return new Set(
    evidenceIds
      .map((id) => evidenceAncestryKey(packet, id))
      .filter((value): value is string => Boolean(value)),
  ).size;
}

function newObservedEvidenceCount(
  packet: DossierV2InputPacket,
  previousAsOf: string | null,
): number {
  if (!previousAsOf) return packet.observed_evidence.length;
  const cutoff = Date.parse(previousAsOf);
  if (!Number.isFinite(cutoff)) return packet.observed_evidence.length;
  return packet.observed_evidence.filter((item) => {
    const availableAt = Date.parse(item.available_at);
    return Number.isFinite(availableAt) && availableAt > cutoff;
  }).length;
}

function previousMajorStoryIds(output: ResearchBrainOutputV1 | null): Set<string> {
  return new Set([
    ...(output?.major_stories ?? []).map((story) => story.story_id),
    ...(output?.main_thread?.supporting_story_ids ?? []),
  ]);
}

function changedRelevantStates(
  context: DossierDeltaContext,
  priorStoryIds: Set<string>,
): DossierIntelligenceState[] {
  return context.states.filter((state) =>
    state.publication_eligible === true || priorStoryIds.has(state.story_id)
  );
}

function stateEvidenceIds(
  state: DossierIntelligenceState,
  packet: DossierV2InputPacket,
): string[] {
  const valid = new Set([
    ...packet.observed_evidence.map((item) => item.evidence_id),
    ...(packet.rate_context?.evidence ?? []).map((item) => item.evidence_id),
  ]);
  return stringArray(state.decisive_evidence_ids).filter((id) => valid.has(id));
}

function isTerminalLifecycle(value: string | null): boolean {
  const lifecycle = String(value ?? "").toLowerCase();
  return lifecycle.includes("invalid") || lifecycle.includes("archive");
}

function lifecycleThesisState(
  value: string | null,
): ThesisLedgerEntryV2["state"] {
  const lifecycle = String(value ?? "").toLowerCase();
  if (lifecycle.includes("confirm")) return "confirmed";
  if (lifecycle.includes("weaken")) return "weakened";
  if (lifecycle.includes("invalid") || lifecycle.includes("archive")) return "invalidated";
  return "unresolved";
}

function priorStoryById(
  output: ResearchBrainOutputV1,
  storyId: string,
): MajorStory | null {
  return output.major_stories.find((story) => story.story_id === storyId) ?? null;
}

function priorLedgerEntry(
  output: ResearchBrainOutputV1,
  thesisId: string,
): ThesisLedgerEntryV2 | null {
  return output.thesis_ledger.entries.find((entry) => entry.thesis_id === thesisId) ?? null;
}

export async function loadDossierDeltaContext(
  client: SupabaseClient,
  previousDossier: MarketDossierV2 | null,
): Promise<DossierDeltaContext> {
  if (!previousDossier) {
    return { available: true, states: [], stories: [], warning: null };
  }

  try {
    const { data: states, error } = await client
      .from("intelligence_story_states")
      .select(
        "story_id,lifecycle_status,publication_eligible,qualification_score,thesis_signature,causal_mechanism,affected_assets,decisive_evidence_ids,source_ancestry_group_ids,confirmation_criteria,invalidation_criteria,next_catalysts,novelty_class,research_synthesis,market_belief,divergence_summary,strongest_support,strongest_contradiction,last_material_update_at,last_evidence_at,last_evaluated_at",
      )
      .gt("last_material_update_at", previousDossier.as_of)
      .order("last_material_update_at", { ascending: false })
      .limit(12);

    if (error) {
      return {
        available: false,
        states: [],
        stories: [],
        warning: `Failed to read canonical intelligence story deltas: ${error.message}`,
      };
    }

    const typedStates = (states ?? []) as DossierIntelligenceState[];
    const rawEvidenceIds = [...new Set(
      typedStates.flatMap((state) => stringArray(state.decisive_evidence_ids)),
    )];
    const evidenceIdMap = new Map<string, string>();
    if (rawEvidenceIds.length > 0) {
      const { data: evidenceRows, error: evidenceError } = await client
        .from("intelligence_evidence")
        .select("id,external_evidence_id")
        .in("id", rawEvidenceIds);
      if (evidenceError) {
        return {
          available: false,
          states: typedStates,
          stories: [],
          warning: `Failed to translate intelligence evidence IDs for Dossier delta: ${evidenceError.message}`,
        };
      }
      for (const row of evidenceRows ?? []) {
        if (typeof row.id !== "string") continue;
        const packetEvidenceId =
          typeof row.external_evidence_id === "string" && row.external_evidence_id.trim()
            ? row.external_evidence_id.trim()
            : `ev:${row.id}`;
        evidenceIdMap.set(row.id, packetEvidenceId);
      }
    }

    const mappedStates = typedStates.map((state) => ({
      ...state,
      decisive_evidence_ids: stringArray(state.decisive_evidence_ids).map(
        (id) => evidenceIdMap.get(id) ?? id,
      ),
    }));
    const ids = [...new Set(mappedStates.map((state) => state.story_id).filter(Boolean))];
    if (ids.length === 0) {
      return { available: true, states: [], stories: [], warning: null };
    }

    const { data: stories, error: storyError } = await client
      .from("stories")
      .select(
        "id,title,thesis,market_question,best_explanation,strongest_support,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,assets,confidence",
      )
      .in("id", ids);

    if (storyError) {
      return {
        available: false,
        states: mappedStates,
        stories: [],
        warning: `Failed to read canonical Story records for Dossier delta: ${storyError.message}`,
      };
    }

    return {
      available: true,
      states: mappedStates,
      stories: (stories ?? []) as DossierStoryRecord[],
      warning: null,
    };
  } catch (error) {
    return {
      available: false,
      states: [],
      stories: [],
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

export function decideDossierDelta({
  packet,
  previousDossier,
  context,
}: {
  packet: DossierV2InputPacket;
  previousDossier: MarketDossierV2 | null;
  context: DossierDeltaContext;
}): DossierDeltaDecision {
  const previousOutput = previousAnalyticalOutput(previousDossier);
  const priorStoryIds = previousMajorStoryIds(previousOutput);
  const newEvidence = newObservedEvidenceCount(packet, previousDossier?.as_of ?? null);

  if (!previousDossier || !previousOutput) {
    return {
      action: "REBASE",
      reason: "No valid prior Dossier analytical state is available.",
      previousDossierId: previousDossier?.id ?? null,
      previousAsOf: previousDossier?.as_of ?? null,
      changedStoryIds: [],
      newObservedEvidence: newEvidence,
      postIntelligenceModelCallBudget: 2,
    };
  }

  if (!context.available) {
    return {
      action: "REBASE",
      reason: context.warning || "Canonical intelligence delta state is unavailable.",
      previousDossierId: previousDossier.id,
      previousAsOf: previousDossier.as_of,
      changedStoryIds: [],
      newObservedEvidence: newEvidence,
      postIntelligenceModelCallBudget: 2,
    };
  }

  const relevant = changedRelevantStates(context, priorStoryIds);
  const changedStoryIds = relevant.map((state) => state.story_id);

  if (relevant.length === 0) {
    return {
      action: "NO_CHANGE",
      reason: newEvidence > 0
        ? "New canonical evidence produced no material canonical Story change."
        : "No new material canonical Story state was produced.",
      previousDossierId: previousDossier.id,
      previousAsOf: previousDossier.as_of,
      changedStoryIds: [],
      newObservedEvidence: newEvidence,
      postIntelligenceModelCallBudget: 0,
    };
  }

  if (relevant.some((state) => priorStoryIds.has(state.story_id) && isTerminalLifecycle(state.lifecycle_status))) {
    return {
      action: "REBASE",
      reason: "A Story represented in the current Dossier was invalidated or archived.",
      previousDossierId: previousDossier.id,
      previousAsOf: previousDossier.as_of,
      changedStoryIds,
      newObservedEvidence: newEvidence,
      postIntelligenceModelCallBudget: 2,
    };
  }

  const highDivergenceCount = relevant.filter((state) =>
    (state.qualification_score ?? 0) >= 85 && Boolean(state.divergence_summary?.trim())
  ).length;
  if (relevant.length > 2 || highDivergenceCount >= 2) {
    return {
      action: "REBASE",
      reason: "Multiple material Story changes require a fresh regime-level synthesis.",
      previousDossierId: previousDossier.id,
      previousAsOf: previousDossier.as_of,
      changedStoryIds,
      newObservedEvidence: newEvidence,
      postIntelligenceModelCallBudget: 2,
    };
  }

  const storyById = new Map(context.stories.map((story) => [story.id, story]));
  for (const state of relevant) {
    const story = storyById.get(state.story_id);
    const evidenceIds = stateEvidenceIds(state, packet);
    if (!story || state.publication_eligible !== true || (state.qualification_score ?? 0) < 60) {
      return {
        action: "REBASE",
        reason: `Story ${state.story_id} cannot be safely patched from canonical intelligence state.`,
        previousDossierId: previousDossier.id,
        previousAsOf: previousDossier.as_of,
        changedStoryIds,
        newObservedEvidence: newEvidence,
        postIntelligenceModelCallBudget: 2,
      };
    }
    if (evidenceIds.length < 2 || independentEvidenceCount(packet, evidenceIds) < 2) {
      return {
        action: "REBASE",
        reason: `Story ${state.story_id} lacks two current independent canonical evidence ancestries for a deterministic patch.`,
        previousDossierId: previousDossier.id,
        previousAsOf: previousDossier.as_of,
        changedStoryIds,
        newObservedEvidence: newEvidence,
        postIntelligenceModelCallBudget: 2,
      };
    }

    const existing = priorStoryById(previousOutput, state.story_id);
    const linkedThesisId = existing?.linked_thesis_ids?.[0] ?? null;
    if (!linkedThesisId && previousOutput.thesis_ledger.entries.length >= 12) {
      return {
        action: "REBASE",
        reason: "The thesis ledger is already at capacity and a new Story thesis would require structural reprioritisation.",
        previousDossierId: previousDossier.id,
        previousAsOf: previousDossier.as_of,
        changedStoryIds,
        newObservedEvidence: newEvidence,
        postIntelligenceModelCallBudget: 2,
      };
    }
    if (linkedThesisId && priorLedgerEntry(previousOutput, linkedThesisId)?.state === "evolved") {
      return {
        action: "REBASE",
        reason: `Story ${state.story_id} is linked to an evolved thesis lineage that requires full synthesis.`,
        previousDossierId: previousDossier.id,
        previousAsOf: previousDossier.as_of,
        changedStoryIds,
        newObservedEvidence: newEvidence,
        postIntelligenceModelCallBudget: 2,
      };
    }
  }

  return {
    action: "PATCH",
    reason: "One or two qualified canonical Stories changed with sufficient current independent evidence.",
    previousDossierId: previousDossier.id,
    previousAsOf: previousDossier.as_of,
    changedStoryIds,
    newObservedEvidence: newEvidence,
    postIntelligenceModelCallBudget: 0,
  };
}

function pruneOutputToPacket(
  output: ResearchBrainOutputV1,
  packet: DossierV2InputPacket,
): ResearchBrainOutputV1 {
  const next = cloneJson(output);
  const indexes = buildValidationIndexes(packet);
  const validEvidence = (ids: string[]) => ids.filter((id) => indexes.validEvidenceIds.has(id));
  const validEvidenceOrLead = (ids: string[]) => ids.filter((id) =>
    indexes.validEvidenceIds.has(id) || indexes.validLeadIds.has(id)
  );

  next.main_thread.evidence_references = validEvidence(next.main_thread.evidence_references);
  next.major_stories = next.major_stories.flatMap((story) => {
    const evidenceIds = validEvidence(story.evidence_ids);
    const confirming = validEvidence(story.market_evidence.confirming);
    if (!evidenceIds.length || !confirming.length) return [];
    return [{
      ...story,
      evidence_ids: evidenceIds,
      market_evidence: {
        confirming,
        contradicting: validEvidence(story.market_evidence.contradicting),
        unresolved: validEvidenceOrLead(story.market_evidence.unresolved),
      },
    }];
  });

  const storyIds = new Set(next.major_stories.map((story) => story.story_id));
  next.main_thread.supporting_story_ids = next.main_thread.supporting_story_ids.filter((id) => storyIds.has(id));

  for (const lens of Object.values(next.market_verdict.lenses)) {
    lens.observed_reaction_evidence_refs = validEvidence(lens.observed_reaction_evidence_refs);
    if (lens.observed_reaction && lens.observed_reaction_evidence_refs.length === 0) {
      lens.observed_reaction = null;
    }
  }

  next.investigations = next.investigations.map((item) => ({
    ...item,
    observed_evidence: validEvidence(item.observed_evidence),
    leads_referenced: item.leads_referenced
      ? item.leads_referenced.filter((id) => indexes.validLeadIds.has(id))
      : undefined,
  }));
  next.stock_radar = next.stock_radar.map((item) => ({
    ...item,
    evidence_references: validEvidence(item.evidence_references),
  }));
  next.developing_themes = next.developing_themes.map((item) => ({
    ...item,
    supporting_evidence_ids: validEvidence(item.supporting_evidence_ids),
  }));
  next.thesis_ledger.entries = next.thesis_ledger.entries.map((entry) => ({
    ...entry,
    current_evidence_refs: validEvidence(entry.current_evidence_refs),
  }));

  const validBlockingRefs = new Set([
    "MAIN_THREAD",
    "REGIME:CURRENT",
    ...next.major_stories.map((story) => `STORY:${story.story_id}`),
  ]);
  next.research_gaps = next.research_gaps.flatMap((gap) => {
    if (gap.gap_class === "BLOCKER") {
      const blockingRefs = (gap.blocking_refs ?? []).filter((ref) => validBlockingRefs.has(ref));
      return blockingRefs.length ? [{ ...gap, blocking_refs: blockingRefs }] : [];
    }
    return gap.gap_class === "REFINEMENT" ? [{ ...gap, blocking_refs: [] }] : [];
  });

  const conflictGroups = new Map<string, string[]>();
  for (const evidence of packet.observed_evidence) {
    if (!evidence.conflict_group_id) continue;
    const ids = conflictGroups.get(evidence.conflict_group_id) ?? [];
    ids.push(evidence.evidence_id);
    conflictGroups.set(evidence.conflict_group_id, ids);
  }
  next.contradictions_detected = [...conflictGroups.entries()].map(([conflictGroupId, evidenceIds]) => ({
    conflict_group_id: conflictGroupId,
    summary: `Canonical conflict group ${conflictGroupId} remains unresolved.`,
    conflicting_evidence_ids: [...new Set(evidenceIds)],
  }));

  return next;
}

function buildPatchedMajorStory({
  state,
  story,
  prior,
  packet,
}: {
  state: DossierIntelligenceState;
  story: DossierStoryRecord;
  prior: MajorStory | null;
  packet: DossierV2InputPacket;
}): MajorStory {
  const evidenceIds = stateEvidenceIds(state, packet);
  const evidenceById = new Map(packet.observed_evidence.map((item) => [item.evidence_id, item]));
  const contradicting = evidenceIds.filter((id) => {
    const direction = String(evidenceById.get(id)?.metrics?.support_direction ?? "").toLowerCase();
    return /against|contradict|negative|oppose/.test(direction);
  });
  const confirming = evidenceIds.filter((id) => !contradicting.includes(id));
  const effectiveConfirming = confirming.length ? confirming : evidenceIds;

  const synthesis = state.research_synthesis?.trim()
    || story.best_explanation?.trim()
    || story.thesis.trim();
  const invalidation = stringArray(state.invalidation_criteria).join("; ")
    || story.invalidation_trigger?.trim()
    || "A material change in the canonical evidence would require reassessment.";

  const thesisId = prior?.linked_thesis_ids?.[0] ?? `thesis:story:${story.id}`;

  return {
    story_id: story.id,
    title: story.title,
    what_changed: synthesis,
    why_it_matters: state.market_belief?.trim() || story.market_question?.trim() || synthesis,
    headline_decomposition: state.divergence_summary?.trim() || synthesis,
    causal_mechanism: state.causal_mechanism?.trim() || story.best_explanation?.trim() || story.thesis,
    market_evidence: {
      confirming: effectiveConfirming,
      contradicting,
      unresolved: [],
    },
    conclusion: synthesis,
    what_would_change_mind: invalidation,
    linked_thesis_ids: prior?.linked_thesis_ids?.length ? [...prior.linked_thesis_ids] : [thesisId],
    linked_investigation_ids: prior?.linked_investigation_ids ? [...prior.linked_investigation_ids] : [],
    linked_chart_task_ids: prior?.linked_chart_task_ids ? [...prior.linked_chart_task_ids] : [],
    epistemic_label: "SUPPORTED",
    evidence_ids: evidenceIds,
  };
}

function upsertThesisForStory(
  output: ResearchBrainOutputV1,
  state: DossierIntelligenceState,
  story: DossierStoryRecord,
  majorStory: MajorStory,
  packet: DossierV2InputPacket,
): void {
  const thesisId = majorStory.linked_thesis_ids[0] ?? `thesis:story:${story.id}`;
  const existingIndex = output.thesis_ledger.entries.findIndex((entry) => entry.thesis_id === thesisId);
  const existing = existingIndex >= 0 ? output.thesis_ledger.entries[existingIndex] : null;
  const evidenceIds = stateEvidenceIds(state, packet);
  const invalidation = stringArray(state.invalidation_criteria).join("; ")
    || story.invalidation_trigger?.trim()
    || "Reassess when canonical evidence materially changes.";
  const support = state.strongest_support?.trim() || story.strongest_support?.trim() || majorStory.conclusion;
  const counter = state.strongest_contradiction?.trim() || story.strongest_contradiction?.trim();

  const entry: ThesisLedgerEntryV2 = {
    thesis_id: thesisId,
    contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
    root_thesis_id: existing?.root_thesis_id ?? thesisId,
    parent_thesis_id: existing?.parent_thesis_id ?? null,
    successor_thesis_id: existing?.successor_thesis_id ?? null,
    title: story.title,
    statement: story.thesis,
    state: lifecycleThesisState(state.lifecycle_status),
    version: (existing?.version ?? 0) + 1,
    created_at: existing?.created_at ?? packet.as_of,
    updated_at: packet.as_of,
    lineage: existing?.lineage ? [...existing.lineage] : [],
    state_reason: state.research_synthesis?.trim() || majorStory.conclusion,
    current_evidence_refs: evidenceIds,
    observed_market_reaction: state.divergence_summary?.trim() || state.market_belief?.trim() || null,
    next_catalyst_or_tripwire: stringArray(state.next_catalysts).join("; ")
      || story.next_catalyst?.trim()
      || invalidation,
    arguments: [
      ...(support ? [{ arg_id: `arg:${story.id}:support:${packet.as_of}`, type: "supporting" as const, text: support }] : []),
      ...(counter ? [{ arg_id: `arg:${story.id}:counter:${packet.as_of}`, type: "counter" as const, text: counter }] : []),
    ],
  };

  if (existingIndex >= 0) output.thesis_ledger.entries[existingIndex] = entry;
  else output.thesis_ledger.entries.unshift(entry);
  output.thesis_ledger.entries = output.thesis_ledger.entries.slice(0, 12);
}

export function buildDeterministicDossierPatch({
  packet,
  previousDossier,
  context,
  decision,
}: {
  packet: DossierV2InputPacket;
  previousDossier: MarketDossierV2;
  context: DossierDeltaContext;
  decision: DossierDeltaDecision;
}): DeterministicPatchResult {
  const previousOutput = previousAnalyticalOutput(previousDossier);
  if (!previousOutput) {
    return { output: null, errors: ["Previous Dossier analytical_output is unavailable."] };
  }

  let output = pruneOutputToPacket(previousOutput, packet);
  output.packet_id = packet.packet_id;
  output.as_of = packet.as_of;
  output.diagnostics.model_repair_used = false;
  output.diagnostics.notes = [
    ...output.diagnostics.notes,
    "Deterministic Dossier PATCH applied from canonical intelligence Story state; no post-intelligence model call was used.",
  ];

  const stateById = new Map(context.states.map((state) => [state.story_id, state]));
  const storyById = new Map(context.stories.map((story) => [story.id, story]));
  const changedStories: MajorStory[] = [];

  for (const storyId of decision.changedStoryIds) {
    const state = stateById.get(storyId);
    const story = storyById.get(storyId);
    if (!state || !story) {
      return { output: null, errors: [`Missing canonical Story state for ${storyId}.`] };
    }
    const prior = priorStoryById(output, storyId);
    const patched = buildPatchedMajorStory({ state, story, prior, packet });
    changedStories.push(patched);
    upsertThesisForStory(output, state, story, patched, packet);
  }

  const changedIds = new Set(changedStories.map((story) => story.story_id));
  output.major_stories = [
    ...changedStories,
    ...output.major_stories.filter((story) => !changedIds.has(story.story_id)),
  ].slice(0, MAX_MAJOR_STORIES);

  const remainingStoryIds = new Set(output.major_stories.map((story) => story.story_id));
  output.main_thread.supporting_story_ids = output.main_thread.supporting_story_ids.filter((id) => remainingStoryIds.has(id));
  output.stock_radar = output.stock_radar.filter((item) =>
    item.linkage_type === "LINKED_MAIN_THREAD"
      ? item.linked_main_thread_or_story_id === output.main_thread.thread_id
      : remainingStoryIds.has(item.linked_main_thread_or_story_id)
  );

  const validation = validateResearchBrainOutput(output, packet);
  if (!validation.isValid || !validation.output) {
    return { output: null, errors: validation.errors };
  }
  return { output: validation.output, errors: [] };
}
