import { createHash } from "node:crypto";

import type {
  ResearchGapCaseRow,
  ResearchGapOutcome,
} from "./research-gap-lifecycle.ts";
import type { ResearchGapPlanContext } from "./research-gap-context.ts";

export const RESEARCH_GAP_PLAN_VERSION = "research-gap-plan/1" as const;
export const RESEARCH_GAP_VERDICT_VERSION = "research-gap-verdict/1" as const;

export const GAP_RESEARCH_SOURCE_CLASSES = [
  "official",
  "filing",
  "company",
  "market_data",
  "reporting",
  "creator",
] as const;

export type GapResearchSourceClass = typeof GAP_RESEARCH_SOURCE_CLASSES[number];
export type GapEvidenceDirection = ResearchGapOutcome | "NEUTRAL";
export type GapEvidenceDirectness = "DIRECT" | "INDIRECT";

export type ResearchGapRequirement = {
  id: string;
  description: string;
  required: true;
  preferredSourceClasses: GapResearchSourceClass[];
};

export type ResearchGapPlanContextMetadata = {
  frozenAt: string;
  sourceWorkId: string;
  authoritativeDossierId: string;
  dossierLineageIds: string[];
  sources: Array<{
    sourceType: "research_gap_occurrence" | "dossier_v2" | "macropulse";
    sourceId: string;
    contractVersion: string;
    asOf: string;
    authority: "operational_authority" | "canonical" | "context_only";
  }>;
};

export type ResearchGapPlan = {
  contractVersion: typeof RESEARCH_GAP_PLAN_VERSION;
  planId: string;
  caseId: string;
  gapKey: string;
  generatedAt: string;
  researchQuestion: string;
  priorExpectation: string | null;
  objective: string;
  subquestions: string[];
  requirements: ResearchGapRequirement[];
  linkedInvestigationIds: string[];
  linkedStoryIds: string[];
  blockingRefs: string[];
  budget: {
    maxSources: number;
    maxBranches: number;
    maxRequirements: number;
  };
  stopPolicy: {
    minimumQuality: number;
    strongQuality: number;
    authoritativeQuality: number;
    minimumIndependentStrongSources: number;
    rules: string[];
  };
  context?: ResearchGapPlanContextMetadata;
};

export type ResearchGapEvidenceAssessment = {
  evidenceId: string;
  independenceKey: string;
  sourceClass: GapResearchSourceClass;
  sourceUrl: string;
  requirementIds: string[];
  direction: GapEvidenceDirection;
  directness: GapEvidenceDirectness;
  quality: number;
  traceable: boolean;
  claim: string;
};

export type ResearchGapVerdict = {
  contractVersion: typeof RESEARCH_GAP_VERDICT_VERSION;
  evaluatedAt: string;
  planId: string;
  outcome: ResearchGapOutcome;
  confidence: number;
  shouldStop: boolean;
  stopReason: "direction_resolved" | "no_change_resolved" | "conflicting_strong_evidence" | "budget_exhausted" | "continue_research";
  eligibleEvidenceIds: string[];
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  neutralEvidenceIds: string[];
  unresolvedEvidenceIds: string[];
  coveredRequirementIds: string[];
  missingRequirementIds: string[];
  strongIndependentConfirming: number;
  strongIndependentContradicting: number;
  strongIndependentNeutral: number;
  authoritativeConfirming: boolean;
  authoritativeContradicting: boolean;
  authoritativeNeutral: boolean;
  sourceCount: number;
  branchCount: number;
  rationale: string[];
  nextResearch: string[];
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stableHash(parts: string[]) {
  return createHash("sha256")
    .update(parts.map((value) => clean(value).toLowerCase()).filter(Boolean).join("\n"))
    .digest("hex")
    .slice(0, 24);
}

function requirementId(description: string, index: number) {
  return `req:${index + 1}:${stableHash([description]).slice(0, 10)}`;
}

function sourceClassesFor(text: string): GapResearchSourceClass[] {
  const value = text.toLowerCase();

  if (/\b(earnings|guidance|revenue|margin|capex|free cash flow|company|shares?|stock|contract|customer)\b/.test(value)) {
    return ["company", "filing", "market_data", "reporting"];
  }
  if (/\b(treasury|yield|rates?|breakeven|real yield|term premium|fed|fomc|boj|ecb|auction|curve|move|vix|spread|credit)\b/.test(value)) {
    return ["official", "market_data", "reporting"];
  }
  if (/\b(oil|brent|wti|crude|diesel|distillate|lng|inventory|refinery|refiner|gasoline|shipping|freight)\b/.test(value)) {
    return ["official", "market_data", "reporting"];
  }
  if (/\b(iran|hormuz|sanction|tariff|trade|war|military|ceasefire|diplomacy|government|policy)\b/.test(value)) {
    return ["official", "reporting", "market_data"];
  }
  if (/\b(positioning|options?|flow|basis|swap|dealer|liquidity|breadth|volatility)\b/.test(value)) {
    return ["market_data", "official", "reporting"];
  }
  return ["official", "market_data", "reporting"];
}

function unique(values: string[], limit = 24) {
  return [...new Set(values.map((value) => clean(value)).filter(Boolean))].slice(0, limit);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function linkedAuthoritativeInvestigations(
  gap: ResearchGapCaseRow,
  context?: ResearchGapPlanContext,
) {
  if (!context) return [];
  const analyticalOutput = record(context.authoritativeDossier.payload.analytical_output);
  const investigations = Array.isArray(analyticalOutput?.investigations)
    ? analyticalOutput.investigations.map(record).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const byId = new Map(
    investigations
      .map((item) => [clean(item.investigation_id), item] as const)
      .filter(([id]) => Boolean(id)),
  );
  return unique(gap.linked_investigation_ids)
    .map((id) => byId.get(id))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function contextMetadata(context: ResearchGapPlanContext): ResearchGapPlanContextMetadata {
  return {
    frozenAt: context.frozenAt,
    sourceWorkId: context.gap.latest_work_id,
    authoritativeDossierId: context.authoritativeDossier.id,
    dossierLineageIds: context.dossierLineage.map((item) => item.id),
    sources: context.sources.map((source) => ({
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      contractVersion: source.contractVersion,
      asOf: source.asOf,
      authority: source.authority,
    })),
  };
}

function assertContextMatchesGap(gap: ResearchGapCaseRow, context: ResearchGapPlanContext) {
  if (
    context.gap.id !== gap.id
    || context.gap.gap_key !== gap.gap_key
    || context.gap.latest_work_id !== gap.latest_work_id
    || context.gap.latest_dossier_id !== gap.latest_dossier_id
    || context.occurrence.gap_case_id !== gap.id
    || context.occurrence.work_id !== gap.latest_work_id
    || context.occurrence.dossier_id !== gap.latest_dossier_id
    || context.authoritativeDossier.id !== gap.latest_dossier_id
  ) {
    throw new Error("Research Gap plan context does not match the current case identity.");
  }
}

export function buildResearchGapPlan(
  gap: ResearchGapCaseRow,
  now = new Date(),
  context?: ResearchGapPlanContext,
): ResearchGapPlan {
  if (context) assertContextMatchesGap(gap, context);
  const investigations = linkedAuthoritativeInvestigations(gap, context);
  const primaryInvestigation = investigations[0];
  const researchQuestion = clean(primaryInvestigation?.question) || clean(gap.question) || clean(gap.action);
  const priorExpectation = clean(primaryInvestigation?.expected_reaction) || null;
  const evidenceNeeded = unique([
    ...gap.evidence_needed,
    ...investigations.flatMap((item) => strings(item.missing_evidence)),
    ...investigations.map((item) => clean(item.research_next)),
  ], 6);
  const baseRequirements = evidenceNeeded.length
    ? evidenceNeeded
    : [researchQuestion];

  const requirements = baseRequirements.map((description, index) => ({
    id: requirementId(description, index),
    description,
    required: true as const,
    preferredSourceClasses: sourceClassesFor(`${researchQuestion} ${description}`),
  }));

  const subquestions = requirements.map((item) => (
    item.description === researchQuestion
      ? researchQuestion
      : `What does current traceable evidence show about: ${item.description}?`
  ));

  const planId = `gap-plan:${stableHash([
    gap.gap_key,
    gap.latest_work_id,
    gap.latest_dossier_id,
    ...(context?.dossierLineage.map((item) => item.id) ?? []),
    ...(context?.sources.map((source) => `${source.sourceType}:${source.sourceId}`) ?? []),
    ...requirements.map((item) => item.description),
  ])}`;

  return {
    contractVersion: RESEARCH_GAP_PLAN_VERSION,
    planId,
    caseId: gap.id,
    gapKey: gap.gap_key,
    generatedAt: now.toISOString(),
    researchQuestion,
    priorExpectation,
    objective: clean(gap.action) || researchQuestion,
    subquestions,
    requirements,
    linkedInvestigationIds: unique(gap.linked_investigation_ids),
    linkedStoryIds: unique(gap.linked_story_ids),
    blockingRefs: unique(gap.blocking_refs),
    budget: {
      maxSources: 8,
      maxBranches: 3,
      maxRequirements: 6,
    },
    stopPolicy: {
      minimumQuality: 65,
      strongQuality: 80,
      authoritativeQuality: 90,
      minimumIndependentStrongSources: 2,
      rules: [
        "Do not resolve a requirement from untraceable evidence.",
        "Do not stop with a directional verdict until every required evidence branch has qualifying coverage.",
        "One authoritative direct source or two independent strong direct sources may establish one-sided directional support.",
        "Strong evidence on both sides resolves to UNRESOLVED rather than forcing a narrative.",
        "NO_CHANGE requires complete requirement coverage plus strong neutral evidence.",
        "Stop UNRESOLVED when the source or branch budget is exhausted without sufficient directional evidence.",
      ],
    },
    ...(context ? { context: contextMetadata(context) } : {}),
  };
}

function isResearchGapPlanContextMetadata(value: unknown): value is ResearchGapPlanContextMetadata {
  const context = record(value);
  if (!context) return false;
  if (
    !clean(context.frozenAt)
    || !clean(context.sourceWorkId)
    || !clean(context.authoritativeDossierId)
    || !Array.isArray(context.dossierLineageIds)
    || context.dossierLineageIds.length < 1
    || context.dossierLineageIds.length > 3
    || context.dossierLineageIds.some((id) => !clean(id))
    || context.dossierLineageIds[0] !== context.authoritativeDossierId
    || !Array.isArray(context.sources)
    || context.sources.length < 2
  ) return false;

  return context.sources.every((raw) => {
    const source = record(raw);
    return Boolean(
      source
      && ["research_gap_occurrence", "dossier_v2", "macropulse", "market_motion"].includes(clean(source.sourceType))
      && clean(source.sourceId)
      && clean(source.contractVersion)
      && clean(source.asOf)
      && ["operational_authority", "canonical", "context_only"].includes(clean(source.authority)),
    );
  });
}

export function isResearchGapPlan(value: unknown): value is ResearchGapPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const plan = value as Partial<ResearchGapPlan>;
  return (
    plan.contractVersion === RESEARCH_GAP_PLAN_VERSION
    && typeof plan.planId === "string"
    && typeof plan.caseId === "string"
    && typeof plan.gapKey === "string"
    && typeof plan.researchQuestion === "string"
    && (plan.priorExpectation === null || typeof plan.priorExpectation === "string")
    && Array.isArray(plan.requirements)
    && plan.requirements.length >= 1
    && plan.requirements.length <= 6
    && Boolean(plan.budget)
    && Boolean(plan.stopPolicy)
    && (plan.context === undefined || isResearchGapPlanContextMetadata(plan.context))
  );
}

export function validateResearchGapEvidenceAssessments(
  plan: ResearchGapPlan,
  evidence: unknown,
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(evidence)) return ["evidence must be an array."];
  if (evidence.length > 24) errors.push("At most 24 evidence assessments may be evaluated at once.");

  const requirementIds = new Set(plan.requirements.map((item) => item.id));
  const evidenceIds = new Set<string>();

  evidence.forEach((raw, index) => {
    const prefix = `evidence[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    const item = raw as Partial<ResearchGapEvidenceAssessment>;
    if (!clean(item.evidenceId)) errors.push(`${prefix}.evidenceId is required.`);
    if (!clean(item.independenceKey)) errors.push(`${prefix}.independenceKey is required.`);
    if (!GAP_RESEARCH_SOURCE_CLASSES.includes(item.sourceClass as GapResearchSourceClass)) errors.push(`${prefix}.sourceClass is invalid.`);
    if (!["CONFIRMING", "CONTRADICTING", "UNRESOLVED", "NO_CHANGE", "NEUTRAL"].includes(String(item.direction))) errors.push(`${prefix}.direction is invalid.`);
    if (!["DIRECT", "INDIRECT"].includes(String(item.directness))) errors.push(`${prefix}.directness is invalid.`);
    if (!Number.isInteger(item.quality) || Number(item.quality) < 0 || Number(item.quality) > 100) errors.push(`${prefix}.quality must be an integer from 0 to 100.`);
    if (typeof item.traceable !== "boolean") errors.push(`${prefix}.traceable must be boolean.`);
    if (!clean(item.claim)) errors.push(`${prefix}.claim is required.`);
    try {
      if (new URL(clean(item.sourceUrl)).protocol !== "https:") errors.push(`${prefix}.sourceUrl must be HTTPS.`);
    } catch {
      errors.push(`${prefix}.sourceUrl must be HTTPS.`);
    }

    const ids = Array.isArray(item.requirementIds) ? item.requirementIds.map(clean).filter(Boolean) : [];
    if (ids.some((id) => !requirementIds.has(id))) errors.push(`${prefix}.requirementIds contains an unknown requirement.`);
    if (ids.length === 0 && plan.requirements.length > 1) errors.push(`${prefix}.requirementIds is required when the plan has multiple requirements.`);

    const id = clean(item.evidenceId);
    if (id && evidenceIds.has(id)) errors.push(`${prefix}.evidenceId duplicates another assessment.`);
    if (id) evidenceIds.add(id);
  });
  return errors;
}

function uniqueIndependent(
  items: ResearchGapEvidenceAssessment[],
  direction: GapEvidenceDirection,
  quality: number,
) {
  return new Set(
    items
      .filter((item) => item.direction === direction && item.directness === "DIRECT" && item.quality >= quality)
      .map((item) => item.independenceKey),
  ).size;
}

function authoritative(
  items: ResearchGapEvidenceAssessment[],
  direction: GapEvidenceDirection,
  quality: number,
) {
  const authoritativeClasses = new Set<GapResearchSourceClass>(["official", "filing", "company", "market_data"]);
  return items.some((item) => (
    item.direction === direction
    && item.directness === "DIRECT"
    && item.quality >= quality
    && authoritativeClasses.has(item.sourceClass)
  ));
}

function ids(items: ResearchGapEvidenceAssessment[], direction: GapEvidenceDirection) {
  return items.filter((item) => item.direction === direction).map((item) => item.evidenceId);
}

function evidenceRequirementIds(
  plan: ResearchGapPlan,
  item: ResearchGapEvidenceAssessment,
) {
  if (item.requirementIds.length) return item.requirementIds;
  return plan.requirements.length === 1 ? [plan.requirements[0]!.id] : [];
}

export function evaluateResearchGapEvidence(input: {
  plan: ResearchGapPlan;
  evidence: ResearchGapEvidenceAssessment[];
  branchCount?: number;
  now?: Date;
}): ResearchGapVerdict {
  const errors = validateResearchGapEvidenceAssessments(input.plan, input.evidence);
  if (errors.length) throw new Error(errors.join(" "));

  const plan = input.plan;
  const branchCount = Math.max(0, Math.floor(input.branchCount ?? 1));
  const eligible = input.evidence.filter((item) => item.traceable && item.quality >= plan.stopPolicy.minimumQuality);
  const covered = new Set<string>();
  for (const item of eligible) {
    for (const requirementId of evidenceRequirementIds(plan, item)) covered.add(requirementId);
  }
  const missingRequirementIds = plan.requirements
    .map((item) => item.id)
    .filter((id) => !covered.has(id));
  const coverageComplete = missingRequirementIds.length === 0;

  const strongConfirming = uniqueIndependent(eligible, "CONFIRMING", plan.stopPolicy.strongQuality);
  const strongContradicting = uniqueIndependent(eligible, "CONTRADICTING", plan.stopPolicy.strongQuality);
  const strongNeutral = Math.max(
    uniqueIndependent(eligible, "NEUTRAL", plan.stopPolicy.strongQuality),
    uniqueIndependent(eligible, "NO_CHANGE", plan.stopPolicy.strongQuality),
  );

  const authoritativeConfirming = authoritative(eligible, "CONFIRMING", plan.stopPolicy.authoritativeQuality);
  const authoritativeContradicting = authoritative(eligible, "CONTRADICTING", plan.stopPolicy.authoritativeQuality);
  const authoritativeNeutral = (
    authoritative(eligible, "NEUTRAL", plan.stopPolicy.authoritativeQuality)
    || authoritative(eligible, "NO_CHANGE", plan.stopPolicy.authoritativeQuality)
  );

  const confirmingResolved = coverageComplete && (
    authoritativeConfirming
    || strongConfirming >= plan.stopPolicy.minimumIndependentStrongSources
  );
  const contradictingResolved = coverageComplete && (
    authoritativeContradicting
    || strongContradicting >= plan.stopPolicy.minimumIndependentStrongSources
  );
  const neutralResolved = coverageComplete && (
    authoritativeNeutral
    || strongNeutral >= plan.stopPolicy.minimumIndependentStrongSources
  );
  const budgetExhausted = (
    input.evidence.length >= plan.budget.maxSources
    || branchCount >= plan.budget.maxBranches
  );

  let outcome: ResearchGapOutcome = "UNRESOLVED";
  let shouldStop = false;
  let stopReason: ResearchGapVerdict["stopReason"] = "continue_research";
  const rationale: string[] = [];

  if (confirmingResolved && contradictingResolved) {
    outcome = "UNRESOLVED";
    shouldStop = true;
    stopReason = "conflicting_strong_evidence";
    rationale.push("Strong independent evidence supports both sides, so the gap remains genuinely unresolved.");
  } else if (confirmingResolved) {
    outcome = "CONFIRMING";
    shouldStop = true;
    stopReason = "direction_resolved";
    rationale.push("All required evidence branches are covered and confirming evidence cleared the strong-source threshold.");
  } else if (contradictingResolved) {
    outcome = "CONTRADICTING";
    shouldStop = true;
    stopReason = "direction_resolved";
    rationale.push("All required evidence branches are covered and contradicting evidence cleared the strong-source threshold.");
  } else if (neutralResolved && strongConfirming === 0 && strongContradicting === 0) {
    outcome = "NO_CHANGE";
    shouldStop = true;
    stopReason = "no_change_resolved";
    rationale.push("All required evidence branches are covered, but strong evidence does not establish a directional change.");
  } else if (budgetExhausted) {
    outcome = "UNRESOLVED";
    shouldStop = true;
    stopReason = "budget_exhausted";
    rationale.push("The bounded source or branch budget is exhausted without enough evidence for a directional verdict.");
  } else {
    rationale.push("The evidence threshold is not yet sufficient to stop research.");
  }

  if (!coverageComplete) {
    rationale.push(`${missingRequirementIds.length} required evidence branch(es) remain uncovered.`);
  }

  const directionalStrength = Math.max(strongConfirming, strongContradicting, strongNeutral);
  const averageQuality = eligible.length
    ? eligible.reduce((sum, item) => sum + item.quality, 0) / eligible.length
    : 0;
  const confidence = shouldStop
    ? Math.min(
        95,
        Math.max(
          outcome === "UNRESOLVED" ? 55 : 72,
          Math.round(60 + directionalStrength * 6 + averageQuality * 0.18),
        ),
      )
    : Math.min(65, Math.round(25 + eligible.length * 5 + averageQuality * 0.12));

  const nextResearch = missingRequirementIds
    .map((id) => plan.requirements.find((item) => item.id === id)?.description)
    .filter((value): value is string => Boolean(value));

  if (!shouldStop && nextResearch.length === 0) {
    nextResearch.push("Add an independent direct source that can discriminate between the competing explanations.");
  }

  return {
    contractVersion: RESEARCH_GAP_VERDICT_VERSION,
    evaluatedAt: (input.now ?? new Date()).toISOString(),
    planId: plan.planId,
    outcome,
    confidence,
    shouldStop,
    stopReason,
    eligibleEvidenceIds: eligible.map((item) => item.evidenceId),
    supportingEvidenceIds: ids(eligible, "CONFIRMING"),
    contradictingEvidenceIds: ids(eligible, "CONTRADICTING"),
    neutralEvidenceIds: [...new Set([...ids(eligible, "NEUTRAL"), ...ids(eligible, "NO_CHANGE")])],
    unresolvedEvidenceIds: ids(eligible, "UNRESOLVED"),
    coveredRequirementIds: [...covered],
    missingRequirementIds,
    strongIndependentConfirming: strongConfirming,
    strongIndependentContradicting: strongContradicting,
    strongIndependentNeutral: strongNeutral,
    authoritativeConfirming,
    authoritativeContradicting,
    authoritativeNeutral,
    sourceCount: input.evidence.length,
    branchCount,
    rationale,
    nextResearch,
  };
}
