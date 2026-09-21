import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase/admin.ts";
import type { MarketDossierV2 } from "./contracts.ts";
import {
  buildDossierV2Presentation,
  type DossierPresentationV1,
} from "./presentation-adapter.ts";
import { getMarketDossierV2ById } from "./persistence.ts";
import { validateMarketDossierV2Record } from "./validation.ts";

export type DossierPresentationSelectionStatus =
  | "current"
  | "fallback_previous_healthy"
  | "degraded_latest"
  | "historical_exact"
  | "unavailable";

export type DossierPresentationSelection = {
  status: DossierPresentationSelectionStatus;
  requestedDossierId?: string | null;
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

export type DossierHistoryItem = {
  id: string;
  previousDossierId: string | null;
  asOf: string;
  createdAt: string;
  headline: string;
  epistemicLabel: string;
  health: "healthy" | "degraded";
  storyCount: number;
  researchNowCount: number;
  coreChartCount: number;
};

export type DossierHistoryIndex = {
  contractVersion: "dossier-history/1";
  items: DossierHistoryItem[];
  omittedInvalidCount: number;
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

export function selectExactDossierV2Presentation(
  dossier: MarketDossierV2 | null,
  previousDossier: MarketDossierV2 | null = null,
  requestedDossierId: string | null = dossier?.id ?? null,
): DossierPresentationSelection {
  if (!dossier) {
    return {
      status: "unavailable",
      requestedDossierId,
      presentation: null,
      latestDossierId: null,
      selectedDossierId: null,
      latestAsOf: null,
      selectedAsOf: null,
      usingFallback: false,
      notice: {
        tone: "error",
        label: "Historical Dossier unavailable",
        detail: "The requested immutable Dossier V2 record does not exist or cannot be rendered.",
      },
    };
  }

  try {
    const presentation = buildDossierV2Presentation(dossier, previousDossier);
    const degraded = !presentationIsHealthy(presentation);
    return {
      status: "historical_exact",
      requestedDossierId: requestedDossierId ?? dossier.id,
      presentation,
      latestDossierId: null,
      selectedDossierId: dossier.id,
      latestAsOf: null,
      selectedAsOf: dossier.as_of,
      usingFallback: false,
      notice: {
        tone: degraded ? "warn" : "ready",
        label: degraded ? "Historical Dossier · degraded" : "Historical Dossier",
        detail: degraded
          ? "Showing the exact immutable historical Dossier, including the degradation recorded at that time."
          : "Showing the exact immutable historical Dossier. No newer Dossier has been substituted.",
      },
    };
  } catch {
    return {
      status: "unavailable",
      requestedDossierId: requestedDossierId ?? dossier.id,
      presentation: null,
      latestDossierId: null,
      selectedDossierId: null,
      latestAsOf: null,
      selectedAsOf: null,
      usingFallback: false,
      notice: {
        tone: "error",
        label: "Historical Dossier unavailable",
        detail: "The requested immutable Dossier exists, but its analytical payload cannot be rendered safely.",
      },
    };
  }
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

  if (healthy?.dossier.id === latest.id) {
    return {
      status: "current",
      presentation: healthy.presentation,
      latestDossierId: latest.id,
      selectedDossierId: healthy.dossier.id,
      latestAsOf: latest.as_of,
      selectedAsOf: healthy.dossier.as_of,
      usingFallback: false,
      notice: {
        tone: "ready",
        label: "Current Dossier",
        detail: "Showing the latest healthy persisted Dossier V2.",
      },
    };
  }

  if (healthy) {
    const latestReason = latestCandidate
      ? "The latest Dossier is degraded."
      : "The latest Dossier payload could not be rendered safely.";
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
        label: "Using prior healthy Dossier",
        detail: `${latestReason} Showing the most recent healthy persisted Dossier instead.`,
      },
    };
  }

  if (latestCandidate) {
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
        label: "Degraded Dossier",
        detail: "No prior healthy Dossier is available, so the latest degraded Dossier is shown with its gaps intact.",
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

export async function getDossierV2PresentationSelectionById(
  id: string,
  client?: SupabaseClient,
): Promise<DossierPresentationSelection> {
  const dbClient = client ?? createSupabaseAdminClient();
  const dossier = await getMarketDossierV2ById(id, dbClient);
  if (!dossier) {
    return selectExactDossierV2Presentation(null, null, id);
  }

  let previous: MarketDossierV2 | null = null;
  if (dossier.previous_dossier_id) {
    try {
      previous = await getMarketDossierV2ById(dossier.previous_dossier_id, dbClient);
    } catch {
      previous = null;
    }
  }

  return selectExactDossierV2Presentation(dossier, previous, id);
}

export async function getDossierV2HistoryIndex(
  limit = 24,
  client?: SupabaseClient,
): Promise<DossierHistoryIndex> {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit) || 24));
  const dbClient = client ?? createSupabaseAdminClient();

  const { data, error } = await dbClient
    .from("market_dossiers_v2")
    .select("id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at")
    .order("as_of", { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(`Failed to load Market Dossier V2 history: ${error.message}`);
  }

  const items: DossierHistoryItem[] = [];
  let omittedInvalidCount = 0;

  for (const row of data ?? []) {
    try {
      const dossier = validateMarketDossierV2Record(row);
      const presentation = buildDossierV2Presentation(dossier);
      items.push({
        id: dossier.id,
        previousDossierId: dossier.previous_dossier_id,
        asOf: dossier.as_of,
        createdAt: dossier.created_at,
        headline: presentation.header.headline,
        epistemicLabel: presentation.header.epistemicLabel,
        health: presentationIsHealthy(presentation) ? "healthy" : "degraded",
        storyCount: presentation.whatMattersNow.stories.length,
        researchNowCount: presentation.researchNow.length,
        coreChartCount: presentation.charts.core.length,
      });
    } catch {
      omittedInvalidCount += 1;
    }
  }

  return {
    contractVersion: "dossier-history/1",
    items,
    omittedInvalidCount,
  };
}

