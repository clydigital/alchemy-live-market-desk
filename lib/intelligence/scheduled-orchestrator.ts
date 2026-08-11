import { revalidatePath } from "next/cache";

import type { IntakeItemInput } from "@/lib/research-update";
import { OpenAIReasoningProvider } from "./openai-reasoning.ts";
import { runIntelligencePipeline } from "./pipeline.ts";
import { IntelligenceRepository } from "./repository.ts";
import { runOneTargetedReevaluation } from "./targeted-reevaluation.ts";

export type ScheduledIntelligenceItem = IntakeItemInput & {
  candidateScore: number;
  evidence: NonNullable<IntakeItemInput["evidence"]>;
};

export type ScheduledIntelligenceResult = {
  available: boolean;
  reused: boolean;
  engineRunId: string | null;
  status: "completed" | "partial" | "failed" | "blocked" | "unavailable";
  itemsEligible: number;
  itemsProcessed: number;
  itemsDeferred: number;
  candidatesCreated: number;
  storiesPublished: number;
  warnings: string[];
};

function boundedEnvironmentInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.floor(value))) : fallback;
}

function sourceAncestryKey(publisher: string) {
  return publisher.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-publisher";
}

function reasoningInput(item: ScheduledIntelligenceItem) {
  return {
    providerKey: "scheduled_research_intake",
    source: {
      externalId: item.externalId || item.itemKey,
      name: item.publisher,
      type: item.itemType,
      url: item.url,
      ancestryKey: sourceAncestryKey(item.publisher),
      sourceQuality: item.sourceQuality,
    },
    record: {
      itemKey: item.itemKey,
      title: item.title,
      summary: item.summary,
      publishedAt: item.publishedAt,
      transcript: item.itemType === "video" ? item.transcriptText || null : null,
      statsSignal: item.statsSignal || null,
      newsSignal: item.newsSignal || null,
      divergenceKind: item.divergenceKind || "none",
      divergenceNote: item.divergenceNote || null,
      affectedStorySlugs: item.affectedStorySlugs || [],
      evidenceLinks: item.evidence,
      intakeScores: {
        sourceQuality: item.sourceQuality,
        relevance: item.relevance,
        novelty: item.novelty,
        materiality: item.materiality,
        candidateScore: item.candidateScore,
      },
    },
    receivedAt: new Date().toISOString(),
  };
}

function eligible(item: ScheduledIntelligenceItem, minimumScore: number) {
  if (item.recommendedAction === "ignore" || item.candidateScore < minimumScore) return false;
  return item.itemType !== "video" || item.transcriptStatus === "ready";
}

function terminalResult(
  row: Record<string, unknown>,
  eligibleCount: number,
  deferredCount: number,
): ScheduledIntelligenceResult {
  const status = String(row.status || "completed") as ScheduledIntelligenceResult["status"];
  return {
    available: true,
    reused: true,
    engineRunId: String(row.id),
    status,
    itemsEligible: eligibleCount,
    itemsProcessed: Number(row.stories_considered || 0),
    itemsDeferred: deferredCount,
    candidatesCreated: 0,
    storiesPublished: Number(row.stories_published || 0),
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
  };
}

/**
 * Runs the autonomous intelligence stages over real, already-validated research
 * intake. It is deliberately idempotent per research run and cost-bounded; a
 * later research run supplies the next persistent update opportunity.
 */
export async function runScheduledResearchIntelligence(input: {
  researchRunId: string;
  researchRunKey: string;
  items: ScheduledIntelligenceItem[];
}): Promise<ScheduledIntelligenceResult> {
  const repository = new IntelligenceRepository();
  const minimumScore = boundedEnvironmentInteger("INTELLIGENCE_MIN_CANDIDATE_SCORE", 65, 0, 100);
  const maximumItems = boundedEnvironmentInteger("INTELLIGENCE_MAX_ITEMS_PER_RUN", 2, 1, 10);
  const allEligible = input.items.filter((item) => eligible(item, minimumScore))
    .sort((left, right) => right.candidateScore - left.candidateScore || Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
  const selected = allEligible.slice(0, maximumItems);
  const deferred = Math.max(0, allEligible.length - selected.length);
  const runKey = `research:${input.researchRunKey}`;

  const prior = await repository.findEngineRunByKey(runKey);
  if (prior) return terminalResult(prior as Record<string, unknown>, allEligible.length, deferred);

  let engineRunId: string;
  try {
    engineRunId = await repository.beginEngineRun("scheduled", {
      researchRunKey: input.researchRunKey,
      minimumCandidateScore: minimumScore,
      maximumItems,
      itemsEligible: allEligible.length,
      itemsDeferred: deferred,
    }, { runKey, researchRunId: input.researchRunId });
  } catch (error) {
    const raced = await repository.findEngineRunByKey(runKey);
    if (raced) return terminalResult(raced as Record<string, unknown>, allEligible.length, deferred);
    throw error;
  }

  const warnings: string[] = [];
  const provider = new OpenAIReasoningProvider();
  if (deferred) warnings.push(`${deferred} eligible intake item(s) were deferred by the per-run reasoning cap of ${maximumItems}.`);
  try {
    const reevaluation = await runOneTargetedReevaluation(undefined, repository, provider);
    if (reevaluation.processed) warnings.push(`Targeted Story re-evaluation ${reevaluation.queueId} completed before new intake reasoning.`);
  } catch (error) {
    warnings.push(`A queued targeted Story re-evaluation failed without blocking new intake: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!selected.length) {
    warnings.push(`No intake item met the score/transcript gate (minimum score ${minimumScore}).`);
    await repository.finishEngineRun(engineRunId, { status: "blocked", warnings });
    return {
      available: true,
      reused: false,
      engineRunId,
      status: "blocked",
      itemsEligible: 0,
      itemsProcessed: 0,
      itemsDeferred: 0,
      candidatesCreated: 0,
      storiesPublished: 0,
      warnings,
    };
  }

  let itemsProcessed = 0;
  let candidatesCreated = 0;
  let storiesPublished = 0;
  for (const item of selected) {
    try {
      const existingStories = await repository.existingStoryCandidates();
      const result = await runIntelligencePipeline({ ...reasoningInput(item), existingStories }, provider);
      const persisted = await repository.persistPipelineResult(engineRunId, result);
      candidatesCreated += persisted.candidateIds.length;
      for (const candidateId of persisted.promotableCandidateIds) {
        try {
          await repository.promoteStoryCandidate({ candidateId });
          storiesPublished += 1;
        } catch (error) {
          warnings.push(`${item.itemKey}: candidate promotion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      itemsProcessed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${item.itemKey}: intelligence stages failed: ${message}`);
      if (/OPENAI_API_KEY|credit|billing|quota|insufficient_quota|unauthorized|\b401\b/i.test(message)) break;
    }
  }

  const status: "completed" | "partial" | "failed" = itemsProcessed === selected.length
    ? (warnings.length ? "partial" : "completed")
    : itemsProcessed ? "partial" : "failed";
  await repository.finishEngineRun(engineRunId, {
    status,
    storiesConsidered: itemsProcessed,
    storiesPublished,
    warnings,
    failureDetail: status === "failed" ? warnings.join("\n") : null,
  });

  if (storiesPublished) {
    revalidatePath("/");
    revalidatePath("/stories");
    revalidatePath("/api/hybrid-feed");
    revalidatePath("/api/hybrid-feed-v2");
  }
  return {
    available: true,
    reused: false,
    engineRunId,
    status,
    itemsEligible: allEligible.length,
    itemsProcessed,
    itemsDeferred: deferred,
    candidatesCreated,
    storiesPublished,
    warnings,
  };
}

export function unavailableScheduledIntelligence(reason: string): ScheduledIntelligenceResult {
  return {
    available: false,
    reused: false,
    engineRunId: null,
    status: "unavailable",
    itemsEligible: 0,
    itemsProcessed: 0,
    itemsDeferred: 0,
    candidatesCreated: 0,
    storiesPublished: 0,
    warnings: [reason],
  };
}
