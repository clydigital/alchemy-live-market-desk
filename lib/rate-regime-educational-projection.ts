import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";
import type { RegimeExplanation } from "./regime-explanations.ts";
import type { RoutedDossierInvestigation } from "./regime-investigations.ts";
import type { ProjectedRegime, ProjectedRegimeSubgroup } from "./regimes.ts";

export const RATE_EDUCATIONAL_PROJECTION_VERSION = "rate-educational-projection/1" as const;

export type RateEducationalStateRow = {
  key: string;
  label: string;
  state: string;
  stateKind: "system1" | "interpreted" | "unresolved";
  detail: string;
  asOf: string | null;
  source: string;
};

export type RateEducationalProjection = {
  contractVersion: typeof RATE_EDUCATIONAL_PROJECTION_VERSION;
  dossierId: string | null;
  asOf: string | null;
  canonicalRegimeSlug: "global-cost-of-capital";
  displayLabel: "US Rate Regime";
  quickRead: string[];
  latestCatalyst: {
    id: string;
    title: string;
    detail: string;
    timestamp: string | null;
    state: string;
    interpretationPending: boolean;
  } | null;
  adaptiveExplanation: Array<{
    key: "what_changed" | "expected" | "observed" | "current_explanation" | "what_changes_view";
    label: string;
    text: string;
  }>;
  dominantDriver: {
    subgroupKey: string;
    subgroupLabel: string;
  } | null;
  globalDuration: {
    state: string;
    globalLabelEligible: boolean;
    jgb: {
      asOf: string | null;
      y2: number | null;
      y10: number | null;
      y30: number | null;
      change2y5dBp: number | null;
      change10y5dBp: number | null;
      change30y5dBp: number | null;
    };
    relative: {
      ustJgb2yBp: number | null;
      ustJgb10yBp: number | null;
      ustJgb30yBp: number | null;
      ustJgb2yChange5dBp: number | null;
      ustJgb10yChange5dBp: number | null;
      ustJgb30yChange5dBp: number | null;
      detail: string;
    };
    fx: {
      usdJpy: number | null;
      change5dPct: number | null;
      detail: string;
    };
    tic: {
      period: string | null;
      japanHoldingsUsdBn: number | null;
      japanPreviousUsdBn: number | null;
      japanMonthlyChangeUsdBn: number | null;
      direction: string;
      totalForeignHoldingsUsdBn: number | null;
      foreignOfficialHoldingsUsdBn: number | null;
      custodyAttributionCaveat: string | null;
      detail: string;
    };
    japanFlows: {
      periodLabel: string | null;
      outwardLongTermDebtNetPurchaseJpyBn: number | null;
      outwardTotalNetPurchaseJpyBn: number | null;
      direction: string;
      detail: string;
    };
    comparabilityDetail: string;
    gaps: string[];
    asOf: string;
  } | null;
  goldCrossCheck: {
    realYield10y: {
      levelPct: number | null;
      change5dBp: number | null;
    } | null;
    dxyReaction: {
      expectedDirection: "UP" | "DOWN";
      observedDirection: "UP" | "DOWN";
      observedChangePct: number;
      observedInstrument: string;
      isProxy: boolean;
      reactionWindow: "5m" | "30m" | "4h" | "close" | "next_session" | null;
      relation: "ALIGNED" | "DIVERGENT";
      timingPrecision: "INTRADAY" | "DAILY_POST_EVENT";
    } | null;
    goldReaction: {
      expectedDirection: "UP" | "DOWN";
      observedDirection: "UP" | "DOWN";
      observedChangePct: number;
      observedInstrument: string;
      isProxy: boolean;
      reactionWindow: "5m" | "30m" | "4h" | "close" | "next_session" | null;
      relation: "ALIGNED" | "DIVERGENT";
      timingPrecision: "INTRADAY" | "DAILY_POST_EVENT";
    } | null;
    coverage: {
      present: number;
      total: 3;
      missing: string[];
    };
  } | null;
  longEnd: {
    observedState: string;
    nominal10y: { levelPct: number | null; change5dBp: number | null };
    real10y: { levelPct: number | null; change5dBp: number | null };
    breakeven10y: { levelPct: number | null; change5dBp: number | null };
    accountedChangeBp: number | null;
    residualBp: number | null;
    termPremiumAvailability: string;
    termPremiumDetail: string;
    marketStructureDetail: string;
    volatilityDetail: string;
    gaps: string[];
    asOf: string;
  } | null;
  ratePath: {
    shape: string;
    moveClass: string;
    separationState: string;
    frontEndDirection: string;
    longEndDirection: string;
    frontEndChange5dBp: number | null;
    longEndAverageChange5dBp: number | null;
    detail: string;
    points: Array<{
      maturity: string;
      yieldPct: number | null;
      change5dBp: number | null;
    }>;
    spreads: Array<{
      key: string;
      bps: number | null;
      change5dBp: number | null;
    }>;
    asOf: string;
  } | null;
  stateBoard: RateEducationalStateRow[];
  currentTest: {
    investigationId: string;
    question: string;
    divergence: RoutedDossierInvestigation["divergence"];
    expectedReaction: string | null;
    observedReaction: string | null;
    currentExplanation: string;
    researchNext: string;
    confirmationCondition: string;
    invalidationCondition: string;
    candidateCount: number;
  } | null;
  education: {
    plainEnglish: string;
    counterfactual: string;
  } | null;
};

const SUBGROUP_ORDER = [
  "fed-front-end",
  "treasury-fiscal",
  "long-end",
  "global-rates",
  "credit-financing",
  "housing",
] as const;

function severity(value: RoutedDossierInvestigation["divergence"]) {
  if (value === "MATERIAL") return 4;
  if (value === "PARTIAL") return 3;
  if (value === "UNRESOLVED") return 2;
  if (value === "NONE") return 1;
  return 0;
}

function subgroupByKey(regime: ProjectedRegime, key: string) {
  return regime.subgroups.find((item) => item.key === key) ?? null;
}

function firstSentence(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] || clean).trim();
}

function laymanState(subgroup: ProjectedRegimeSubgroup | null) {
  if (!subgroup) return "unclear";
  const state = subgroup.state.toLowerCase();
  if (/eas|dovish|relief/.test(state)) return "easing";
  if (/restrict|tight|hawk|stress/.test(state)) return "still tight";
  if (/mixed|contest/.test(state)) return "mixed";
  if (/unresolved|unclear|partial/.test(state)) return "unclear";
  return state;
}

function regimeInvestigations(
  regime: ProjectedRegime,
  investigations: RoutedDossierInvestigation[],
) {
  const regimeStoryIds = new Set(regime.durableStories.map((story) => story.id));
  return investigations.filter((item) =>
    item.storyIds.some((storyId) => regimeStoryIds.has(storyId))
    || item.regimeRoutes.some((route) => route.regime === regime.slug)
  );
}

function topInvestigation(items: RoutedDossierInvestigation[]) {
  return [...items].sort((left, right) =>
    severity(right.divergence) - severity(left.divergence)
    || Number(right.reactionCalibration.requiresReview) - Number(left.reactionCalibration.requiresReview)
    || right.candidateExplanations.length - left.candidateExplanations.length
    || left.id.localeCompare(right.id)
  )[0] ?? null;
}

function dominantDriverFor(
  regime: ProjectedRegime,
  investigation: RoutedDossierInvestigation | null,
) {
  if (!investigation) return null;
  const route = investigation.regimeRoutes
    .filter((item) => item.regime === regime.slug)
    .sort((left, right) => right.score - left.score)[0] ?? null;
  if (!route) return null;
  const subgroup = subgroupByKey(regime, route.subgroup);
  return subgroup ? { subgroupKey: subgroup.key, subgroupLabel: subgroup.label } : null;
}

function boardRow(subgroup: ProjectedRegimeSubgroup): RateEducationalStateRow {
  const primaryTelemetry = subgroup.telemetry[0] ?? null;
  return {
    key: subgroup.key,
    label: subgroup.label,
    state: subgroup.state,
    stateKind: subgroup.stateKind,
    detail: primaryTelemetry?.detail || subgroup.whyItMatters,
    asOf: subgroup.latestAt,
    source: primaryTelemetry?.source || (subgroup.durableStories.length ? "canonical Story interpretation" : "coverage unresolved"),
  };
}

function goldCrossCheckFor(
  investigation: RoutedDossierInvestigation | null,
  dossier: {
    rateRegime?: DossierPresentationV1["rateRegime"] | null;
  } | null,
): RateEducationalProjection["goldCrossCheck"] {
  const realYield = dossier?.rateRegime?.longEndDiagnostic?.real10y ?? null;
  const hasRealYield = Boolean(
    realYield
    && (realYield.levelPct !== null || realYield.change5dBp !== null),
  );
  const dxy = investigation?.reactionChecks.find((item) => item.instrument === "DXY") ?? null;
  const gold = investigation?.reactionChecks.find((item) => item.instrument === "XAUUSD") ?? null;

  if (!hasRealYield && !dxy && !gold) return null;

  const reaction = (item: NonNullable<typeof dxy>) => ({
    expectedDirection: item.expectedDirection,
    observedDirection: item.observedDirection,
    observedChangePct: item.observedChangePct,
    observedInstrument: item.observedInstrument,
    isProxy: item.isProxy,
    reactionWindow: item.reactionWindow,
    relation: item.relation,
    timingPrecision: item.timingPrecision,
  });

  const missing = [
    ...(!hasRealYield ? ["10Y real yield"] : []),
    ...(!dxy ? ["DXY reaction"] : []),
    ...(!gold ? ["Gold reaction"] : []),
  ];

  return {
    realYield10y: hasRealYield
      ? {
          levelPct: realYield!.levelPct,
          change5dBp: realYield!.change5dBp,
        }
      : null,
    dxyReaction: dxy ? reaction(dxy) : null,
    goldReaction: gold ? reaction(gold) : null,
    coverage: {
      present: 3 - missing.length,
      total: 3,
      missing,
    },
  };
}

export function buildRateEducationalProjection(input: {
  regime: ProjectedRegime;
  explanation: RegimeExplanation | null;
  investigations: RoutedDossierInvestigation[];
  dossier: {
    dossierId: string;
    asOf: string;
    rateRegime?: DossierPresentationV1["rateRegime"] | null;
  } | null;
}): RateEducationalProjection | null {
  const { regime, explanation, dossier } = input;
  if (regime.slug !== "global-cost-of-capital") return null;

  const investigations = regimeInvestigations(regime, input.investigations);
  const investigation = topInvestigation(investigations);
  const frontEnd = subgroupByKey(regime, "fed-front-end");
  const longEnd = subgroupByKey(regime, "long-end");

  const quickRead = [
    `Short-term Fed-sensitive rates are ${laymanState(frontEnd)}, while longer-term Treasury pressure is ${laymanState(longEnd)}.`,
    investigation?.currentExplanation
      ? `The desk's current accepted explanation is: ${firstSentence(investigation.currentExplanation)}`
      : "The reason for any gap between those two paths is still being tested rather than assumed.",
  ];

  const latest = regime.latestNode;
  const latestCatalyst = latest ? {
    id: latest.id,
    title: latest.title,
    detail: latest.detail,
    timestamp: latest.timestamp,
    state: latest.state,
    interpretationPending: latest.state === "interpretation_pending",
  } : null;

  const adaptiveExplanation: RateEducationalProjection["adaptiveExplanation"] = [];
  if (latestCatalyst) {
    adaptiveExplanation.push({
      key: "what_changed",
      label: latestCatalyst.interpretationPending ? "Latest observed input" : "What changed",
      text: latestCatalyst.interpretationPending
        ? `${latestCatalyst.title}. ${latestCatalyst.detail} This input has not yet been promoted into an accepted causal explanation.`
        : `${latestCatalyst.title}. ${latestCatalyst.detail}`,
    });
  }
  if (investigation?.journey.previousExpectedReaction || investigation?.expectedReaction) {
    adaptiveExplanation.push({
      key: "expected",
      label: "What should have happened",
      text: investigation.journey.previousExpectedReaction || investigation.expectedReaction || "",
    });
  }
  if (investigation?.observedReaction) {
    adaptiveExplanation.push({
      key: "observed",
      label: "What actually happened",
      text: investigation.observedReaction,
    });
  }
  if (investigation?.currentExplanation) {
    adaptiveExplanation.push({
      key: "current_explanation",
      label: investigation.divergence === "MATERIAL" || investigation.divergence === "PARTIAL"
        ? "How the desk currently explains the mismatch"
        : "Current explanation",
      text: investigation.currentExplanation,
    });
  } else if (explanation?.plainEnglish) {
    adaptiveExplanation.push({
      key: "current_explanation",
      label: "How this Regime works",
      text: explanation.plainEnglish,
    });
  }
  if (investigation) {
    adaptiveExplanation.push({
      key: "what_changes_view",
      label: "What changes the view",
      text: `Confirm: ${investigation.confirmationCondition} Invalidate: ${investigation.invalidationCondition} Research next: ${investigation.researchNext}`,
    });
  } else if (explanation?.counterfactual) {
    adaptiveExplanation.push({
      key: "what_changes_view",
      label: "What changes the view",
      text: explanation.counterfactual,
    });
  }

  const stateBoard = SUBGROUP_ORDER
    .map((key) => subgroupByKey(regime, key))
    .filter((item): item is ProjectedRegimeSubgroup => Boolean(item))
    .map(boardRow);

  return {
    contractVersion: RATE_EDUCATIONAL_PROJECTION_VERSION,
    dossierId: dossier?.dossierId ?? null,
    asOf: dossier?.asOf ?? regime.asOf,
    canonicalRegimeSlug: "global-cost-of-capital",
    displayLabel: "US Rate Regime",
    quickRead,
    latestCatalyst,
    adaptiveExplanation: adaptiveExplanation.slice(0, 5),
    dominantDriver: dominantDriverFor(regime, investigation),
    goldCrossCheck: goldCrossCheckFor(investigation, dossier),
    globalDuration: dossier?.rateRegime?.globalDurationDiagnostic ? {
      state: dossier.rateRegime.globalDurationDiagnostic.relativeRates.state,
      globalLabelEligible: dossier.rateRegime.globalDurationDiagnostic.relativeRates.globalLabelEligible,
      jgb: {
        asOf: dossier.rateRegime.globalDurationDiagnostic.japanRates.asOf,
        y2: dossier.rateRegime.globalDurationDiagnostic.japanRates.jgb2yPct,
        y10: dossier.rateRegime.globalDurationDiagnostic.japanRates.jgb10yPct,
        y30: dossier.rateRegime.globalDurationDiagnostic.japanRates.jgb30yPct,
        change2y5dBp: dossier.rateRegime.globalDurationDiagnostic.japanRates.jgb2yChange5dBp,
        change10y5dBp: dossier.rateRegime.globalDurationDiagnostic.japanRates.jgb10yChange5dBp,
        change30y5dBp: dossier.rateRegime.globalDurationDiagnostic.japanRates.jgb30yChange5dBp,
      },
      relative: {
        ustJgb2yBp: dossier.rateRegime.globalDurationDiagnostic.relativeRates.ustJgb2yBp,
        ustJgb10yBp: dossier.rateRegime.globalDurationDiagnostic.relativeRates.ustJgb10yBp,
        ustJgb30yBp: dossier.rateRegime.globalDurationDiagnostic.relativeRates.ustJgb30yBp,
        ustJgb2yChange5dBp: dossier.rateRegime.globalDurationDiagnostic.relativeRates.ustJgb2yChange5dBp,
        ustJgb10yChange5dBp: dossier.rateRegime.globalDurationDiagnostic.relativeRates.ustJgb10yChange5dBp,
        ustJgb30yChange5dBp: dossier.rateRegime.globalDurationDiagnostic.relativeRates.ustJgb30yChange5dBp,
        detail: dossier.rateRegime.globalDurationDiagnostic.relativeRates.detail,
      },
      fx: {
        usdJpy: dossier.rateRegime.globalDurationDiagnostic.fx.usdJpy,
        change5dPct: dossier.rateRegime.globalDurationDiagnostic.fx.change5dPct,
        detail: dossier.rateRegime.globalDurationDiagnostic.fx.detail,
      },
      tic: {
        period: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.period,
        japanHoldingsUsdBn: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.japanHoldingsUsdBn,
        japanPreviousUsdBn: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.japanPreviousUsdBn,
        japanMonthlyChangeUsdBn: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.japanMonthlyChangeUsdBn,
        direction: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.japanHoldingsDirection,
        totalForeignHoldingsUsdBn: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.totalForeignHoldingsUsdBn,
        foreignOfficialHoldingsUsdBn: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.foreignOfficialHoldingsUsdBn,
        custodyAttributionCaveat: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.custodyAttributionCaveat,
        detail: dossier.rateRegime.globalDurationDiagnostic.foreignTreasuryDemand.detail,
      },
      japanFlows: {
        periodLabel: dossier.rateRegime.globalDurationDiagnostic.japanPortfolioFlows.periodLabel,
        outwardLongTermDebtNetPurchaseJpyBn: dossier.rateRegime.globalDurationDiagnostic.japanPortfolioFlows.outwardLongTermDebtNetPurchaseJpyBn,
        outwardTotalNetPurchaseJpyBn: dossier.rateRegime.globalDurationDiagnostic.japanPortfolioFlows.outwardTotalNetPurchaseJpyBn,
        direction: dossier.rateRegime.globalDurationDiagnostic.japanPortfolioFlows.direction,
        detail: dossier.rateRegime.globalDurationDiagnostic.japanPortfolioFlows.detail,
      },
      comparabilityDetail: dossier.rateRegime.globalDurationDiagnostic.comparability.detail,
      gaps: [...dossier.rateRegime.globalDurationDiagnostic.gaps],
      asOf: dossier.rateRegime.globalDurationDiagnostic.asOf,
    } : null,
    longEnd: dossier?.rateRegime?.longEndDiagnostic ? {
      observedState: dossier.rateRegime.longEndDiagnostic.observedDecomposition.state,
      nominal10y: {
        levelPct: dossier.rateRegime.longEndDiagnostic.nominal10y.levelPct,
        change5dBp: dossier.rateRegime.longEndDiagnostic.nominal10y.change5dBp,
      },
      real10y: {
        levelPct: dossier.rateRegime.longEndDiagnostic.real10y.levelPct,
        change5dBp: dossier.rateRegime.longEndDiagnostic.real10y.change5dBp,
      },
      breakeven10y: {
        levelPct: dossier.rateRegime.longEndDiagnostic.breakeven10y.levelPct,
        change5dBp: dossier.rateRegime.longEndDiagnostic.breakeven10y.change5dBp,
      },
      accountedChangeBp: dossier.rateRegime.longEndDiagnostic.observedDecomposition.accountedChangeBp,
      residualBp: dossier.rateRegime.longEndDiagnostic.observedDecomposition.residualBp,
      termPremiumAvailability: dossier.rateRegime.longEndDiagnostic.termPremium.availability,
      termPremiumDetail: dossier.rateRegime.longEndDiagnostic.termPremium.detail,
      marketStructureDetail: dossier.rateRegime.longEndDiagnostic.marketStructure.detail,
      volatilityDetail: dossier.rateRegime.longEndDiagnostic.volatility.detail,
      gaps: [...dossier.rateRegime.longEndDiagnostic.gaps],
      asOf: dossier.rateRegime.longEndDiagnostic.asOf,
    } : null,
    ratePath: dossier?.rateRegime?.curveDiagnostic ? {
      shape: dossier.rateRegime!.curveDiagnostic!.shape,
      moveClass: dossier.rateRegime!.curveDiagnostic!.moveClass,
      separationState: dossier.rateRegime!.curveDiagnostic!.separationState,
      frontEndDirection: dossier.rateRegime!.curveDiagnostic!.frontEndDirection,
      longEndDirection: dossier.rateRegime!.curveDiagnostic!.longEndDirection,
      frontEndChange5dBp: dossier.rateRegime!.curveDiagnostic!.frontEndChange5dBp,
      longEndAverageChange5dBp: dossier.rateRegime!.curveDiagnostic!.longEndAverageChange5dBp,
      detail: dossier.rateRegime!.curveDiagnostic!.detail,
      points: dossier.rateRegime!.curveDiagnostic!.points.map((item) => ({
        maturity: item.maturity,
        yieldPct: item.yieldPct,
        change5dBp: item.change5dBp,
      })),
      spreads: dossier.rateRegime!.curveDiagnostic!.spreads
        .filter((item) => item.key === "2s10s" || item.key === "2s30s" || item.key === "10s30s")
        .map((item) => ({ key: item.key, bps: item.bps, change5dBp: item.change5dBp })),
      asOf: dossier.rateRegime!.curveDiagnostic!.asOf,
    } : null,
    stateBoard,
    currentTest: investigation ? {
      investigationId: investigation.id,
      question: investigation.question,
      divergence: investigation.divergence,
      expectedReaction: investigation.journey.previousExpectedReaction || investigation.expectedReaction,
      observedReaction: investigation.observedReaction,
      currentExplanation: investigation.currentExplanation,
      researchNext: investigation.researchNext,
      confirmationCondition: investigation.confirmationCondition,
      invalidationCondition: investigation.invalidationCondition,
      candidateCount: investigation.candidateExplanations.length,
    } : null,
    education: explanation ? {
      plainEnglish: explanation.plainEnglish,
      counterfactual: explanation.counterfactual,
    } : null,
  };
}
