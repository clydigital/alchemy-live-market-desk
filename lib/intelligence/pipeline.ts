import { createHash } from "node:crypto";

import type {
  ChallengerAssessment,
  EvidenceObject,
  IntelligencePipelineResult,
  ReasoningProvider,
  StageExecution,
  StoryCandidate,
} from "./contracts.ts";
import { compareStoryCandidates } from "./deduplication.ts";
import {
  challengerDefinition,
  divergenceDefinition,
  entityExtractorDefinition,
  hypothesisDefinition,
  lifecycleDefinition,
  marketBeliefDefinition,
  normalizerDefinition,
  scenarioDefinition,
  semanticDeduplicationDefinition,
  storySynthesisDefinition,
} from "./stage-definitions.ts";

export type IntelligencePipelineInput = {
  providerKey: string;
  source: Record<string, unknown>;
  record: Record<string, unknown>;
  receivedAt?: string;
  existingStories?: StoryCandidate[];
};

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export async function runIntelligencePipeline(
  input: IntelligencePipelineInput,
  provider: ReasoningProvider,
): Promise<IntelligencePipelineResult> {
  const stageExecutions: StageExecution[] = [];

  const normalizer = await provider.execute(normalizerDefinition, {
    providerKey: input.providerKey,
    source: input.source,
    record: input.record,
    receivedAt: input.receivedAt || new Date().toISOString(),
  });
  stageExecutions.push(normalizer);
  const evidence: EvidenceObject = {
    ...normalizer.output,
    providerKey: input.providerKey,
    contentHash: contentHash({ providerKey: input.providerKey, source: input.source, record: input.record }),
    receivedAt: input.receivedAt || normalizer.output.receivedAt || new Date().toISOString(),
    normalizerVersion: `${normalizerDefinition.key}:v${normalizerDefinition.version}`,
    rawPayload: input.record,
  };

  const entityExecution = await provider.execute(entityExtractorDefinition, { evidence });
  stageExecutions.push(entityExecution);

  const beliefExecution = await provider.execute(marketBeliefDefinition, {
    evidence,
    entities: entityExecution.output,
  });
  stageExecutions.push(beliefExecution);

  const divergenceExecution = await provider.execute(divergenceDefinition, {
    evidence,
    marketBelief: beliefExecution.output,
  });
  stageExecutions.push(divergenceExecution);

  if (!divergenceExecution.output.material) {
    return {
      evidence,
      entities: entityExecution.output,
      belief: beliefExecution.output,
      divergence: divergenceExecution.output,
      hypotheses: [],
      challengerAssessments: [],
      scenarios: [],
      storyCandidates: [],
      stageExecutions,
    };
  }

  const hypothesisExecution = await provider.execute(hypothesisDefinition, {
    evidence,
    entities: entityExecution.output,
    marketBelief: beliefExecution.output,
    divergence: divergenceExecution.output,
  });
  stageExecutions.push(hypothesisExecution);

  const challengerExecutions = await Promise.all(hypothesisExecution.output.map((hypothesis) => (
    provider.execute(challengerDefinition, {
      evidence,
      marketBelief: beliefExecution.output,
      divergence: divergenceExecution.output,
      hypothesis,
    })
  )));
  stageExecutions.push(...challengerExecutions);
  const challengerAssessments = challengerExecutions.map((execution) => execution.output);

  const synthesisPairs = hypothesisExecution.output
    .map((hypothesis, index) => ({ hypothesis, assessment: challengerAssessments[index] }))
    .filter((pair): pair is { hypothesis: typeof hypothesisExecution.output[number]; assessment: ChallengerAssessment } => Boolean(pair.assessment))
    .filter(({ assessment }) => assessment.verdict === "promote");

  const scenarioExecutions = await Promise.all(synthesisPairs.map(({ hypothesis, assessment }) => (
    provider.execute(scenarioDefinition, {
      evidence,
      marketBelief: beliefExecution.output,
      divergence: divergenceExecution.output,
      hypothesis,
      challenger: assessment,
    })
  )));
  stageExecutions.push(...scenarioExecutions);
  const scenarios = scenarioExecutions.flatMap((execution) => execution.output);

  const synthesisExecutions = await Promise.all(synthesisPairs.map(({ hypothesis, assessment }) => (
    provider.execute(storySynthesisDefinition, {
      evidence,
      marketBelief: beliefExecution.output,
      divergence: divergenceExecution.output,
      hypothesis,
      challenger: assessment,
      scenarios: scenarios.filter((scenario) => scenario.hypothesisKey === hypothesis.hypothesisKey),
    })
  )));
  stageExecutions.push(...synthesisExecutions);

  const accepted: StoryCandidate[] = [];
  const existingStories = [...(input.existingStories || [])];
  for (const candidate of synthesisExecutions.flatMap((execution) => execution.output)) {
    const semanticExecution = await provider.execute(semanticDeduplicationDefinition, {
      candidate,
      existingStories,
    });
    stageExecutions.push(semanticExecution);

    const deterministicConflict = existingStories
      .map((existing) => compareStoryCandidates(candidate, existing))
      .find((comparison) => comparison.classification === "duplicate" || comparison.classification === "existing_story_update");
    const classification = deterministicConflict?.classification || semanticExecution.output.classification;
    const duplicateOfId = deterministicConflict?.duplicateOfId || semanticExecution.output.duplicateOfId;
    const noveltyRationale = deterministicConflict?.rationale || semanticExecution.output.rationale;
    if (["duplicate", "insufficient_novelty"].includes(classification)) {
      accepted.push({
        ...candidate,
        publicationEligible: false,
        noveltyClass: classification,
        duplicateOfId,
        noveltyRationale,
      });
      continue;
    }

    const lifecycleExecution = await provider.execute(lifecycleDefinition, {
      candidate,
      priorStatus: null,
      evidence,
      challenger: synthesisPairs.find((pair) => pair.hypothesis.causalMechanism === candidate.causalMechanism)?.assessment || null,
    });
    stageExecutions.push(lifecycleExecution);
    const reviewed = {
      ...candidate,
      lifecycleStatus: lifecycleExecution.output.status,
      confidence: clamp(candidate.confidence),
      qualificationScore: clamp(candidate.qualificationScore),
      publicationEligible: candidate.publicationEligible && !["invalidated", "archived"].includes(lifecycleExecution.output.status),
      noveltyClass: classification,
      duplicateOfId,
      noveltyRationale,
    };
    accepted.push(reviewed);
    existingStories.push(reviewed);
  }

  return {
    evidence,
    entities: entityExecution.output,
    belief: beliefExecution.output,
    divergence: divergenceExecution.output,
    hypotheses: hypothesisExecution.output,
    challengerAssessments,
    scenarios,
    storyCandidates: accepted,
    stageExecutions,
  };
}
