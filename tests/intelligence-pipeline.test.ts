import assert from "node:assert/strict";
import test from "node:test";

import type { ReasoningProvider, ReasoningStage, StageDefinition, StageExecution } from "../lib/intelligence/contracts.ts";
import { runIntelligencePipeline } from "../lib/intelligence/pipeline.ts";
import { ProviderRegistry, ProviderUnavailableError, type AcquisitionFailure } from "../lib/intelligence/providers.ts";

const evidence = {
  providerKey: "test-provider",
  sourceExternalId: "official-test-source",
  sourceName: "Official Test Source",
  sourceType: "official_release",
  sourceUrl: "https://example.test/release",
  sourceAncestryKey: "official-test-agency",
  sourceTier: 1,
  reliabilityScore: 95,
  externalEvidenceId: "release-1",
  evidenceClass: "official_release" as const,
  supportDirection: "neutral" as const,
  claimText: "The observed release differed from the priced expectation.",
  summary: "A real test fixture, not a production fallback.",
  eventAt: "2026-08-11T00:00:00.000Z",
  publishedAt: "2026-08-11T00:00:00.000Z",
  availableAt: "2026-08-11T00:00:00.000Z",
  receivedAt: "2026-08-11T00:00:01.000Z",
  geography: "US",
  affectedAssets: ["US2Y"],
  affectedTopics: ["rates"],
  confidence: 90,
  provenanceUrls: ["https://example.test/release"],
  contentHash: "model-output-is-replaced",
  structuredPayload: {},
  rawPayload: {},
  normalizerVersion: "model-output-is-replaced",
};

function fakeProvider(material: boolean) {
  const calls: ReasoningStage[] = [];
  const outputs: Partial<Record<ReasoningStage, unknown>> = {
    normalizer: evidence,
    entity_extractor: { entities: [], relationships: [] },
    market_belief: { beliefKey: "belief-1", statement: "Rates stay high.", pricedState: "One hike priced.", consensusStrength: 70, affectedAssets: ["US2Y"], evidenceIds: [] },
    divergence: { divergenceKey: "divergence-1", material, observedChange: "Growth weakened.", expectedChange: "Growth held firm.", magnitude: 70, persistenceScore: 60, decisiveEvidenceIds: ["release-1"] },
    hypothesis: [
      { hypothesisKey: "hypothesis-1", question: "Is the priced rate path too high?", statement: "The rate path is too high.", marketBelief: "Rates stay high.", divergence: "Growth weakened while the priced path held.", causalMechanism: "Weaker growth lowers the expected policy path.", affectedAssets: ["US2Y"], evidenceForIds: ["release-1"], evidenceAgainstIds: [], decisiveEvidenceIds: ["release-1"], sourceAncestryGroupIds: ["official-test-agency"], causalChain: [{ from: "growth", to: "policy path", mechanism: "weaker demand", evidenceStatus: "observed" }], confirmationCriteria: ["OIS reprices lower."], invalidationCriteria: ["Growth rebounds."], nextCatalysts: ["Next release"], confidence: 72 },
      { hypothesisKey: "hypothesis-2", question: "Is the release noise?", statement: "The rate path remains appropriate.", marketBelief: "Rates stay high.", divergence: "One release weakened.", causalMechanism: "Sampling noise leaves the policy path unchanged.", affectedAssets: ["US2Y"], evidenceForIds: [], evidenceAgainstIds: ["release-1"], decisiveEvidenceIds: ["release-1"], sourceAncestryGroupIds: ["official-test-agency"], causalChain: [{ from: "release noise", to: "policy path", mechanism: "no durable change", evidenceStatus: "speculative" }], confirmationCriteria: ["Growth rebounds."], invalidationCriteria: ["OIS reprices lower."], nextCatalysts: ["Next release"], confidence: 45 },
    ],
    challenger: { hypothesisKey: "hypothesis-1", verdict: "promote", weakestLink: "One release may be noisy.", strongestCountercase: "The release may be noisy.", conflictingEvidenceIds: [], pricingConfirmation: "OIS confirms.", crossAssetConfirmation: null, timingRisk: "Next release may reverse.", nextResolvingEvidence: "Next official release", hiddenAssumptions: [], alternativeMechanisms: [], missingEvidence: [], confidenceAdjustment: -4, adjustedConfidence: 68 },
    scenario: [{ hypothesisKey: "hypothesis-1", asset: "US2Y", bias: "bearish", conviction: 68, baseCase: { description: "Yields reprice lower.", probability: 55 }, bullCase: { description: "Growth rebounds.", probability: 20 }, bearCase: { description: "Weakness broadens.", probability: 25 }, tailCase: null, confirmation: "OIS reprices lower.", invalidation: "Growth rebounds.", explanatoryEvidenceIds: ["release-1"] }],
    story_synthesis: [{ title: "The policy path may be too high", question: "Is the priced rate path too high?", thesis: "Weaker growth can lower the expected rate path.", marketBelief: "Rates stay high.", divergence: "Growth weakened while pricing held.", bias: "bearish", conviction: 68, baseCase: "Yields reprice lower.", bullCase: "Growth rebounds.", bearCase: "Weakness broadens.", tailCase: null, strongestSupport: "The official release weakened.", strongestContradiction: "The release may be noisy.", hypothesisKey: "hypothesis-1", eventSignature: "official growth release", causalMechanism: "Weaker growth lowers the expected policy path.", affectedAssets: ["US2Y"], decisiveEvidenceIds: ["release-1"], sourceAncestryGroupIds: ["official-test-agency"], confirmationCriteria: ["OIS reprices lower."], invalidationCriteria: ["Growth rebounds."], nextCatalysts: ["Next release"], confidence: 68, lifecycleStatus: "detected", publicationEligible: true, qualificationScore: 75, canonicalExternalUrl: null, researchSynthesis: "Alchemy synthesis." }],
    semantic_deduplication: { classification: "new_story", duplicateOfId: null, similarityScore: 10, rationale: "No existing Story represents this mechanism." },
    lifecycle: { status: "developing", reason: "One decisive release with explicit next tests.", confidence: 70 },
  };
  const provider: ReasoningProvider = {
    async execute<TOutput>(definition: StageDefinition<TOutput>, input: unknown): Promise<StageExecution<TOutput>> {
      calls.push(definition.key);
      const rejectedAlternative = definition.key === "challenger"
        && (input as { hypothesis?: { hypothesisKey?: string } })?.hypothesis?.hypothesisKey === "hypothesis-2";
      const output = rejectedAlternative
        ? { ...(outputs.challenger as Record<string, unknown>), hypothesisKey: "hypothesis-2", verdict: "reject", adjustedConfidence: 25 }
        : outputs[definition.key];
      return { stage: definition.key, version: definition.version, model: "test-model", requestId: null, inputTokens: null, outputTokens: null, output: output as TOutput };
    },
  };
  return { provider, calls };
}

test("reasoning executes independent stages and stops when no material divergence exists", async () => {
  const { provider, calls } = fakeProvider(false);
  const result = await runIntelligencePipeline({ providerKey: "test-provider", source: {}, record: { value: 1 } }, provider);
  assert.deepEqual(calls, ["normalizer", "entity_extractor", "market_belief", "divergence"]);
  assert.equal(result.storyCandidates.length, 0);
});

test("material evidence passes through Challenger, deduplication and lifecycle as separate calls", async () => {
  const { provider, calls } = fakeProvider(true);
  const result = await runIntelligencePipeline({ providerKey: "test-provider", source: {}, record: { value: 1 } }, provider);
  assert.deepEqual(calls, ["normalizer", "entity_extractor", "market_belief", "divergence", "hypothesis", "challenger", "challenger", "scenario", "story_synthesis", "semantic_deduplication", "lifecycle"]);
  assert.equal(result.storyCandidates[0]?.lifecycleStatus, "developing");
  assert.equal(result.scenarios.length, 1);
  assert.equal(result.evidence.contentHash.length, 64);
});

test("an unavailable adapter is visible in the acquisition failure sink", async () => {
  const failures: AcquisitionFailure[] = [];
  const registry = new ProviderRegistry({ record: async (failure) => { failures.push(failure); } });
  await assert.rejects(
    registry.acquire("missing-provider", { capability: "news", requestKey: "request-1", params: {} }),
    ProviderUnavailableError,
  );
  assert.equal(failures.length, 1);
  assert.equal(failures[0]?.code, "provider_not_registered");
});
