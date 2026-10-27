/**
 * Bluebelly Presenter: read-only, non-canonical trust boundary.
 * This projects saved owner chart notes alongside an existing Dossier read model.
 * A broad macro Regime lens never proves an instrument's EMA-band signal.
 */
import { MONITOR_SPECS, type PresenterCheckItem } from "./presenter-technical-checks.ts";
import type { DossierPresentationSelection } from "./dossier-v2/presentation-reader.ts";

/** Minimal serializable projection; never ship the full immutable Dossier to a client. */
export type PresenterDossierSelection = Pick<
  DossierPresentationSelection, "status" | "selectedDossierId" | "selectedAsOf"
> & {
  presentation: {
    dossierId: string;
    asOf: string;
    health: { degraded: boolean };
    regimeStrip: Array<{
      key: string;
      observed: boolean;
      reaction: string | null;
      interpretation: string;
      evidenceRefs: string[];
    }>;
  } | null;
};

export function projectPresenterDossierSelection(
  selection: DossierPresentationSelection | null,
): PresenterDossierSelection | null {
  if (!selection) return null;
  const presentation = selection.presentation;
  return {
    status: selection.status,
    selectedDossierId: selection.selectedDossierId,
    selectedAsOf: selection.selectedAsOf,
    presentation: presentation ? {
      dossierId: presentation.dossierId,
      asOf: presentation.asOf,
      health: { degraded: presentation.health.degraded },
      regimeStrip: presentation.regimeStrip.map(lens => ({
        key: lens.key,
        observed: lens.observed,
        reaction: lens.reaction,
        interpretation: lens.interpretation,
        evidenceRefs: [...lens.evidenceRefs],
      })),
    } : null,
  };
}

export const PRESENTER_RECONCILIATION_CONTRACT = "presenter-reconciliation/1" as const;
export type ReconciliationVerdict = "AGREEMENT" | "DISAGREEMENT" | "UNAVAILABLE";
export type ReconciliationRow = {
  key: string;
  title: string;
  group: "Core" | "Additional";
  ownerReading: string | null;
  ownerAlignment: PresenterCheckItem["alignment"] | null;
  observedOn: string | null;
  savedAt: string | null;
  observationState: "SAVED" | "STALE" | "NOT_SAVED";
  dossierId: string | null;
  dossierAsOf: string | null;
  dossierLens: string | null;
  dossierContext: string | null;
  canonicalEvidenceIds: string[];
  contextState: "SOURCE_LINKED_CONTEXT" | "UNAVAILABLE";
  verdict: ReconciliationVerdict;
  verdictReason: string;
  confirmOrInvalidate: string;
  presenterTalkingPoint: string;
};

const LENS_BY_CHECK: Readonly<Record<string, string | null>> = {
  "dxy-4h": "USD", "dxy-1d": "USD",
  "jxy": null, "us02y-30y": "BONDS",
  "spx-log-channel-rollover": "BREADTH",
  "smh-qqq": "TECH_AI", "us10y-real": "BONDS",
  "hy-credit": "CREDIT", "vix": null,
  "equity-breadth": "BREADTH", "gold": "GOLD",
  "oil": "OIL_WAR_INFLATION", "move-vix": null,
  "copper-gold": null,
};
const NEXT_CHECK: Readonly<Record<string, string>> = {
  "dxy-4h": "Inspect the last completed DXY 4H EMA20 band break and its candle time.",
  "dxy-1d": "Inspect the last completed DXY daily EMA20 band break.",
  "jxy": "Inspect the yen index itself; a general USD lens is not JXY evidence.",
  "us02y-30y": "Measure the actual US 2Y minus 30Y spread with matched timestamps and units.",
  "spx-log-channel-rollover": "Check the SPX log-channel retest, close and independent breadth measures.",
  "smh-qqq": "Check dated SMH/QQQ relative price strength and both EMA bands.",
  "us10y-real": "Verify the instrument's real-yield definition and measurement date.",
  "hy-credit": "Verify the credit-spread series, units and quote timestamp.",
  "vix": "Check current and previous VIX observations from the same series.",
  "equity-breadth": "Compare dated SPX/NDX breadth with price and constituent participation.",
  "gold": "Inspect gold's dated band and real yields using the same market window.",
  "oil": "Inspect dated Brent/WTI EMA structure and independently verified supply data.",
  "move-vix": "Inspect comparable MOVE and VIX observations and their times.",
  "copper-gold": "Inspect copper/gold prices, units, ratio method and matching timestamps.",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}
function asReadModel(selection: PresenterDossierSelection | null, now: number) {
  if (!selection || !selection.presentation
    || !["current", "fallback_previous_healthy", "historical_exact"].includes(selection.status)
    || selection.presentation.health.degraded
    || selection.presentation.dossierId !== selection.selectedDossierId
    || selection.presentation.asOf !== selection.selectedAsOf) return null;
  const asOfMs = validDate(selection.presentation.asOf);
  if (asOfMs === null || asOfMs > now) return null;
  return selection.presentation;
}

/**
 * This version intentionally does not infer agreement/disagreement from Regime
 * text, user-selected alignment or neighbouring price windows. A later
 * instrument-level evidence adapter may produce those verdicts only with
 * exactly matched assets, periods and canonical evidence provenance.
 */
export function reconcilePresenterObservations(
  checks: readonly PresenterCheckItem[] | null,
  dossierSelection: PresenterDossierSelection | null,
  nowIso: string,
): { contractVersion: typeof PRESENTER_RECONCILIATION_CONTRACT; rows: ReconciliationRow[] } {
  const now = validDate(nowIso);
  const dossier = now === null ? null : asReadModel(dossierSelection, now);
  const byKey = new Map((checks ?? []).filter((item) => item && typeof item.key === "string")
    .map((item) => [item.key, item]));
  const rows = MONITOR_SPECS.map((spec): ReconciliationRow => {
    const item = byKey.get(spec.key);
    const observed = item?.observedOn && /^\d{4}-\d{2}-\d{2}$/.test(item.observedOn)
      ? validDate(item.observedOn + "T00:00:00Z") : null;
    const saved = validDate(item?.updatedAt);
    const dated = observed !== null && saved !== null && now !== null && observed <= now && saved <= now;
    const ageDays = dated ? (now! - observed!) / 86400000 : null;
    const observationState = !dated ? "NOT_SAVED" as const
      : ageDays! > 7 ? "STALE" as const : "SAVED" as const;
    const lensKey = LENS_BY_CHECK[spec.key];
    const lens = dossier && lensKey && Array.isArray(dossier.regimeStrip)
      ? dossier.regimeStrip.find((row) => row && row.key === lensKey) : null;
    const evidenceIds = lens?.observed && Array.isArray(lens.evidenceRefs)
      ? [...new Set(lens.evidenceRefs.filter((id) => typeof id === "string" && UUID.test(id)))].slice(0, 12) : [];
    const linked = Boolean(dossier && lens && evidenceIds.length && lens.observed);
    const nextCheck = NEXT_CHECK[spec.key];
    const ownerReading = dated ? item!.technical : null;
    const dossierContext = linked
      ? [lens!.reaction, lens!.interpretation].filter((part) => typeof part === "string" && part.trim()).join(" — ").slice(0, 850) || null
      : null;
    const talkingPoint = dated
      ? "My chart observation from " + item!.observedOn + " is " + item!.technical
        + ". " + (dossierContext
          ? "The source-linked Dossier " + lensKey + " context is: " + dossierContext + ". "
          : "An independently source-linked, asset-specific Dossier comparison is not available. ")
        + "This does not establish an instrument-level agreement. " + nextCheck
      : "No dated chart observation has been saved for " + spec.title
        + ". Check the chart before making an on-air claim. " + nextCheck;
    return {
      key: spec.key, title: spec.title, group: spec.group,
      ownerReading, ownerAlignment: dated ? item!.alignment : null,
      observedOn: dated ? item!.observedOn : null,
      savedAt: dated ? item!.updatedAt : null,
      observationState,
      dossierId: linked ? dossier!.dossierId : null,
      dossierAsOf: linked ? dossier!.asOf : null,
      dossierLens: linked ? lensKey : null,
      dossierContext, canonicalEvidenceIds: evidenceIds,
      contextState: linked ? "SOURCE_LINKED_CONTEXT" : "UNAVAILABLE",
      verdict: "UNAVAILABLE",
      verdictReason: "The existing Dossier lens is broad macro context; no equivalent verified instrument/timeframe observation proves this owner's technical view. User-selected alignment is not independent verification.",
      confirmOrInvalidate: nextCheck,
      presenterTalkingPoint: talkingPoint,
    };
  });
  return { contractVersion: PRESENTER_RECONCILIATION_CONTRACT, rows };
}
