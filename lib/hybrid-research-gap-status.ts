import type { SupabaseClient } from "@supabase/supabase-js";

import { getMarketDossierV2ById } from "./dossier-v2/persistence.ts";
import {
  RESEARCH_GAP_CASE_STATUSES,
  RESEARCH_GAP_OUTCOMES,
  type ResearchGapCaseStatus,
  type ResearchGapOutcome,
} from "./research-gap-lifecycle.ts";
import { buildResearchGapWorkQueue } from "./research-gap-worker.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

const HYBRID_RESEARCH_GAP_SAFE_SELECT =
  "gap_key,status,research_outcome,handoff_canonical_status,source_kind,source_ref,linked_investigation_ids,linked_story_ids,latest_dossier_id,latest_dossier_as_of,updated_at";

type HybridResearchGapSourceKind =
  | "research_gap"
  | "research_now"
  | "investigation";

type HybridResearchGapLifecycleRow = {
  gap_key: string;
  status: ResearchGapCaseStatus;
  research_outcome: ResearchGapOutcome | null;
  handoff_canonical_status: number | null;
  source_kind: string;
  source_ref: string;
  linked_investigation_ids: string[];
  linked_story_ids: string[];
  latest_dossier_id: string;
  latest_dossier_as_of: string;
  updated_at: string;
};

export type HybridResearchGapStatusItem = {
  gapKey: string;
  sourceKind: HybridResearchGapSourceKind;
  sourceRef: string;
  lifecycleStatus: ResearchGapCaseStatus;
  /** Read-only directional research verdict. NEVER a market fact or a verified resolution. */
  researchOutcome: ResearchGapOutcome | null;
  /** A 2xx canonical handoff proves delivery only, not that missing data were found. */
  handoffAcknowledged: boolean;
  /** No metric-resolution proof is present in the lifecycle table. */
  measurementVerification: "NOT_PROVEN";
  caseMatchesSelectedDossier: boolean;
  linkedInvestigationIds: string[];
  linkedStoryIds: string[];
  latestDossierId: string;
  latestDossierAsOf: string;
  updatedAt: string;
};

export type HybridResearchGapStatusProjection = {
  contractVersion: "hybrid-research-gap-status/2";
  dossierId: string;
  dossierAsOf: string;
  items: HybridResearchGapStatusItem[];
  counts: Partial<Record<ResearchGapCaseStatus, number>>;
};

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => (
    typeof item === "string" && Boolean(item.trim())
  )).map((item) => item.trim()))];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validStatus(value: unknown): value is ResearchGapCaseStatus {
  return typeof value === "string"
    && (RESEARCH_GAP_CASE_STATUSES as readonly string[]).includes(value);
}

function validOutcome(value: unknown): value is ResearchGapOutcome {
  return typeof value === "string"
    && (RESEARCH_GAP_OUTCOMES as readonly string[]).includes(value);
}

function acknowledged(value: number | null) {
  return typeof value === "number" && Number.isInteger(value) && value >= 200 && value < 300;
}

function row(value: unknown): HybridResearchGapLifecycleRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const gapKey = clean(item.gap_key);
  const sourceRef = clean(item.source_ref);
  const latestDossierId = clean(item.latest_dossier_id);
  const latestDossierAsOf = clean(item.latest_dossier_as_of);
  const updatedAt = clean(item.updated_at);
  if (
    !gapKey
    || !sourceRef
    || !latestDossierId
    || !latestDossierAsOf
    || !updatedAt
    || !validStatus(item.status)
  ) return null;

  return {
    gap_key: gapKey,
    status: item.status,
    research_outcome: validOutcome(item.research_outcome) ? item.research_outcome : null,
    handoff_canonical_status: typeof item.handoff_canonical_status === "number" && Number.isInteger(item.handoff_canonical_status)
      ? item.handoff_canonical_status : null,
    source_kind: clean(item.source_kind),
    source_ref: sourceRef,
    linked_investigation_ids: strings(item.linked_investigation_ids),
    linked_story_ids: strings(item.linked_story_ids),
    latest_dossier_id: latestDossierId,
    latest_dossier_as_of: latestDossierAsOf,
    updated_at: updatedAt,
  };
}

export async function loadHybridResearchGapStatus(
  dossierId: string,
  client?: SupabaseClient,
): Promise<HybridResearchGapStatusProjection | null> {
  const exactDossierId = dossierId.trim();
  if (!exactDossierId) return null;

  const db = client ?? createSupabaseAdminClient();
  const dossier = await getMarketDossierV2ById(exactDossierId, db);
  if (!dossier) return null;

  const queue = buildResearchGapWorkQueue(dossier);
  const candidates = queue.candidates.filter(
    (item): item is typeof item & { sourceKind: HybridResearchGapSourceKind } =>
      item.sourceKind === "research_gap"
      || item.sourceKind === "research_now"
      || item.sourceKind === "investigation",
  );

  if (candidates.length === 0) {
    return {
      contractVersion: "hybrid-research-gap-status/2",
      dossierId: dossier.id,
      dossierAsOf: dossier.as_of,
      items: [],
      counts: {},
    };
  }

  const exactKeys = [...new Set(candidates.map((item) => item.gapKey))];
  const { data, error } = await db
    .from("research_gap_cases")
    .select(HYBRID_RESEARCH_GAP_SAFE_SELECT)
    .in("gap_key", exactKeys);

  if (error) {
    throw new Error(`Failed to load Hybrid Research Gap lifecycle status: ${error.message}`);
  }

  const rowsByKey = new Map<string, HybridResearchGapLifecycleRow>();
  for (const raw of data ?? []) {
    const parsed = row(raw);
    if (parsed && exactKeys.includes(parsed.gap_key)) {
      rowsByKey.set(parsed.gap_key, parsed);
    }
  }

  const items: HybridResearchGapStatusItem[] = candidates.flatMap((candidate) => {
    const lifecycle = rowsByKey.get(candidate.gapKey);
    if (!lifecycle) return [];
    return [{
      gapKey: candidate.gapKey,
      sourceKind: candidate.sourceKind,
      sourceRef: candidate.sourceRef,
      lifecycleStatus: lifecycle.status,
      researchOutcome: lifecycle.research_outcome,
      handoffAcknowledged: acknowledged(lifecycle.handoff_canonical_status),
      measurementVerification: "NOT_PROVEN" as const,
      caseMatchesSelectedDossier: lifecycle.latest_dossier_id === dossier.id,
      linkedInvestigationIds: lifecycle.linked_investigation_ids,
      linkedStoryIds: lifecycle.linked_story_ids,
      latestDossierId: lifecycle.latest_dossier_id,
      latestDossierAsOf: lifecycle.latest_dossier_as_of,
      updatedAt: lifecycle.updated_at,
    }];
  });

  const counts: Partial<Record<ResearchGapCaseStatus, number>> = {};
  for (const item of items) {
    counts[item.lifecycleStatus] = (counts[item.lifecycleStatus] ?? 0) + 1;
  }

  return {
    contractVersion: "hybrid-research-gap-status/2",
    dossierId: dossier.id,
    dossierAsOf: dossier.as_of,
    items,
    counts,
  };
}
