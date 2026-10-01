import type { SupabaseClient } from "@supabase/supabase-js";

import type { MarketDossierV2 } from "./dossier-v2/contracts.ts";
import { validateMarketDossierV2Record } from "./dossier-v2/validation.ts";
import type { ResearchGapCaseRow } from "./research-gap-lifecycle.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

export type ResearchGapContextSource = {
  sourceType: "research_gap_occurrence" | "dossier_v2" | "macropulse" | "market_motion";
  sourceId: string;
  contractVersion: string;
  asOf: string;
  authority: "operational_authority" | "canonical" | "context_only";
  payload: unknown;
};

export type ResearchGapOccurrenceRow = {
  id: string;
  gap_case_id: string;
  dossier_id: string;
  dossier_as_of: string;
  work_id: string;
  source_kind: string;
  source_ref: string;
  priority_rank: number;
  priority_score: number;
  snapshot: Record<string, unknown>;
  observed_at: string;
  created_at: string;
};

export type ResearchGapPlanContext = {
  gap: ResearchGapCaseRow;
  occurrence: ResearchGapOccurrenceRow;
  authoritativeDossier: MarketDossierV2;
  dossierLineage: MarketDossierV2[];
  frozenAt: string;
  sources: ResearchGapContextSource[];
};

const MAX_DOSSIER_CONTEXT = 3;
const DOSSIER_SELECT = "id,contract_version,previous_dossier_id,as_of,freshness,research_gaps,payload,created_at";
const OCCURRENCE_SELECT = "id,gap_case_id,dossier_id,dossier_as_of,work_id,source_kind,source_ref,priority_rank,priority_score,snapshot,observed_at,created_at";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function iso(value: unknown, label: string) {
  const result = requiredText(value, label);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`${label} must be an ISO timestamp.`);
  return result;
}

export function adaptMacroPulseContext(input: {
  id: string;
  contractVersion: string;
  asOf: string;
  payload: Record<string, unknown>;
}): ResearchGapContextSource {
  return {
    sourceType: "macropulse",
    sourceId: requiredText(input.id, "MacroPulse id"),
    contractVersion: requiredText(input.contractVersion, "MacroPulse contractVersion"),
    asOf: iso(input.asOf, "MacroPulse asOf"),
    authority: "context_only",
    payload: clone(input.payload),
  };
}

export function adaptMarketMotionContext(input: {
  id: string;
  contractVersion: string;
  asOf: string;
  payload: Record<string, unknown>;
}): ResearchGapContextSource {
  return {
    sourceType: "market_motion",
    sourceId: requiredText(input.id, "Market Motion id"),
    contractVersion: requiredText(input.contractVersion, "Market Motion contractVersion"),
    asOf: iso(input.asOf, "Market Motion asOf"),
    authority: "context_only",
    payload: clone(input.payload),
  };
}

function validateLineage(lineage: MarketDossierV2[]) {
  if (lineage.length < 1 || lineage.length > MAX_DOSSIER_CONTEXT) {
    throw new Error("Dossier lineage must contain one to three records.");
  }
  const seen = new Set<string>();
  for (let index = 0; index < lineage.length; index += 1) {
    const current = lineage[index]!;
    if (seen.has(current.id)) throw new Error("Dossier predecessor cycle detected.");
    seen.add(current.id);
    const next = lineage[index + 1];
    if (next && current.previous_dossier_id !== next.id) {
      throw new Error(`Dossier ${current.id} does not link to supplied predecessor ${next.id}.`);
    }
    if (current.previous_dossier_id && seen.has(current.previous_dossier_id)) {
      throw new Error("Dossier predecessor cycle detected.");
    }
    if (!next && index < MAX_DOSSIER_CONTEXT - 1 && current.previous_dossier_id !== null) {
      throw new Error(`Dossier ${current.id} has a missing predecessor ${current.previous_dossier_id}.`);
    }
  }
}

export function buildResearchGapPlanContext(input: {
  gap: ResearchGapCaseRow;
  occurrence: ResearchGapOccurrenceRow;
  dossierLineage: MarketDossierV2[];
  frozenAt: string;
  additionalSources?: ResearchGapContextSource[];
}): ResearchGapPlanContext {
  const dossierLineage = input.dossierLineage.map(validateMarketDossierV2Record);
  validateLineage(dossierLineage);
  const authoritativeDossier = dossierLineage[0]!;
  if (authoritativeDossier.id !== input.gap.latest_dossier_id) {
    throw new Error("Authoritative Dossier does not match latest_dossier_id.");
  }
  if (
    input.occurrence.gap_case_id !== input.gap.id
    || input.occurrence.work_id !== input.gap.latest_work_id
    || input.occurrence.dossier_id !== input.gap.latest_dossier_id
  ) throw new Error("Research Gap occurrence identity does not match the case.");

  const additional = (input.additionalSources ?? []).map((source) => {
    if (source.authority !== "context_only") throw new Error("Additional context sources must be context_only.");
    return clone(source);
  });
  const snapshotVersion = typeof input.occurrence.snapshot.contractVersion === "string"
    ? input.occurrence.snapshot.contractVersion
    : "research-gap-case-snapshot/1";
  const sources: ResearchGapContextSource[] = [
    {
      sourceType: "research_gap_occurrence",
      sourceId: input.occurrence.id,
      contractVersion: snapshotVersion,
      asOf: iso(input.occurrence.observed_at, "Occurrence observed_at"),
      authority: "operational_authority",
      payload: clone(input.occurrence.snapshot),
    },
    ...dossierLineage.map((item, index): ResearchGapContextSource => ({
      sourceType: "dossier_v2",
      sourceId: item.id,
      contractVersion: item.contract_version,
      asOf: item.as_of,
      authority: index === 0 ? "canonical" : "context_only",
      payload: clone(item),
    })),
    ...additional,
  ];
  return {
    gap: clone(input.gap),
    occurrence: clone(input.occurrence),
    authoritativeDossier: clone(authoritativeDossier),
    dossierLineage: clone(dossierLineage),
    frozenAt: iso(input.frozenAt, "frozenAt"),
    sources,
  };
}

async function single(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export async function loadResearchGapPlanContext(
  gap: ResearchGapCaseRow,
  client: SupabaseClient = createSupabaseAdminClient(),
  now = new Date(),
): Promise<ResearchGapPlanContext> {
  const occurrence = await single(
    client.from("research_gap_case_occurrences")
      .select(OCCURRENCE_SELECT)
      .eq("gap_case_id", gap.id)
      .eq("work_id", gap.latest_work_id)
      .eq("dossier_id", gap.latest_dossier_id)
      .maybeSingle(),
    "Could not load exact Research Gap occurrence",
  );
  if (!occurrence) throw new Error("Exact Research Gap occurrence was not found.");

  const dossierLineage: MarketDossierV2[] = [];
  const seen = new Set<string>();
  let dossierId: string | null = gap.latest_dossier_id;
  while (dossierId && dossierLineage.length < MAX_DOSSIER_CONTEXT) {
    if (seen.has(dossierId)) throw new Error("Dossier predecessor cycle detected.");
    seen.add(dossierId);
    const raw = await single(
      client.from("market_dossiers_v2").select(DOSSIER_SELECT).eq("id", dossierId).maybeSingle(),
      `Could not load Dossier ${dossierId}`,
    );
    if (!raw) throw new Error(`Dossier lineage has a missing predecessor ${dossierId}.`);
    const dossier = validateMarketDossierV2Record(raw);
    dossierLineage.push(dossier);
    dossierId = dossier.previous_dossier_id;
  }

  const additionalSources: ResearchGapContextSource[] = [];
  const exactOccurrence = occurrence as ResearchGapOccurrenceRow;
  if (exactOccurrence.source_kind === "market_motion") {
    const rawMotion = await single(
      client.from("market_motion_items").select("*").eq("id", exactOccurrence.source_ref).maybeSingle(),
      `Could not load exact Market Motion source ${exactOccurrence.source_ref}`,
    );
    if (!rawMotion || typeof rawMotion !== "object" || Array.isArray(rawMotion)) {
      throw new Error("Exact Market Motion source was not found.");
    }
    const motion = rawMotion as Record<string, unknown>;
    additionalSources.push(adaptMarketMotionContext({
      id: requiredText(motion.id, "Market Motion id"),
      contractVersion: requiredText(motion.contract_version, "Market Motion contract_version"),
      asOf: iso(motion.observed_at, "Market Motion observed_at"),
      payload: motion,
    }));
  }

  return buildResearchGapPlanContext({
    gap,
    occurrence: exactOccurrence,
    dossierLineage,
    frozenAt: now.toISOString(),
    additionalSources,
  });
}
