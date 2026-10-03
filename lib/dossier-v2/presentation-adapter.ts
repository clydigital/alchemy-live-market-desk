import type { MarketDossierV2 } from "./contracts.ts";
import type { DossierPolicyOutlookItem } from "./policy-outlook.ts";
import type {
  PolicyLiquidityInteraction,
  System1DollarLiquiditySnapshot,
} from "./system1-dollar-liquidity.ts";
import type { System1ReactionAssessment, System1ReactionPathPoint } from "./system1-divergence.ts";
import type { RateCurveDiagnostic } from "./rate-curve-diagnostic.ts";
import type { RateLongEndDiagnostic } from "./rate-long-end-diagnostic.ts";
import type { RateGlobalDurationDiagnostic } from "./rate-global-duration-diagnostic.ts";
import type { RateCrossAssetTransmission } from "./rate-cross-asset-transmission.ts";
import type {
  ChartTask,
  CreatorThemeExpansion,
  DevelopingTheme,
  EpistemicLabel,
  Investigation,
  MajorStory,
  MarketLens,
  RegimeFamily,
  ResearchBrainOutputV1,
  ResearchNowAction,
  StockRadarItem,
  ThesisLedgerEntryV2,
} from "./research-brain-contracts.ts";

export const DOSSIER_PRESENTATION_V1 = "dossier-presentation/1" as const;

export type DossierPresentationHealth = {
  state: "healthy" | "degraded";
  degraded: boolean;
  repairUsed: boolean;
  freshnessWarnings: string[];
  researchGaps: Array<{
    id: string;
    category: string;
    severity: string;
    description: string;
  }>;
  missingInputCategories: string[];
};

export type DossierPresentationLens = {
  key: string;
  label: string;
  observed: boolean;
  reaction: string | null;
  interpretation: string;
  evidenceRefs: string[];
  unresolvedSignals: string[];
};

export type DossierRateRegime = {
  contractVersion?: string;
  asOf?: string;
  state: "HAWKISH" | "DOVISH" | "NEUTRAL" | "MIXED" | "UNRESOLVED";
  score?: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED";
  summary?: string;
  nextMeetingRateOutlook: "MORE_HAWKISH" | "MORE_DOVISH" | null;
  fedWatchExpectedDirection: "HIKE_ODDS_UP" | "HIKE_ODDS_DOWN" | null;
  trigger: string | null;
  observedRatePricing: string | null;
  observedConfirmation: string | null;
  usRatesReaction: string | null;
  usRatesInterpretation: string | null;
  fredBacked: boolean;
  curve?: {
    spreadBps: number | null;
    state: "INVERTED" | "FLAT" | "POSITIVE" | "UNRESOLVED";
    detail: string;
    evidenceRefs: string[];
  };
  curveDiagnostic?: RateCurveDiagnostic;
  longEndDiagnostic?: RateLongEndDiagnostic;
  globalDurationDiagnostic?: RateGlobalDurationDiagnostic;
  crossAssetTransmission?: RateCrossAssetTransmission;
  signals?: Array<{
    key: string;
    label: string;
    state: "HAWKISH" | "DOVISH" | "NEUTRAL" | "MIXED" | "UNRESOLVED";
    score: number;
    detail: string;
    evidenceRefs: string[];
  }>;
  drivers?: string[];
  contradictions?: string[];
  coverage?: {
    present: number;
    total: number;
    missing: string[];
  };
  evidenceRefs: string[];
  gaps: string[];
};

export type DossierPresentationStory = {
  id: string;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  mechanism: string;
  conclusion: string;
  whatWouldChangeMind: string;
  epistemicLabel: EpistemicLabel;
  evidenceRefs: string[];
  investigationIds: string[];
  chartIds: string[];
};

export type DossierPresentationReactionPathPoint = {
  window: "5m" | "30m" | "4h" | "close" | "next_session";
  baselineAt: string;
  observedAt: string;
  baseline: number;
  observed: number;
  changePct: number;
  observedDirection: "UP" | "DOWN" | "FLAT";
};

export type DossierPresentationReactionCheck = {
  checkId: string;
  instrument: string;
  expectedDirection: "UP" | "DOWN";
  observedDirection: "UP" | "DOWN";
  observedChangePct: number;
  observedInstrument: string;
  isProxy: boolean;
  reactionWindow: "5m" | "30m" | "4h" | "close" | "next_session" | null;
  reactionPath: DossierPresentationReactionPathPoint[];
  relation: "ALIGNED" | "DIVERGENT";
  timingPrecision: "INTRADAY" | "DAILY_POST_EVENT";
  triggerEvidenceRef: string;
  marketEvidenceRef: string;
};

export type DossierPresentationInvestigationTransition =
  | "BASELINE"
  | "NEW"
  | "UNCHANGED"
  | "DIVERGENCE_DETECTED"
  | "DIVERGENCE_ESCALATED"
  | "DIVERGENCE_DEESCALATED"
  | "EVIDENCE_BECAME_UNRESOLVED"
  | "ALIGNED_CONFIRMED"
  | "REOPENED"
  | "CLOSED"
  | "STATUS_CHANGED"
  | "NOT_CARRIED_FORWARD";

export type DossierPresentationInvestigationJourney = {
  currentId: string | null;
  previousId: string | null;
  matchedBy: "id" | "linkage" | null;
  transition: DossierPresentationInvestigationTransition;
  previousDivergence: Investigation["divergence"] | null;
  currentDivergence: Investigation["divergence"] | null;
  previousStatus: Investigation["status"] | null;
  currentStatus: Investigation["status"] | null;
  previousExpectedReaction: string | null;
  currentExpectedReaction: string | null;
  expectationChanged: boolean | null;
  question: string;
};

export type DossierPresentationReactionCalibration = {
  basis: "SYSTEM1_REACTION_AUDIT";
  outcome: "UNRESOLVED" | "ALIGNED" | "DIVERGENT" | "MIXED";
  precision: "NONE" | "INTRADAY" | "DAILY_POST_EVENT" | "MIXED";
  checkCount: number;
  alignedCount: number;
  divergentCount: number;
  reactionWindows: Array<"5m" | "30m" | "4h" | "close" | "next_session">;
  expectationChanged: boolean | null;
  requiresReview: boolean;
};

export type DossierPresentationCalibrationSummary = {
  evaluatedInvestigations: number;
  alignedInvestigations: number;
  divergentInvestigations: number;
  mixedInvestigations: number;
  unresolvedInvestigations: number;
  intradayInvestigations: number;
  expectationChangedInvestigations: number;
  reviewQueue: string[];
};

export type DossierPresentationCandidateExplanation = {
  rank: number;
  explanation: string;
  evidenceForRefs: string[];
  evidenceAgainstRefs: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED";
  discriminatingTest: string;
};

export type DossierPresentationInvestigation = {
  id: string;
  status: Investigation["status"];
  question: string;
  whyItMatters: string;
  currentExplanation: string;
  expectedReaction: string | null;
  observedReaction: string | null;
  divergence: Investigation["divergence"];
  competingExplanations: string[];
  candidateExplanations: DossierPresentationCandidateExplanation[];
  researchNext: string;
  confirmationCondition: string;
  invalidationCondition: string;
  evidenceRefs: string[];
  missingEvidence: string[];
  chartIds: string[];
  storyIds: string[];
  thesisIds: string[];
  reactionChecks: DossierPresentationReactionCheck[];
  reactionCalibration: DossierPresentationReactionCalibration;
  journey: DossierPresentationInvestigationJourney;
};

export type DossierPresentationChart = ChartTask & {
  lane: "core" | "optional";
};

export type DossierPresentationThesisChange = {
  thesisId: string;
  title: string;
  statement: string;
  state: ThesisLedgerEntryV2["state"];
  previousState: ThesisLedgerEntryV2["state"] | null;
  version: number;
  previousVersion: number | null;
  change: "new" | "state_changed" | "version_changed";
  reason: string;
  nextCatalystOrTripwire: string;
  evidenceRefs: string[];
};

export type DossierPresentationEvidenceRef = {
  evidenceId: string;
  usedIn: string[];
};

export type DossierPresentationV1 = {
  contractVersion: typeof DOSSIER_PRESENTATION_V1;
  dossierId: string;
  previousDossierId: string | null;
  asOf: string;
  createdAt: string;

  health: DossierPresentationHealth;

  header: {
    headline: string;
    answer: string;
    regimeImplication: string;
    regimeFamily: RegimeFamily;
    epistemicLabel: EpistemicLabel;
    whatWouldChangeMind: string;
  };

  regimeStrip: DossierPresentationLens[];
  policyOutlook: DossierPolicyOutlookItem[];
  rateRegime: DossierRateRegime;
  dollarLiquidity?: System1DollarLiquiditySnapshot | null;
  policyLiquidityInteraction?: PolicyLiquidityInteraction | null;

  whatMattersNow: {
    leadThreadId: string;
    supportingStoryIds: string[];
    stories: DossierPresentationStory[];
  };

  watchNext: DossierPresentationInvestigation[];
  investigationAudit: DossierPresentationInvestigation[];
  investigationJourney: DossierPresentationInvestigationJourney[];
  reactionCalibration: DossierPresentationCalibrationSummary;
  researchNow: ResearchNowAction[];

  charts: {
    core: DossierPresentationChart[];
    optional: DossierPresentationChart[];
  };

  stockRadar: StockRadarItem[];
  themes: DevelopingTheme[];
  creatorThemes: CreatorThemeExpansion[];
  thesisChanges: DossierPresentationThesisChange[];

  evidenceIndex: DossierPresentationEvidenceRef[];

  diagnostics: {
    modelRepairUsed: boolean;
    notes: string[];
    omittedOrDemotedItems: string[];
  };
};

const REGIME_LENS_ORDER = [
  "US_RATES",
  "BONDS",
  "USD",
  "GOLD",
  "CREDIT",
  "TECH_AI",
  "BREADTH",
  "OIL_WAR_INFLATION",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function analyticalOutput(dossier: MarketDossierV2): ResearchBrainOutputV1 {
  const value = dossier.payload.analytical_output;
  if (!isObject(value)) {
    throw new Error(`Dossier ${dossier.id} has no analytical_output payload.`);
  }

  const mainThread = value.main_thread;
  if (!isObject(mainThread) || typeof mainThread.headline !== "string") {
    throw new Error(`Dossier ${dossier.id} has an invalid analytical_output payload.`);
  }

  return value as unknown as ResearchBrainOutputV1;
}

function freshnessWarnings(dossier: MarketDossierV2): string[] {
  const warnings = Array.isArray(dossier.freshness.warnings)
    ? dossier.freshness.warnings
    : [];

  return warnings.flatMap((warning) => {
    if (typeof warning === "string" && warning.trim()) return [warning.trim()];
    if (!isObject(warning)) return [];
    const message = typeof warning.message === "string" ? warning.message.trim() : "";
    return message ? [message] : [];
  });
}

function policyOutlook(dossier: MarketDossierV2): DossierPolicyOutlookItem[] {
  const value = dossier.payload.system1_policy_outlook;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item) || typeof item.id !== "string" || typeof item.trigger !== "string") return [];
    return [item as unknown as DossierPolicyOutlookItem];
  }).slice(0, 3);
}

function rateRegime(
  dossier: MarketDossierV2,
  outlook: DossierPolicyOutlookItem[],
  lenses: DossierPresentationLens[],
): DossierRateRegime {
  const stored = dossier.payload.system1_rate_regime;
  if (
    isObject(stored) &&
    typeof stored.state === "string" &&
    Array.isArray(stored.evidenceRefs) &&
    Array.isArray(stored.gaps)
  ) {
    return stored as unknown as DossierRateRegime;
  }

  const ratesLens = lenses.find((lens) => lens.key === "US_RATES") ?? null;
  const primary = outlook[0] ?? null;
  const impulses = new Set(outlook.map((item) => item.policyImpulse));
  const state: DossierRateRegime["state"] = impulses.size === 0
    ? "UNRESOLVED"
    : impulses.size === 1
      ? ([...impulses][0] as "HAWKISH" | "DOVISH")
      : "MIXED";

  const evidenceRefs = [...new Set([
    ...(ratesLens?.evidenceRefs ?? []),
    ...(primary ? [
      primary.triggerEvidenceRef,
      primary.observedRatePricingEvidenceRef,
      primary.observedConfirmationEvidenceRef,
    ] : []),
  ].filter((value): value is string => typeof value === "string" && Boolean(value)))];

  const gaps = [...new Set([
    ...(primary?.gaps ?? []),
    ...(ratesLens?.unresolvedSignals ?? []),
  ].filter((value) => Boolean(value)))];

  return {
    state,
    nextMeetingRateOutlook: primary?.nextMeetingRateOutlook ?? null,
    fedWatchExpectedDirection: primary?.fedWatchExpectedDirection ?? null,
    trigger: primary?.trigger ?? null,
    observedRatePricing: primary?.observedRatePricing ?? null,
    observedConfirmation: primary?.observedConfirmation ?? null,
    usRatesReaction: ratesLens?.reaction ?? null,
    usRatesInterpretation: ratesLens?.interpretation ?? null,
    fredBacked: evidenceRefs.some((id) => /^market-monitor:us2y(?::|$)/i.test(id)),
    evidenceRefs,
    gaps,
  };
}

function dollarLiquidity(dossier: MarketDossierV2): System1DollarLiquiditySnapshot | null {
  const value = dossier.payload.system1_dollar_liquidity;
  if (
    !isObject(value)
    || value.contractVersion !== "system1-dollar-liquidity/1"
    || typeof value.state !== "string"
    || !Array.isArray(value.components)
  ) return null;
  return value as unknown as System1DollarLiquiditySnapshot;
}

function policyLiquidityInteraction(dossier: MarketDossierV2): PolicyLiquidityInteraction | null {
  const value = dossier.payload.system1_policy_liquidity_interaction;
  if (
    !isObject(value)
    || typeof value.policyState !== "string"
    || typeof value.liquidityState !== "string"
    || typeof value.alignment !== "string"
  ) return null;
  return value as unknown as PolicyLiquidityInteraction;
}

function system1ReactionAssessments(dossier: MarketDossierV2): System1ReactionAssessment[] {
  const value = dossier.payload.system1_reaction_assessments;
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      !isObject(item)
      || typeof item.check_id !== "string"
      || typeof item.trigger_evidence_id !== "string"
      || typeof item.market_evidence_id !== "string"
      || typeof item.instrument !== "string"
      || (item.expected_direction !== "UP" && item.expected_direction !== "DOWN")
      || (item.observed_direction !== "UP" && item.observed_direction !== "DOWN")
      || typeof item.observed_change_pct !== "number"
      || (item.relation !== "ALIGNED" && item.relation !== "DIVERGENT")
      || (item.timing_precision !== "INTRADAY" && item.timing_precision !== "DAILY_POST_EVENT")
    ) return [];

    const reactionWindow =
      item.reaction_window === "5m"
      || item.reaction_window === "30m"
      || item.reaction_window === "4h"
      || item.reaction_window === "close"
      || item.reaction_window === "next_session"
        ? item.reaction_window
        : null;

    const reactionPath = Array.isArray(item.reaction_path)
      ? item.reaction_path.flatMap((rawPoint) => {
        if (!isObject(rawPoint)) return [];
        const window =
          rawPoint.window === "5m"
          || rawPoint.window === "30m"
          || rawPoint.window === "4h"
          || rawPoint.window === "close"
          || rawPoint.window === "next_session"
            ? rawPoint.window
            : null;
        const baselineAt = typeof rawPoint.baseline_at === "string" ? rawPoint.baseline_at : null;
        const observedAt = typeof rawPoint.observed_at === "string" ? rawPoint.observed_at : null;
        const baseline = typeof rawPoint.baseline === "number" && Number.isFinite(rawPoint.baseline) ? rawPoint.baseline : null;
        const observed = typeof rawPoint.observed === "number" && Number.isFinite(rawPoint.observed) ? rawPoint.observed : null;
        const changePct = typeof rawPoint.change_pct === "number" && Number.isFinite(rawPoint.change_pct) ? rawPoint.change_pct : null;
        const observedDirection =
          rawPoint.observed_direction === "UP"
          || rawPoint.observed_direction === "DOWN"
          || rawPoint.observed_direction === "FLAT"
            ? rawPoint.observed_direction
            : null;
        return window && baselineAt && observedAt && baseline !== null && observed !== null && changePct !== null && observedDirection
          ? [{
            window,
            baseline_at: baselineAt,
            observed_at: observedAt,
            baseline,
            observed,
            change_pct: changePct,
            observed_direction: observedDirection,
          } satisfies System1ReactionPathPoint]
          : [];
      })
      : [];

    // Backward-compatible with Dossiers persisted before intraday-window V1/V2.
    // Legacy assessments remain valid audits with direct-instrument identity,
    // no named reaction window and no preserved reaction path.
    return [{
      ...(item as unknown as System1ReactionAssessment),
      observed_instrument:
        typeof item.observed_instrument === "string" && item.observed_instrument.trim()
          ? item.observed_instrument
          : item.instrument,
      is_proxy: item.is_proxy === true,
      reaction_window: reactionWindow,
      reaction_path: reactionPath,
    }];
  });
}

function researchGaps(dossier: MarketDossierV2) {
  return dossier.research_gaps.flatMap((gap, index) => {
    if (!isObject(gap)) return [];
    const severity = typeof gap.severity === "string" ? gap.severity.trim().toUpperCase() : "";
    // Edition-level health is reserved for conclusion-blocking MATERIAL gaps.
    // Older nonblocking refinement gaps remain available in the persisted audit
    // record but are not promoted into the reader-facing Live/Hybrid count.
    if (severity !== "MATERIAL") return [];
    const description = typeof gap.description === "string" ? gap.description.trim() : "";
    if (!description) return [];
    return [{
      id: typeof gap.gap_id === "string" && gap.gap_id.trim() ? gap.gap_id : `gap-${index + 1}`,
      category: typeof gap.category === "string" ? gap.category : "Uncategorised",
      severity,
      description,
    }];
  });
}

function presentationStory(story: MajorStory): DossierPresentationStory {
  return {
    id: story.story_id,
    title: story.title,
    whatChanged: story.what_changed,
    whyItMatters: story.why_it_matters,
    mechanism: story.causal_mechanism,
    conclusion: story.conclusion,
    whatWouldChangeMind: story.what_would_change_mind,
    epistemicLabel: story.epistemic_label,
    evidenceRefs: [...story.evidence_ids],
    investigationIds: [...story.linked_investigation_ids],
    chartIds: [...story.linked_chart_task_ids],
  };
}

function reactionCalibration(
  reactionChecks: DossierPresentationReactionCheck[],
  journey: DossierPresentationInvestigationJourney,
): DossierPresentationReactionCalibration {
  const alignedCount = reactionChecks.filter((item) => item.relation === "ALIGNED").length;
  const divergentCount = reactionChecks.filter((item) => item.relation === "DIVERGENT").length;

  const outcome: DossierPresentationReactionCalibration["outcome"] =
    reactionChecks.length === 0
      ? "UNRESOLVED"
      : alignedCount > 0 && divergentCount > 0
        ? "MIXED"
        : divergentCount > 0
          ? "DIVERGENT"
          : "ALIGNED";

  const precisions = new Set(reactionChecks.map((item) => item.timingPrecision));
  const precision: DossierPresentationReactionCalibration["precision"] =
    reactionChecks.length === 0
      ? "NONE"
      : precisions.size > 1
        ? "MIXED"
        : reactionChecks[0].timingPrecision;

  const reactionWindows = [...new Set(
    reactionChecks.flatMap((item) =>
      item.reactionPath.length
        ? item.reactionPath.map((point) => point.window)
        : item.reactionWindow ? [item.reactionWindow] : []
    ),
  )].sort((left, right) => {
    const rank = { "5m": 0, "30m": 1, "4h": 2, close: 3, next_session: 4 } as const;
    return rank[left] - rank[right];
  });

  return {
    basis: "SYSTEM1_REACTION_AUDIT",
    outcome,
    precision,
    checkCount: reactionChecks.length,
    alignedCount,
    divergentCount,
    reactionWindows,
    expectationChanged: journey.expectationChanged,
    requiresReview:
      outcome === "DIVERGENT"
      || outcome === "MIXED"
      || journey.expectationChanged === true,
  };
}

function presentationInvestigation(
  item: Investigation,
  reactionAssessments: System1ReactionAssessment[],
  journey: DossierPresentationInvestigationJourney,
): DossierPresentationInvestigation {
  const observedIds = new Set(item.observed_evidence);
  const reactionChecks: DossierPresentationReactionCheck[] = reactionAssessments
    .filter((assessment) =>
      observedIds.has(assessment.trigger_evidence_id)
      && observedIds.has(assessment.market_evidence_id)
    )
    .slice(0, 4)
    .map((assessment) => ({
      checkId: assessment.check_id,
      instrument: assessment.instrument,
      expectedDirection: assessment.expected_direction,
      observedDirection: assessment.observed_direction,
      observedChangePct: assessment.observed_change_pct,
      observedInstrument: assessment.observed_instrument,
      isProxy: assessment.is_proxy,
      reactionWindow: assessment.reaction_window,
      reactionPath: assessment.reaction_path.map((point) => ({
        window: point.window,
        baselineAt: point.baseline_at,
        observedAt: point.observed_at,
        baseline: point.baseline,
        observed: point.observed,
        changePct: point.change_pct,
        observedDirection: point.observed_direction,
      })),
      relation: assessment.relation,
      timingPrecision: assessment.timing_precision,
      triggerEvidenceRef: assessment.trigger_evidence_id,
      marketEvidenceRef: assessment.market_evidence_id,
    }));

  const candidateExplanations: DossierPresentationCandidateExplanation[] =
    Array.isArray(item.candidate_explanations) && item.candidate_explanations.length
      ? item.candidate_explanations
        .map((candidate) => ({
          rank: candidate.rank,
          explanation: candidate.explanation,
          evidenceForRefs: [...candidate.evidence_for_ids],
          evidenceAgainstRefs: [...candidate.evidence_against_ids],
          confidence: candidate.confidence,
          discriminatingTest: candidate.discriminating_test,
        }))
        .sort((left, right) => left.rank - right.rank)
        .slice(0, 4)
      : item.divergence === "NONE"
        ? []
        : [
          {
            rank: 1,
            explanation: item.current_explanation,
            evidenceForRefs: [],
            evidenceAgainstRefs: [],
            confidence: "UNRESOLVED" as const,
            discriminatingTest: item.research_next,
          },
          ...item.competing_explanations.slice(0, 3).map((explanation, index) => ({
            rank: index + 2,
            explanation,
            evidenceForRefs: [],
            evidenceAgainstRefs: [],
            confidence: "UNRESOLVED" as const,
            discriminatingTest: item.research_next,
          })),
        ];

  return {
    id: item.investigation_id,
    status: item.status,
    question: item.question,
    whyItMatters: item.why_it_matters,
    currentExplanation: item.current_explanation,
    expectedReaction: item.expected_reaction,
    observedReaction: item.observed_reaction,
    divergence: item.divergence,
    competingExplanations: [...item.competing_explanations],
    candidateExplanations,
    researchNext: item.research_next,
    confirmationCondition: item.confirmation_condition,
    invalidationCondition: item.invalidation_condition,
    evidenceRefs: [...item.observed_evidence],
    missingEvidence: [...item.missing_evidence],
    chartIds: [...item.chart_task_links],
    storyIds: [...item.linked_story_ids],
    thesisIds: [...item.linked_thesis_ids],
    reactionChecks,
    reactionCalibration: reactionCalibration(reactionChecks, journey),
    journey,
  };
}

function normaliseExpectation(value: string | null): string | null {
  if (!value) return null;
  const normalised = value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalised || null;
}

function expectationChanged(previous: Investigation, current: Investigation): boolean {
  return normaliseExpectation(previous.expected_reaction) !== normaliseExpectation(current.expected_reaction);
}

function investigationLinkageKey(item: Investigation): string | null {
  const storyIds = [...new Set(item.linked_story_ids.filter(Boolean))].sort();
  const thesisIds = [...new Set(item.linked_thesis_ids.filter(Boolean))].sort();
  if (!storyIds.length && !thesisIds.length) return null;
  return `stories:${storyIds.join(",")}|theses:${thesisIds.join(",")}`;
}

function transitionForInvestigation(
  previous: Investigation,
  current: Investigation,
): DossierPresentationInvestigationTransition {
  const previousClosed = previous.status === "resolved" || previous.status === "parked";
  const currentClosed = current.status === "resolved" || current.status === "parked";

  if (previousClosed && !currentClosed) return "REOPENED";
  if (!previousClosed && currentClosed) return "CLOSED";

  if (previous.divergence === current.divergence) {
    return previous.status === current.status ? "UNCHANGED" : "STATUS_CHANGED";
  }

  if (current.divergence === "NONE") return "ALIGNED_CONFIRMED";

  const previousDivergent = previous.divergence === "PARTIAL" || previous.divergence === "MATERIAL";
  const currentDivergent = current.divergence === "PARTIAL" || current.divergence === "MATERIAL";

  if (!previousDivergent && currentDivergent) return "DIVERGENCE_DETECTED";
  if (previous.divergence === "PARTIAL" && current.divergence === "MATERIAL") {
    return "DIVERGENCE_ESCALATED";
  }
  if (previous.divergence === "MATERIAL" && current.divergence === "PARTIAL") {
    return "DIVERGENCE_DEESCALATED";
  }
  if (previousDivergent && current.divergence === "UNRESOLVED") {
    return "EVIDENCE_BECAME_UNRESOLVED";
  }
  if (previous.divergence === "NONE" && currentDivergent) return "DIVERGENCE_DETECTED";

  return "STATUS_CHANGED";
}

function investigationJourney(
  current: ResearchBrainOutputV1,
  previous: ResearchBrainOutputV1 | null,
): DossierPresentationInvestigationJourney[] {
  if (!previous) {
    return current.investigations.map((item) => ({
      currentId: item.investigation_id,
      previousId: null,
      matchedBy: null,
      transition: "BASELINE",
      previousDivergence: null,
      currentDivergence: item.divergence,
      previousStatus: null,
      currentStatus: item.status,
      previousExpectedReaction: null,
      currentExpectedReaction: item.expected_reaction,
      expectationChanged: null,
      question: item.question,
    }));
  }

  const previousById = new Map(previous.investigations.map((item) => [item.investigation_id, item]));
  const previousByLinkage = new Map<string, Investigation[]>();
  const currentLinkageCounts = new Map<string, number>();

  for (const item of previous.investigations) {
    const key = investigationLinkageKey(item);
    if (key) {
      const list = previousByLinkage.get(key) ?? [];
      list.push(item);
      previousByLinkage.set(key, list);
    }

  }
  for (const item of current.investigations) {
    const key = investigationLinkageKey(item);
    if (key) currentLinkageCounts.set(key, (currentLinkageCounts.get(key) ?? 0) + 1);

  }

  const usedPreviousIds = new Set<string>();
  const result: DossierPresentationInvestigationJourney[] = [];

  for (const item of current.investigations) {
    let matched = previousById.get(item.investigation_id) ?? null;
    if (matched && usedPreviousIds.has(matched.investigation_id)) matched = null;
    let matchedBy: "id" | "linkage" | null = matched ? "id" : null;

    if (!matched) {
      const key = investigationLinkageKey(item);
      const candidates = key ? previousByLinkage.get(key) ?? [] : [];
      if (
        key
        && currentLinkageCounts.get(key) === 1
        && candidates.length === 1
        && !usedPreviousIds.has(candidates[0].investigation_id)
      ) {
        matched = candidates[0];
        matchedBy = "linkage";
      }
    }


    if (!matched) {
      result.push({
        currentId: item.investigation_id,
        previousId: null,
        matchedBy: null,
        transition: "NEW",
        previousDivergence: null,
        currentDivergence: item.divergence,
        previousStatus: null,
        currentStatus: item.status,
        previousExpectedReaction: null,
        currentExpectedReaction: item.expected_reaction,
        expectationChanged: null,
        question: item.question,
      });
      continue;
    }

    usedPreviousIds.add(matched.investigation_id);
    result.push({
      currentId: item.investigation_id,
      previousId: matched.investigation_id,
      matchedBy,
      transition: transitionForInvestigation(matched, item),
      previousDivergence: matched.divergence,
      currentDivergence: item.divergence,
      previousStatus: matched.status,
      currentStatus: item.status,
      previousExpectedReaction: matched.expected_reaction,
      currentExpectedReaction: item.expected_reaction,
      expectationChanged: expectationChanged(matched, item),
      question: item.question,
    });
  }

  for (const item of previous.investigations) {
    if (usedPreviousIds.has(item.investigation_id)) continue;
    result.push({
      currentId: null,
      previousId: item.investigation_id,
      matchedBy: null,
      transition: "NOT_CARRIED_FORWARD",
      previousDivergence: item.divergence,
      currentDivergence: null,
      previousStatus: item.status,
      currentStatus: null,
      previousExpectedReaction: item.expected_reaction,
      currentExpectedReaction: null,
      expectationChanged: null,
      question: item.question,
    });
  }

  return result;
}

function calibrationSummary(
  investigations: DossierPresentationInvestigation[],
): DossierPresentationCalibrationSummary {
  const counts = {
    aligned: 0,
    divergent: 0,
    mixed: 0,
    unresolved: 0,
    intraday: 0,
    expectationChanged: 0,
  };
  const reviewQueue: string[] = [];

  for (const item of investigations) {
    const calibration = item.reactionCalibration;
    if (calibration.outcome === "ALIGNED") counts.aligned += 1;
    else if (calibration.outcome === "DIVERGENT") counts.divergent += 1;
    else if (calibration.outcome === "MIXED") counts.mixed += 1;
    else counts.unresolved += 1;

    if (calibration.precision === "INTRADAY") counts.intraday += 1;
    if (calibration.expectationChanged === true) counts.expectationChanged += 1;
    if (calibration.requiresReview) reviewQueue.push(item.id);
  }

  return {
    evaluatedInvestigations: investigations.length - counts.unresolved,
    alignedInvestigations: counts.aligned,
    divergentInvestigations: counts.divergent,
    mixedInvestigations: counts.mixed,
    unresolvedInvestigations: counts.unresolved,
    intradayInvestigations: counts.intraday,
    expectationChangedInvestigations: counts.expectationChanged,
    reviewQueue,
  };
}

function lensEntries(output: ResearchBrainOutputV1): DossierPresentationLens[] {
  const source = output.market_verdict.lenses ?? {};
  const known = new Set<string>();
  const result: DossierPresentationLens[] = [];

  const pushLens = (key: string, lens: MarketLens | undefined) => {
    if (!lens) return;
    known.add(key);
    result.push({
      key,
      label: lens.lens_name || key,
      observed: Boolean(lens.observed_reaction),
      reaction: lens.observed_reaction,
      interpretation: lens.interpretation,
      evidenceRefs: [...lens.observed_reaction_evidence_refs],
      unresolvedSignals: [...lens.unresolved_signals],
    });
  };

  for (const key of REGIME_LENS_ORDER) {
    pushLens(key, source[key]);
  }

  for (const key of Object.keys(source).sort()) {
    if (!known.has(key)) pushLens(key, source[key]);
  }

  return result;
}

function thesisMap(output: ResearchBrainOutputV1 | null) {
  return new Map(
    (output?.thesis_ledger?.entries ?? []).map((entry) => [entry.thesis_id, entry]),
  );
}

function thesisChanges(
  current: ResearchBrainOutputV1,
  previous: ResearchBrainOutputV1 | null,
): DossierPresentationThesisChange[] {
  const prior = thesisMap(previous);
  const result: DossierPresentationThesisChange[] = [];

  for (const entry of current.thesis_ledger.entries) {
    const before = prior.get(entry.thesis_id) ?? null;
    let change: DossierPresentationThesisChange["change"] | null = null;

    if (!before) change = "new";
    else if (before.state !== entry.state) change = "state_changed";
    else if (before.version !== entry.version) change = "version_changed";

    if (!change) continue;

    result.push({
      thesisId: entry.thesis_id,
      title: entry.title,
      statement: entry.statement,
      state: entry.state,
      previousState: before?.state ?? null,
      version: entry.version,
      previousVersion: before?.version ?? null,
      change,
      reason: entry.state_reason,
      nextCatalystOrTripwire: entry.next_catalyst_or_tripwire,
      evidenceRefs: [...entry.current_evidence_refs],
    });
  }

  return result.sort((a, b) =>
    b.version - a.version || a.thesisId.localeCompare(b.thesisId)
  );
}

function evidenceIndex(output: ResearchBrainOutputV1): DossierPresentationEvidenceRef[] {
  const usage = new Map<string, Set<string>>();
  const add = (ids: string[], section: string) => {
    for (const id of ids) {
      if (!id) continue;
      const sections = usage.get(id) ?? new Set<string>();
      sections.add(section);
      usage.set(id, sections);
    }
  };

  add(output.main_thread.evidence_references, "main_thread");

  for (const story of output.major_stories) {
    add(story.evidence_ids, `story:${story.story_id}`);
  }

  for (const [key, lens] of Object.entries(output.market_verdict.lenses)) {
    add(lens.observed_reaction_evidence_refs, `lens:${key}`);
  }

  for (const item of output.investigations) {
    add(item.observed_evidence, `investigation:${item.investigation_id}`);
  }

  for (const item of output.stock_radar) {
    add(item.evidence_references, `stock:${item.symbol}`);
  }

  for (const theme of output.developing_themes) {
    add(theme.supporting_evidence_ids, `theme:${theme.theme_id}`);
  }

  for (const thesis of output.thesis_ledger.entries) {
    add(thesis.current_evidence_refs, `thesis:${thesis.thesis_id}`);
  }

  for (const contradiction of output.contradictions_detected) {
    add(contradiction.conflicting_evidence_ids, `contradiction:${contradiction.conflict_group_id}`);
  }

  return [...usage.entries()]
    .map(([evidenceId, sections]) => ({
      evidenceId,
      usedIn: [...sections].sort(),
    }))
    .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
}

export function buildDossierV2Presentation(
  dossier: MarketDossierV2,
  previousDossier?: MarketDossierV2 | null,
): DossierPresentationV1 {
  const output = analyticalOutput(dossier);
  const previousOutput = previousDossier ? analyticalOutput(previousDossier) : null;

  const warnings = freshnessWarnings(dossier);
  const gaps = researchGaps(dossier);
  const degraded = Boolean(output.diagnostics.degraded);
  const lenses = lensEntries(output);
  const outlook = policyOutlook(dossier);
  const reactionAssessments = system1ReactionAssessments(dossier);
  const journey = investigationJourney(output, previousOutput);
  const journeyByCurrentId = new Map(
    journey.flatMap((item) => item.currentId ? [[item.currentId, item] as const] : []),
  );
  const presentedInvestigations = output.investigations.map((item) => presentationInvestigation(
    item,
    reactionAssessments,
    journeyByCurrentId.get(item.investigation_id) ?? {
      currentId: item.investigation_id,
      previousId: null,
      matchedBy: null,
      transition: "BASELINE",
      previousDivergence: null,
      currentDivergence: item.divergence,
      previousStatus: null,
      currentStatus: item.status,
      previousExpectedReaction: null,
      currentExpectedReaction: item.expected_reaction,
      expectationChanged: null,
      question: item.question,
    },
  ));
  const presentedById = new Map(presentedInvestigations.map((item) => [item.id, item]));

  return {
    contractVersion: DOSSIER_PRESENTATION_V1,
    dossierId: dossier.id,
    previousDossierId: dossier.previous_dossier_id,
    asOf: dossier.as_of,
    createdAt: dossier.created_at,

    health: {
      state: degraded ? "degraded" : "healthy",
      degraded,
      repairUsed: Boolean(output.diagnostics.model_repair_used),
      freshnessWarnings: warnings,
      researchGaps: gaps,
      missingInputCategories: [...output.diagnostics.missing_input_categories],
    },

    header: {
      headline: output.main_thread.headline,
      answer: output.main_thread.answer,
      regimeImplication: output.main_thread.regime_implication,
      regimeFamily: output.main_thread.regime_family,
      epistemicLabel: output.main_thread.epistemic_label,
      whatWouldChangeMind: output.main_thread.what_would_change_mind,
    },

    regimeStrip: lenses,
    policyOutlook: outlook,
    rateRegime: rateRegime(dossier, outlook, lenses),
    dollarLiquidity: dollarLiquidity(dossier),
    policyLiquidityInteraction: policyLiquidityInteraction(dossier),

    whatMattersNow: {
      leadThreadId: output.main_thread.thread_id,
      supportingStoryIds: [...output.main_thread.supporting_story_ids],
      stories: output.major_stories.map(presentationStory),
    },

    watchNext: output.investigations
      .filter((item) => item.status !== "resolved" && item.status !== "parked")
      .flatMap((item) => {
        const presented = presentedById.get(item.investigation_id);
        return presented ? [presented] : [];
      }),
    investigationAudit: presentedInvestigations,
    investigationJourney: journey,
    reactionCalibration: calibrationSummary(presentedInvestigations),

    researchNow: output.research_now.map((item) => ({
      ...item,
      linked_investigations: [...item.linked_investigations],
      linked_stories: [...item.linked_stories],
      blocking_evidence: [...item.blocking_evidence],
    })),

    charts: {
      core: output.chart_investigation_queue.core.map((item) => ({
        ...item,
        linked_story_ids: [...item.linked_story_ids],
        linked_investigation_ids: [...item.linked_investigation_ids],
        lane: "core" as const,
      })),
      optional: output.chart_investigation_queue.optional.map((item) => ({
        ...item,
        linked_story_ids: [...item.linked_story_ids],
        linked_investigation_ids: [...item.linked_investigation_ids],
        lane: "optional" as const,
      })),
    },

    stockRadar: output.stock_radar.map((item) => ({
      ...item,
      evidence_references: [...item.evidence_references],
    })),

    themes: output.developing_themes.map((item) => ({
      ...item,
      supporting_evidence_ids: [...item.supporting_evidence_ids],
    })),

    creatorThemes: output.creator_theme_expansions.map((item) => ({
      ...item,
      creator_claims_referenced: [...item.creator_claims_referenced],
    })),

    thesisChanges: thesisChanges(output, previousOutput),

    evidenceIndex: evidenceIndex(output),

    diagnostics: {
      modelRepairUsed: Boolean(output.diagnostics.model_repair_used),
      notes: [...output.diagnostics.notes],
      omittedOrDemotedItems: [...output.diagnostics.omitted_or_demoted_items],
    },
  };
}
