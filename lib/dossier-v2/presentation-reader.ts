import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase/admin.ts";
import type { MarketDossierV2 } from "./contracts.ts";
import {
  buildDossierV2Presentation,
  type DossierPresentationV1,
} from "./presentation-adapter.ts";
import { validateMarketDossierV2Record } from "./validation.ts";

export type DossierPresentationSelectionStatus =
  | "current"
  | "fallback_previous_healthy"
  | "degraded_latest"
  | "unavailable";

export type DossierPresentationSelection = {
  status: DossierPresentationSelectionStatus;
  presentation: DossierPresentationV1 | null;
  latestDossierId: string | null;
  selectedDossierId: string | null;
  latestAsOf: string | null;
  selectedAsOf: string | null;
  usingFallback: boolean;
  notice: {
    tone: "ready" | "warn" | "error";
    label: string;
    detail: string;
  };
};

type CandidatePresentation = {
  dossier: MarketDossierV2;
  presentation: DossierPresentationV1;
};

function byNewest(left: MarketDossierV2, right: MarketDossierV2) {
  const leftTime = Date.parse(left.as_of);
  const rightTime = Date.parse(right.as_of);
  return rightTime - leftTime || right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id);
}

function priorDossier(
  dossier: MarketDossierV2,
  dossiersById: Map<string, MarketDossierV2>,
) {
  return dossier.previous_dossier_id
    ? dossiersById.get(dossier.previous_dossier_id) ?? null
    : null;
}

function buildCandidate(
  dossier: MarketDossierV2,
  dossiersById: Map<string, MarketDossierV2>,
): CandidatePresentation | null {
  try {
    const previous = priorDossier(dossier, dossiersById);
    return {
      dossier,
      presentation: buildDossierV2Presentation(dossier, previous),
    };
  } catch {
    try {
      return {
        dossier,
        presentation: buildDossierV2Presentation(dossier),
      };
    } catch {
      return null;
    }
  }
}

function presentationIsHealthy(presentation: DossierPresentationV1) {
  return (
    !presentation.health.degraded &&
    !presentation.health.researchGaps.some(
      (gap) => gap.category === "RESEARCH_BRAIN_DEGRADED",
    )
  );
}

export function selectDossierV2Presentation(
  records: MarketDossierV2[],
): DossierPresentationSelection {
  if (records.length === 0) {
    return {
      status: "unavailable",
      presentation: null,
      latestDossierId: null,
      selectedDossierId: null,
      latestAsOf: null,
      selectedAsOf: null,
      usingFallback: false,
      notice: {
        tone: "error",
        label: "Dossier unavailable",
        detail: "No persisted Market Dossier V2 record is available.",
      },
    };
  }

  const dossiers = [...records].sort(byNewest);
  const latest = dossiers[0];
  const dossiersById = new Map(dossiers.map((dossier) => [dossier.id, dossier]));
  const built = dossiers
    .map((dossier) => buildCandidate(dossier, dossiersById))
    .filter((candidate): candidate is CandidatePresentation => Boolean(candidate));

  const latestCandidate = built.find((candidate) => candidate.dossier.id === latest.id) ?? null;
  const healthy = built.find((candidate) => presentationIsHealthy(candidate.presentation)) ?? null;

  if (latestCandidate) {
    if (presentationIsHealthy(latestCandidate.presentation)) {
      return {
        status: "current",
        presentation: latestCandidate.presentation,
        latestDossierId: latest.id,
        selectedDossierId: latest.id,
        latestAsOf: latest.as_of,
        selectedAsOf: latest.as_of,
        usingFallback: false,
        notice: {
          tone: "ready",
          label: "Current Dossier",
          detail: "Showing the latest persisted Dossier V2.",
        },
      };
    }

    return {
      status: "degraded_latest",
      presentation: latestCandidate.presentation,
      latestDossierId: latest.id,
      selectedDossierId: latest.id,
      latestAsOf: latest.as_of,
      selectedAsOf: latest.as_of,
      usingFallback: false,
      notice: {
        tone: "warn",
        label: "Current Dossier · research gaps",
        detail: "Showing the latest renderable Dossier with its research gaps intact. Fresh state is not replaced by an older healthy Dossier.",
      },
    };
  }

  if (healthy) {
    return {
      status: "fallback_previous_healthy",
      presentation: healthy.presentation,
      latestDossierId: latest.id,
      selectedDossierId: healthy.dossier.id,
      latestAsOf: latest.as_of,
      selectedAsOf: healthy.dossier.as_of,
      usingFallback: true,
      notice: {
        tone: "warn",
        label: "Using prior renderable Dossier",
        detail: "The latest Dossier payload could not be rendered safely. Showing the most recent healthy persisted Dossier instead.",
      },
    };
  }

  return {
    status: "unavailable",
    presentation: null,
    latestDossierId: latest.id,
    selectedDossierId: null,
    latestAsOf: latest.as_of,
    selectedAsOf: null,
    usingFallback: false,
    notice: {
      tone: "error",
      label: "Dossier unavailable",
      detail: "Persisted Dossier records exist, but none can be rendered safely.",
    },
  };
}

export async function getDossierV2PresentationSelection(
  client?: SupabaseClient,
): Promise<DossierPresentationSelection> {
  const dbClient = client ?? createSupabaseAdminClient();

  const { data, error } = await dbClient
    .from("market_dossiers_v2")
    .select("id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at")
    .order("as_of", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(`Failed to load Market Dossier V2 presentations: ${error.message}`);
  }

  const valid: MarketDossierV2[] = [];
  for (const row of data ?? []) {
    try {
      valid.push(validateMarketDossierV2Record(row));
    } catch {
      // Fail closed per record. A malformed latest row must not prevent a prior
      // healthy immutable Dossier from remaining available to Live/Hybrid.
    }
  }

  return selectDossierV2Presentation(valid);
}
