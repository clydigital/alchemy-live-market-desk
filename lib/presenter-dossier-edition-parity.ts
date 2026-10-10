import type { DossierPresentationSelectionStatus } from "./dossier-v2/presentation-reader.ts";
import { presenterDossierEditionContextFromPayload } from "./presenter-dossier-edition-context.ts";

export const PRESENTER_DOSSIER_EDITION_PARITY_CONTRACT = "presenter-dossier-edition-parity/1" as const;

type CurrentDossierSelection = {
  selectedDossierId: string | null;
  selectedAsOf: string | null;
  status: DossierPresentationSelectionStatus;
};

type CurrentImmutableEdition = {
  id: string;
  published_at: string;
  payload: Record<string, unknown>;
  source_record_refs?: unknown;
};

export type DossierEditionParity = {
  contractVersion: typeof PRESENTER_DOSSIER_EDITION_PARITY_CONTRACT;
  status: "SAME" | "OUT_OF_SYNC" | "UNAVAILABLE";
  reason:
    | "MATCHED"
    | "NO_CURRENT_DOSSIER"
    | "NO_TERMINAL_EDITION"
    | "NO_VALID_FROZEN_DOSSIER_CONTEXT"
    | "UNVERIFIED_DOSSIER_SOURCE_REF"
    | "DOSSIER_CHANGED_AFTER_EDITION";
  dossierHealth: "HEALTHY" | "DEGRADED_LATEST" | "HISTORICAL_FALLBACK" | "UNAVAILABLE";
  currentDossierId: string | null;
  currentDossierAsOf: string | null;
  editionId: string | null;
  editionPublishedAt: string | null;
  frozenDossierId: string | null;
  frozenDossierAsOf: string | null;
};

function quality(status: DossierPresentationSelectionStatus): DossierEditionParity["dossierHealth"] {
  if (status === "current") return "HEALTHY";
  if (status === "degraded_latest") return "DEGRADED_LATEST";
  if (status === "fallback_previous_healthy" || status === "historical_exact") return "HISTORICAL_FALLBACK";
  return "UNAVAILABLE";
}

function asTime(value: unknown) {
  return typeof value === "string" && value.trim() ? Date.parse(value) : Number.NaN;
}

function validSourceRef(value: unknown, dossierId: string, dossierAsOf: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.type === "market_dossier_v2"
    && candidate.id === dossierId
    && Number.isFinite(asTime(candidate.asOf))
    && asTime(candidate.asOf) === asTime(dossierAsOf);
}

/**
 * Display-only proof of exact Dossier/Hybrid parity. An edition is immutable;
 * a newer valid Dossier must not be backfilled into an older edition or used
 * to fabricate a same-edition Story thesis version.
 *
 * Both frozen payload and the independently stored source-record reference
 * must agree. If either is absent, do not guess from publish time.
 */
export function reconcilePresenterDossierEdition({
  selection,
  edition,
}: {
  selection: CurrentDossierSelection;
  edition: CurrentImmutableEdition | null;
}): DossierEditionParity {
  const shared: DossierEditionParity = {
    contractVersion: PRESENTER_DOSSIER_EDITION_PARITY_CONTRACT,
    status: "UNAVAILABLE",
    reason: "NO_CURRENT_DOSSIER",
    dossierHealth: quality(selection.status),
    currentDossierId: selection.selectedDossierId,
    currentDossierAsOf: selection.selectedAsOf,
    editionId: edition?.id ?? null,
    editionPublishedAt: edition?.published_at ?? null,
    frozenDossierId: null,
    frozenDossierAsOf: null,
  };

  if (!selection.selectedDossierId || !Number.isFinite(asTime(selection.selectedAsOf))) return shared;
  if (!edition) return { ...shared, reason: "NO_TERMINAL_EDITION" };

  const frozen = presenterDossierEditionContextFromPayload(edition.payload);
  if (!frozen || !frozen.dossierId || !frozen.dossierAsOf) {
    return { ...shared, reason: "NO_VALID_FROZEN_DOSSIER_CONTEXT" };
  }
  const observed = { ...shared, frozenDossierId: frozen.dossierId, frozenDossierAsOf: frozen.dossierAsOf };
  const refs = edition.source_record_refs;
  if (!Array.isArray(refs)) return { ...observed, reason: "UNVERIFIED_DOSSIER_SOURCE_REF" };
  const dossierRefs = refs.filter((entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
    && (entry as Record<string, unknown>).type === "market_dossier_v2"
  );
  if (dossierRefs.length !== 1 || !validSourceRef(dossierRefs[0], frozen.dossierId, frozen.dossierAsOf)) {
    return { ...observed, reason: "UNVERIFIED_DOSSIER_SOURCE_REF" };
  }

  const matched = selection.selectedDossierId === frozen.dossierId
    && asTime(selection.selectedAsOf) === asTime(frozen.dossierAsOf);
  return matched
    ? { ...observed, status: "SAME", reason: "MATCHED" }
    : { ...observed, status: "OUT_OF_SYNC", reason: "DOSSIER_CHANGED_AFTER_EDITION" };
}
