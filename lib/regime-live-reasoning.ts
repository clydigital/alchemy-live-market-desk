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
