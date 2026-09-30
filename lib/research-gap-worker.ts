import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { MarketDossierV2 } from "./dossier-v2/contracts.ts";
import { validateMarketDossierV2Record } from "./dossier-v2/validation.ts";\nimport { persistentResearchGapKey } from "./research-gap-identity.ts";

export const RESEARCH_GAP_WORK_QUEUE_VERSION = "research-gap-work-queue/1" as const;
export const MAX_RESEARCH_GAP_WORK_CANDIDATES = 20;

export type ResearchGapWorkSource =
  | "research_gap"
  | "research_now"
  | "investigation";

export type ResearchGapWorkCandidate = {
  workId: string;
  sourceKind: ResearchGapWorkSource;
  sourceRef: string;
  dossierId: string;
  dossierAsOf: string;
  question: string | null;
  action: string;
  reason: string | null;
  evidenceNeeded: string[];
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
  };
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
      },
    }];
  });
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
    const evidenceNeeded = strings(item.missing_evidence);
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
      evidenceNeeded: strings(item.missing_evidence),
      linkedInvestigationIds: explicitId ? [explicitId] : [],
      linkedStoryIds: strings(item.linked_story_ids),
      blockingRefs: [],
      nativeSignals: {
        severity: null,
        gapClass: null,
        expectedInformationGain: null,
        researchNowRank: null,
        investigationStatus: status || null,
        divergence: clean(item.divergence) || null,
      },
    }];
  });

  return { candidates, excludedResolved };
}

export function buildResearchGapWorkQueue(
  dossier: MarketDossierV2,
  now = new Date(),
): ResearchGapWorkQueue {
  const researchGaps = researchGapCandidates(dossier);
  const researchNow = researchNowCandidates(dossier);
  const investigations = investigationCandidates(dossier);

  // Preserve source-native ordering only. Deliberate cross-source prioritisation
  // belongs to the next worker stage so ingestion does not hide policy.
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
    },
    diagnostics: {
      needsPrioritisation: true,
      truncated: omittedCandidates > 0,
      omittedCandidates,
      excludedResolvedInvestigations: investigations.excludedResolved,
      notes: [
        "This stage reads and normalises work only; it does not score, claim, research, resolve or mutate a gap.",
        "Native ranks, blocker labels, information-gain labels and investigation state are preserved for the prioritisation stage.",
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

  return buildResearchGapWorkQueue(validateMarketDossierV2Record(data), now);
}
