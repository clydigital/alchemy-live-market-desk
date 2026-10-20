import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter";
import type { DossierPresentationSelection } from "./dossier-v2/presentation-reader";
import type { MarketIntelligenceSnapshotV1 } from "./market-intelligence-snapshot";

/**
 * P−1 inventory, not a public data release authorisation.
 *
 * CANDIDATE = eligible for an editorial/licensing/security review, NOT yet approved.
 * REVIEW_REQUIRED = inspect nested fields, consumers and provenance before release.
 * OWNER_ONLY_TARGET = migrate existing public/Hybrid callers to an approved,
 * bounded DTO before withdrawing this field from its legacy contract.
 *
 * Deliberately typed against existing API schemas: adding a schema field
 * without classifying it now fails typecheck. This metadata does not rewrite,
 * strip or expose API responses. Gate #834 remains OPEN.
 */
export type PublicApiFieldDisposition =
  | "PUBLIC_CANDIDATE"
  | "REVIEW_REQUIRED"
  | "OWNER_ONLY_TARGET";

export const MARKET_INTELLIGENCE_FIELD_REVIEW = {
  contractVersion: "PUBLIC_CANDIDATE",
  generatedAt: "PUBLIC_CANDIDATE",
  source: "PUBLIC_CANDIDATE",
  dossier: "REVIEW_REQUIRED",
  regime: "REVIEW_REQUIRED",
  dollarLiquidity: "REVIEW_REQUIRED",
  policyLiquidityInteraction: "REVIEW_REQUIRED",
  monetarySignals: "REVIEW_REQUIRED",
  marketState: "REVIEW_REQUIRED",
  stories: "REVIEW_REQUIRED",
  investigations: "OWNER_ONLY_TARGET",
  stockRadar: "REVIEW_REQUIRED",
  creatorVerification: "OWNER_ONLY_TARGET",
  marketMotion: "REVIEW_REQUIRED",
  sourceHealth: "OWNER_ONLY_TARGET",
  contradictions: "OWNER_ONLY_TARGET",
  researchGaps: "OWNER_ONLY_TARGET",
  guardrails: "OWNER_ONLY_TARGET",
} as const satisfies Record<keyof MarketIntelligenceSnapshotV1, PublicApiFieldDisposition>;

export const DOSSIER_SELECTION_FIELD_REVIEW = {
  status: "PUBLIC_CANDIDATE",
  requestedDossierId: "REVIEW_REQUIRED",
  presentation: "REVIEW_REQUIRED",
  latestDossierId: "REVIEW_REQUIRED",
  selectedDossierId: "REVIEW_REQUIRED",
  latestAsOf: "PUBLIC_CANDIDATE",
  selectedAsOf: "PUBLIC_CANDIDATE",
  usingFallback: "PUBLIC_CANDIDATE",
  lastValidDossierId: "REVIEW_REQUIRED",
  lastValidAsOf: "PUBLIC_CANDIDATE",
  calibrationHistory: "OWNER_ONLY_TARGET",
  calibrationLineages: "OWNER_ONLY_TARGET",
  notice: "REVIEW_REQUIRED",
} as const satisfies Record<keyof DossierPresentationSelection, PublicApiFieldDisposition>;

export const DOSSIER_PRESENTATION_FIELD_REVIEW = {
  contractVersion: "PUBLIC_CANDIDATE",
  dossierId: "REVIEW_REQUIRED",
  previousDossierId: "REVIEW_REQUIRED",
  asOf: "PUBLIC_CANDIDATE",
  createdAt: "PUBLIC_CANDIDATE",
  health: "OWNER_ONLY_TARGET",
  memory: "OWNER_ONLY_TARGET",
  header: "REVIEW_REQUIRED",
  regimeStrip: "REVIEW_REQUIRED",
  policyOutlook: "REVIEW_REQUIRED",
  rateRegime: "REVIEW_REQUIRED",
  dollarLiquidity: "REVIEW_REQUIRED",
  policyLiquidityInteraction: "REVIEW_REQUIRED",
  whatMattersNow: "REVIEW_REQUIRED",
  watchNext: "REVIEW_REQUIRED",
  investigationAudit: "OWNER_ONLY_TARGET",
  investigationJourney: "OWNER_ONLY_TARGET",
  reactionCalibration: "OWNER_ONLY_TARGET",
  researchNow: "OWNER_ONLY_TARGET",
  charts: "REVIEW_REQUIRED",
  stockRadar: "REVIEW_REQUIRED",
  themes: "REVIEW_REQUIRED",
  creatorThemes: "OWNER_ONLY_TARGET",
  thesisChanges: "OWNER_ONLY_TARGET",
  evidenceIndex: "OWNER_ONLY_TARGET",
  motionRegimeContext: "OWNER_ONLY_TARGET",
  motionAdjudicationContext: "OWNER_ONLY_TARGET",
  evidenceGovernance: "OWNER_ONLY_TARGET",
  evidenceSufficiency: "OWNER_ONLY_TARGET",
  decisionPacket: "OWNER_ONLY_TARGET",
  longitudinalAdjudication: "OWNER_ONLY_TARGET",
  diagnostics: "OWNER_ONLY_TARGET",
} as const satisfies Record<keyof DossierPresentationV1, PublicApiFieldDisposition>;

/** No legacy response can be assumed approved just because its field was inventoried. */
export function isPublicFieldApproved(_api: string, _field: string): false {
  return false;
}
