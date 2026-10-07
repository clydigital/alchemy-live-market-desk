import "server-only";

import { createSupabaseAdminClient } from "./supabase/admin.ts";

export type RegimeLiveCausalEdge = {
  from: string;
  relationship: string;
  to: string;
  evidenceState: "observed" | "strongly_supported" | "inferred" | "speculative";
  evidenceCount: number;
};

export type RegimeLiveStoryReasoning = {
  storyId: string;
  hypothesisId: string;
  question: string | null;
  statement: string;
  mechanism: string;
  confidence: number;
  decisionState: string;
  updatedAt: string | null;
  causalChain: RegimeLiveCausalEdge[];
};

export type RegimeStoryInterpretationClock = {
  storyId: string;
  evaluatedAt: string | null;
  basis: "story_review" | "hypothesis_update" | "unavailable";
  /** A Story review is not a causal read unless its primary hypothesis resolves. */
  hasPrimaryHypothesis: boolean;
};

const EVIDENCE_STATES = new Set(["observed", "strongly_supported", "inferred", "speculative"]);

function parseCausalChain(value: unknown): RegimeLiveCausalEdge[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const edge = raw as Record<string, unknown>;
    if (
      typeof edge.from !== "string"
      || typeof edge.relationship !== "string"
      || typeof edge.to !== "string"
      || typeof edge.evidenceState !== "string"
      || !EVIDENCE_STATES.has(edge.evidenceState)
    ) return [];
    return [{
      from: edge.from,
      relationship: edge.relationship,
      to: edge.to,
      evidenceState: edge.evidenceState as RegimeLiveCausalEdge["evidenceState"],
      evidenceCount: Array.isArray(edge.evidenceIds)
        ? edge.evidenceIds.filter((item): item is string => typeof item === "string").length
        : 0,
    }];
  });
}

export async function getRegimeStoryInterpretationClocks(
  storyIds: string[],
): Promise<RegimeStoryInterpretationClock[]> {
  const ids = [...new Set(storyIds.filter(Boolean))];
  if (!ids.length) return [];

  try {
    const client = createSupabaseAdminClient();
    const { data: states, error: stateError } = await client
      .from("intelligence_story_states")
      .select("story_id,primary_hypothesis_id,last_evaluated_at")
      .in("story_id", ids);

    if (stateError || !states?.length) return [];

    const hypothesisIds = [...new Set(states
      .map((item) => item.primary_hypothesis_id)
      .filter((item): item is string => typeof item === "string" && Boolean(item)))];
    const hypothesisUpdatedAt = new Map<string, string | null>();

    if (hypothesisIds.length) {
      const { data: hypotheses, error: hypothesisError } = await client
        .from("intelligence_hypotheses")
        .select("id,updated_at")
        .in("id", hypothesisIds);
      if (!hypothesisError) {
        for (const hypothesis of hypotheses || []) {
          hypothesisUpdatedAt.set(
            hypothesis.id,
            typeof hypothesis.updated_at === "string" ? hypothesis.updated_at : null,
          );
        }
      }
    }

    return states.map((state) => {
      // A later Story evaluation alone cannot prove that any causal explanation exists.
      // Fail closed if the primary hypothesis pointer is absent or cannot be resolved.
      if (!state.primary_hypothesis_id || !hypothesisUpdatedAt.has(state.primary_hypothesis_id)) {
        return {
          storyId: state.story_id,
          evaluatedAt: null,
          basis: "unavailable" as const,
          hasPrimaryHypothesis: false,
        };
      }
      const reviewedAt = typeof state.last_evaluated_at === "string" ? state.last_evaluated_at : null;
      if (reviewedAt) {
        return {
          storyId: state.story_id,
          evaluatedAt: reviewedAt,
          basis: "story_review" as const,
          hasPrimaryHypothesis: true,
        };
      }
      const hypothesisAt = state.primary_hypothesis_id
        ? hypothesisUpdatedAt.get(state.primary_hypothesis_id) ?? null
        : null;
      return {
        storyId: state.story_id,
        evaluatedAt: hypothesisAt,
        basis: hypothesisAt ? "hypothesis_update" as const : "unavailable" as const,
        hasPrimaryHypothesis: true,
      };
    });
  } catch {
    return [];
  }
}

export async function getRegimeLiveReasoning(storyIds: string[]): Promise<RegimeLiveStoryReasoning[]> {
  const ids = [...new Set(storyIds.filter(Boolean))];
  if (!ids.length) return [];

  try {
    const client = createSupabaseAdminClient();
    const { data: states, error: stateError } = await client
      .from("intelligence_story_states")
      .select("story_id,primary_hypothesis_id")
      .in("story_id", ids)
      .not("primary_hypothesis_id", "is", null);

    if (stateError || !states?.length) return [];

    const hypothesisIds = [...new Set(states
      .map((item) => item.primary_hypothesis_id)
      .filter((item): item is string => typeof item === "string" && Boolean(item)))];
    if (!hypothesisIds.length) return [];

    const { data: hypotheses, error: hypothesisError } = await client
      .from("intelligence_hypotheses")
      .select("id,question,statement,causal_mechanism,causal_chain,decision_state,confidence,updated_at")
      .in("id", hypothesisIds);
    if (hypothesisError || !hypotheses?.length) return [];

    const hypothesisById = new Map(hypotheses.map((item) => [item.id, item]));
    return states.flatMap((state) => {
      const hypothesis = state.primary_hypothesis_id
        ? hypothesisById.get(state.primary_hypothesis_id)
        : null;
      if (!hypothesis) return [];
      return [{
        storyId: state.story_id,
        hypothesisId: hypothesis.id,
        question: hypothesis.question,
        statement: hypothesis.statement,
        mechanism: hypothesis.causal_mechanism,
        confidence: Number(hypothesis.confidence || 0),
        decisionState: hypothesis.decision_state,
        updatedAt: typeof hypothesis.updated_at === "string" ? hypothesis.updated_at : null,
        causalChain: parseCausalChain(hypothesis.causal_chain),
      }];
    });
  } catch {
    return [];
  }
}
