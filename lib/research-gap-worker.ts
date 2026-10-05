import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { MarketDossierV2 } from "./dossier-v2/contracts.ts";
import { validateMarketDossierV2Record } from "./dossier-v2/validation.ts";
import type { MarketMotionRecord } from "./market-motion.ts";
import { persistentResearchGapKey } from "./research-gap-identity.ts";

export const RESEARCH_GAP_WORK_QUEUE_VERSION = "research-gap-work-queue/1" as const;
export const MAX_RESEARCH_GAP_WORK_CANDIDATES = 20;

export type ResearchGapWorkSource =
  | "research_gap"
  | "research_now"
  | "investigation"
  | "market_motion";

export const RESEARCH_GAP_CAUSAL_DISCRIMINATOR_VERSION = "research-gap-causal-discriminator/1" as const;

export type ResearchGapCausalDiscriminatorPlan = {
  contractVersion: typeof RESEARCH_GAP_CAUSAL_DISCRIMINATOR_VERSION;
  planSignature: string;
  baseEvidenceNeeded: string[];
  discriminators: string[];
};

export type ResearchGapWorkCandidate = {
  workId: string;
  gapKey: string;
  sourceKind: ResearchGapWorkSource;
  sourceRef: string;
  dossierId: string;
  dossierAsOf: string;
  question: string | null;
  action: string;
  reason: string | null;
  evidenceNeeded: string[];
  causalDiscriminatorPlan?: ResearchGapCausalDiscriminatorPlan | null;
  linkedInvestigationIds: string[];
  linkedStoryIds: string[];
  blockingRefs: string[];
  nativeSignals: {
    severity: "MATERIAL" | "INFORMATIONAL" | null;
    gapClass: "BLOCKER" | "REFINEMENT" | null;
    expectedInformationGain: string | null;
    researchNowRank: number | null;
    investigationStatus: string | null;
    divergence: string | null;
    motionAttentionTier?: "PRIMARY" | "SECONDARY" | null;
    motionAttentionScore?: number | null;
    motionWritingPotential?: "HIGH" | "MEDIUM" | "LOW" | null;
  };
};

export type CanonicalDivergenceResearchDebtRow = {
  debt_key: string;
  severity: string;
  status: string;
  reason: string;
  next_action: string | null;
  next_check_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type ResearchGapWorkQueue = {
  contractVersion: typeof RESEARCH_GAP_WORK_QUEUE_VERSION;
  generatedAt: string;
  dossierId: string;
  dossierAsOf: string;
  candidates: ResearchGapWorkCandidate[];
  sourceCounts: {
    researchGaps: number;
    researchNow: number;
    investigations: number;
    marketMotion: number;
  };
  diagnostics: {
    needsPrioritisation: true;
    truncated: boolean;
    omittedCandidates: number;
    excludedResolvedInvestigations: number;
    notes: string[];
  };
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function strings(value: unknown, limit = 24): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))].slice(0, limit);
}

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function sourceRef(
  dossierId: string,
  sourceKind: ResearchGapWorkSource,
  explicit: string,
  fallback: string,
) {
  return explicit || `${sourceKind}:${stableHash(`${dossierId}:${fallback}`)}`;
}

function workId(
  dossierId: string,
  sourceKind: ResearchGapWorkSource,
  ref: string,
) {
  return `gap-work:${stableHash(`${dossierId}|${sourceKind}|${ref}`)}`;
}

function linkedStoryIdsFromBlockingRefs(refs: string[]) {
  return refs
    .filter((ref) => ref.startsWith("STORY:"))
    .map((ref) => ref.slice("STORY:".length).trim())
    .filter(Boolean);
}

function researchGapCandidates(dossier: MarketDossierV2): ResearchGapWorkCandidate[] {
  return dossier.research_gaps.flatMap((raw, index) => {
    const gap = object(raw);
    if (!gap) return [];

    const description = clean(gap.description);
    if (!description) return [];

    const blockingRefs = strings(gap.blocking_refs);
    const explicitGapId = clean(gap.gap_id);
    const ref = sourceRef(
      dossier.id,
      "research_gap",
      explicitGapId,
      `${clean(gap.category)}:${description}:${index}`,
    );
    const severity = gap.severity === "MATERIAL" || gap.severity === "INFORMATIONAL"
      ? gap.severity
      : null;
    const gapClass = gap.gap_class === "BLOCKER" || gap.gap_class === "REFINEMENT"
      ? gap.gap_class
      : null;

    const linkedStoryIds = linkedStoryIdsFromBlockingRefs(blockingRefs);
    const reason = clean(gap.category) || null;
    const action = `Investigate: ${description}`;

    return [{
      workId: workId(dossier.id, "research_gap", ref),
      gapKey: persistentResearchGapKey({
        sourceKind: "research_gap",
        sourceRef: ref,
        nativeId: explicitGapId,
        question: description,
        action,
        reason,
        evidenceNeeded: [],
        linkedInvestigationIds: [],
        linkedStoryIds,
        blockingRefs,
      }),
      sourceKind: "research_gap" as const,
      sourceRef: ref,
      dossierId: dossier.id,
      dossierAsOf: dossier.as_of,
      question: description,
      action: `Investigate: ${description}`,
      reason: clean(gap.category) || null,
      evidenceNeeded: [],
      linkedInvestigationIds: [],
      linkedStoryIds,
      blockingRefs,
      nativeSignals: {
        severity,
        gapClass,
        expectedInformationGain: null,
        researchNowRank: null,
        investigationStatus: null,
        divergence: null,
        motionAttentionTier: null,
        motionAttentionScore: null,
        motionWritingPotential: null,
      },
    }];
  });
}

function canonicalDivergenceDebtCandidates(
  dossier: MarketDossierV2,
  rows: CanonicalDivergenceResearchDebtRow[],
): ResearchGapWorkCandidate[] {
  return rows.flatMap((row) => {
    if (row.status !== "open" || !row.debt_key.startsWith("divergence:")) return [];

    const metadata = object(row.metadata);
    if (metadata?.kind !== "canonical_divergence_recruitment") return [];

    const divergenceId = clean(metadata.divergenceId);
    const marketBeliefId = clean(metadata.marketBeliefId);
    const question = clean(metadata.question);
    const discriminators = strings(metadata.evidenceNeeded, 2);
    if (!divergenceId || !marketBeliefId || !question || !discriminators.length) return [];

    const causalPlan = causalDiscriminatorPlan({
      investigationId: divergenceId,
      divergence: "UNRESOLVED",
      baseEvidenceNeeded: [],
      discriminators,
    });
    if (!causalPlan?.discriminators[0]) return [];

    const ref = row.debt_key;
    const evidenceNeeded = [causalPlan.discriminators[0]];
    const action = clean(row.next_action) || `Investigate unresolved divergence: ${question}`;
    const reason = clean(row.reason) || "CANONICAL_DIVERGENCE";
    const blockingRefs = [
      `DIVERGENCE:${divergenceId}`,
      `BELIEF:${marketBeliefId}`,
    ];

    return [{
      workId: workId(dossier.id, "research_gap", ref),
      gapKey: persistentResearchGapKey({
        sourceKind: "research_gap",
        sourceRef: ref,
        nativeId: ref,
        question,
        action,
        reason,
        evidenceNeeded,
        linkedInvestigationIds: [],
        linkedStoryIds: [],
        blockingRefs,
      }),
      sourceKind: "research_gap" as const,
      sourceRef: ref,
      dossierId: dossier.id,
      dossierAsOf: dossier.as_of,
      question,
      action,
      reason,
      evidenceNeeded,
      causalDiscriminatorPlan: causalPlan,
      linkedInvestigationIds: [],
      linkedStoryIds: [],
      blockingRefs,
      nativeSignals: {
        severity: row.severity === "high" || row.severity === "critical" ? "MATERIAL" : "INFORMATIONAL",
        gapClass: "REFINEMENT",
        expectedInformationGain: "High",
        researchNowRank: null,
        investigationStatus: "open",
        divergence: "UNRESOLVED",
        motionAttentionTier: null,
        motionAttentionScore: null,
        motionWritingPotential: null,
      },
    }];
  });
}

function analyticalOutput(dossier: MarketDossierV2) {
  const payload = object(dossier.payload);
  return object(payload?.analytical_output);
}

function researchNowCandidates(dossier: MarketDossierV2): ResearchGapWorkCandidate[] {
  const analytical = analyticalOutput(dossier);
  const rows = Array.isArray(analytical?.research_now) ? analytical.research_now : [];

  return rows.flatMap((raw, index) => {
    const item = object(raw);
    if (!item) return [];

    const action = clean(item.action);
    if (!action) return [];
    const rank = integer(item.rank);
    const explicitRef = rank === null ? "" : `research-now:${rank}:${stableHash(action)}`;
    const ref = sourceRef(dossier.id, "research_now", explicitRef, `${action}:${index}`);

    const reason = clean(item.reason) || null;
    const evidenceNeeded = strings(item.blocking_evidence);
    const linkedInvestigationIds = strings(item.linked_investigations);
    const linkedStoryIds = strings(item.linked_stories);

    return [{
      workId: workId(dossier.id, "research_now", ref),
      gapKey: persistentResearchGapKey({
        sourceKind: "research_now",
        sourceRef: ref,
        question: null,
        action,
        reason,
        evidenceNeeded,
        linkedInvestigationIds,
        linkedStoryIds,
        blockingRefs: [],
      }),
      sourceKind: "research_now" as const,
      sourceRef: ref,
      dossierId: dossier.id,
      dossierAsOf: dossier.as_of,
      question: null,
      action,
      reason: clean(item.reason) || null,
      evidenceNeeded: strings(item.blocking_evidence),
      linkedInvestigationIds: strings(item.linked_investigations),
      linkedStoryIds: strings(item.linked_stories),
      blockingRefs: [],
      nativeSignals: {
        severity: null,
        gapClass: null,
        expectedInformationGain: clean(item.expected_information_gain) || null,
        researchNowRank: rank,
        investigationStatus: null,
        divergence: null,
        motionAttentionTier: null,
        motionAttentionScore: null,
        motionWritingPotential: null,
      },
    }];
  });
}

function candidateDiscriminatingTests(value: unknown, limit = 4) {
  if (!Array.isArray(value)) return [];
  const tests = value.flatMap((raw) => {
    const candidate = object(raw);
    if (!candidate) return [];
    const discriminatingTest = clean(candidate.discriminating_test);
    return discriminatingTest ? [discriminatingTest] : [];
  });
  return [...new Set(tests)].slice(0, limit);
}

function causalDiscriminatorPlan(input: {
  investigationId: string;
  divergence: string;
  baseEvidenceNeeded: string[];
  discriminators: string[];
}): ResearchGapCausalDiscriminatorPlan | null {
  if (!input.investigationId || !input.divergence || input.divergence === "NONE" || input.discriminators.length === 0) {
    return null;
  }
  const baseEvidenceNeeded = strings(input.baseEvidenceNeeded, 12);
  const discriminators = strings(input.discriminators, 4);
  const planSignature = stableHash([
    input.investigationId,
    input.divergence,
    ...discriminators,
  ].join("\n"));
  return {
    contractVersion: RESEARCH_GAP_CAUSAL_DISCRIMINATOR_VERSION,
    planSignature,
    baseEvidenceNeeded,
    discriminators,
  };
}

function investigationCandidates(dossier: MarketDossierV2) {
  const analytical = analyticalOutput(dossier);
  const rows = Array.isArray(analytical?.investigations) ? analytical.investigations : [];
  let excludedResolved = 0;

  const candidates = rows.flatMap((raw, index) => {
    const item = object(raw);
    if (!item) return [];

    const status = clean(item.status).toLowerCase();
    if (status === "resolved" || status === "parked") {
      excludedResolved += 1;
      return [];
    }

    const question = clean(item.question);
    const researchNext = clean(item.research_next);
    if (!question && !researchNext) return [];

    const explicitId = clean(item.investigation_id);
    const ref = sourceRef(
      dossier.id,
      "investigation",
      explicitId,
      `${question}:${researchNext}:${index}`,
    );

    const action = researchNext || `Investigate: ${question}`;
    const reason = clean(item.why_it_matters) || null;
    const divergence = clean(item.divergence).toUpperCase();
    const baseEvidenceNeeded = strings(item.missing_evidence);
    const discriminatingTests =
      divergence && divergence !== "NONE"
        ? candidateDiscriminatingTests(item.candidate_explanations)
        : [];
    const causalPlan = causalDiscriminatorPlan({
      investigationId: explicitId,
      divergence,
      baseEvidenceNeeded,
      discriminators: discriminatingTests,
    });
    const evidenceNeeded = strings([
      ...baseEvidenceNeeded,
      ...(causalPlan?.discriminators[0] ? [causalPlan.discriminators[0]] : []),
    ]);
    const linkedInvestigationIds = explicitId ? [explicitId] : [];
    const linkedStoryIds = strings(item.linked_story_ids);

    return [{
      workId: workId(dossier.id, "investigation", ref),
      gapKey: persistentResearchGapKey({
        sourceKind: "investigation",
        sourceRef: ref,
        nativeId: explicitId,
        question: question || null,
        action,
        reason,
        evidenceNeeded,
        linkedInvestigationIds,
        linkedStoryIds,
        blockingRefs: [],
      }),
      sourceKind: "investigation" as const,
      sourceRef: ref,
      dossierId: dossier.id,
      dossierAsOf: dossier.as_of,
      question: question || null,
      action: researchNext || `Investigate: ${question}`,
      reason: clean(item.why_it_matters) || null,
      evidenceNeeded,
      causalDiscriminatorPlan: causalPlan,
      linkedInvestigationIds: explicitId ? [explicitId] : [],
      linkedStoryIds: strings(item.linked_story_ids),
      blockingRefs: [],
      nativeSignals: {
        severity: null,
        gapClass: null,
        expectedInformationGain: null,
        researchNowRank: null,
        investigationStatus: status || null,
        divergence: divergence || null,
        motionAttentionTier: null,
        motionAttentionScore: null,
        motionWritingPotential: null,
      },
    }];
  });

  return { candidates, excludedResolved };
}

export function buildResearchGapWorkQueue(
  dossier: MarketDossierV2,
  now = new Date(),
  motionRows: MarketMotionRecord[] = [],
  divergenceDebtRows: CanonicalDivergenceResearchDebtRow[] = [],
): ResearchGapWorkQueue {
  const researchGaps = [
    ...researchGapCandidates(dossier),
    ...canonicalDivergenceDebtCandidates(dossier, divergenceDebtRows),
  ];
  const researchNow = researchNowCandidates(dossier);
  const investigations = investigationCandidates(dossier);
  void motionRows;

  // Preserve source-native ordering only. Deliberate cross-source prioritisation
  // belongs to the next worker stage so ingestion does not hide policy.
  // B3 makes the Dossier authoritative: raw Motion cannot create new work here.
  const all = [...researchGaps, ...researchNow, ...investigations.candidates];
  const candidates = all.slice(0, MAX_RESEARCH_GAP_WORK_CANDIDATES);
  const omittedCandidates = Math.max(0, all.length - candidates.length);

  return {
    contractVersion: RESEARCH_GAP_WORK_QUEUE_VERSION,
    generatedAt: now.toISOString(),
    dossierId: dossier.id,
    dossierAsOf: dossier.as_of,
    candidates,
    sourceCounts: {
      researchGaps: researchGaps.length,
      researchNow: researchNow.length,
      investigations: investigations.candidates.length,
      marketMotion: 0,
    },
    diagnostics: {
      needsPrioritisation: true,
      truncated: omittedCandidates > 0,
      omittedCandidates,
      excludedResolvedInvestigations: investigations.excludedResolved,
      notes: [
        "This stage reads and normalises work only; it does not score, claim, research, resolve or mutate a gap.",
        "Native ranks, blocker labels, information-gain labels and investigation state are preserved for the prioritisation stage.",
        "Dossier-derived Research Gap work remains Dossier-authoritative; raw Motion cannot enter directly.",
        "Divergent Investigation candidate mechanisms carry a bounded causal-discriminator plan, but only the first discriminator is exposed as active Research Gap work at ingestion.",
        "Material canonical divergence debt reuses the same bounded causal-discriminator lifecycle; only its first discriminator is active at ingestion.",
      ],
    },
  };
}

export async function loadLatestResearchGapWorkQueue(
  client?: SupabaseClient,
  now = new Date(),
): Promise<ResearchGapWorkQueue | null> {
  const db = client ?? createSupabaseAdminClient();
  const { data, error } = await db
    .from("market_dossiers_v2")
    .select("id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at")
    .order("as_of", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest Research Gap work source: ${error.message}`);
  }
  if (!data) return null;

  const { data: divergenceDebtRows, error: divergenceDebtError } = await db
    .from("research_debt")
    .select("debt_key,severity,status,reason,next_action,next_check_at,metadata")
    .eq("status", "open")
    .like("debt_key", "divergence:%")
    .order("next_check_at", { ascending: true, nullsFirst: false })
    .limit(12);

  if (divergenceDebtError) {
    throw new Error(`Failed to load canonical divergence Research Gap debt: ${divergenceDebtError.message}`);
  }

  return buildResearchGapWorkQueue(
    validateMarketDossierV2Record(data),
    now,
    [],
    (divergenceDebtRows || []) as CanonicalDivergenceResearchDebtRow[],
  );
}
