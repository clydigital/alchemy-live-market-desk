import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";
import type { DossierPolicyOutlookItem } from "./policy-outlook.ts";
import { buildRateCurveDiagnostic, type RateCurveDiagnostic } from "./rate-curve-diagnostic.ts";
import { buildRateLongEndDiagnostic, type RateLongEndDiagnostic } from "./rate-long-end-diagnostic.ts";
import { buildRateGlobalDurationDiagnostic, type RateGlobalDurationDiagnostic } from "./rate-global-duration-diagnostic.ts";
import { buildRateCrossAssetTransmission, type RateCrossAssetTransmission } from "./rate-cross-asset-transmission.ts";

export const RATE_REGIME_CONTRACT_VERSION = "rate-regime/1" as const;

export type RateRegimeState =
  | "HAWKISH"
  | "DOVISH"
  | "NEUTRAL"
  | "MIXED"
  | "UNRESOLVED";

export type RateRegimeConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED";

export type RateRegimeSignal = {
  key: "POLICY" | "FRONT_END" | "REAL_YIELDS" | "BREAKEVENS" | "LONG_END" | "TREASURY_SUPPLY";
  label: string;
  state: RateRegimeState;
  score: number;
  detail: string;
  evidenceRefs: string[];
};

export type DossierRateRegimeSnapshot = {
  contractVersion: typeof RATE_REGIME_CONTRACT_VERSION;
  asOf: string;
  state: RateRegimeState;
  score: number;
  confidence: RateRegimeConfidence;
  summary: string;
  nextMeetingRateOutlook: "MORE_HAWKISH" | "MORE_DOVISH" | null;
  fedWatchExpectedDirection: "HIKE_ODDS_UP" | "HIKE_ODDS_DOWN" | null;
  trigger: string | null;
  observedRatePricing: string | null;
  observedConfirmation: string | null;
  usRatesReaction: string | null;
  usRatesInterpretation: string | null;
  fredBacked: boolean;
  curve: {
    spreadBps: number | null;
    state: "INVERTED" | "FLAT" | "POSITIVE" | "UNRESOLVED";
    detail: string;
    evidenceRefs: string[];
  };
  curveDiagnostic: RateCurveDiagnostic;
  longEndDiagnostic: RateLongEndDiagnostic;
  globalDurationDiagnostic: RateGlobalDurationDiagnostic;
  crossAssetTransmission: RateCrossAssetTransmission;
  signals: RateRegimeSignal[];
  drivers: string[];
  contradictions: string[];
  evidenceRefs: string[];
  coverage: {
    present: number;
    total: number;
    missing: string[];
  };
  gaps: string[];
};

function metricNumber(item: ObservedEvidence | null | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricString(item: ObservedEvidence | null | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const GENERIC_RATE_PRICING_CONTEXTS = new Set([
  "fedwatch",
  "fed_watch",
  "fed-funds",
  "fed_funds",
  "fed-funds-futures",
  "fed_funds_futures",
  "rate_pricing",
  "policy_pricing",
]);

type PersistentRatePricing = {
  evidence: ObservedEvidence;
  direction: "MORE_HAWKISH" | "MORE_DOVISH" | null;
  fedWatchDirection: "HIKE_ODDS_UP" | "HIKE_ODDS_DOWN" | null;
  detail: string;
};

function latestPersistentRatePricing(evidence: ObservedEvidence[]): PersistentRatePricing | null {
  const item = evidence
    .filter((candidate) => {
      if (metricString(candidate, "signal_kind") !== "rate_expectation") return false;
      const context = metricString(candidate, "signal_context");
      return Boolean(context && GENERIC_RATE_PRICING_CONTEXTS.has(context.toLowerCase()));
    })
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;

  if (!item) return null;

  const observed = metricNumber(item, "observed_value");
  const previous = metricNumber(item, "previous_value");
  const unit = metricString(item, "measurement_unit");
  const suffix = unit === "percent" ? "%" : unit ? ` ${unit}` : "";
  const detail = observed !== null
    ? `${observed}${suffix} — ${item.claim_or_fact}`
    : item.claim_or_fact;

  if (observed === null || previous === null || observed === previous) {
    return { evidence: item, direction: null, fedWatchDirection: null, detail };
  }

  const hawkish = observed > previous;
  return {
    evidence: item,
    direction: hawkish ? "MORE_HAWKISH" : "MORE_DOVISH",
    fedWatchDirection: hawkish ? "HIKE_ODDS_UP" : "HIKE_ODDS_DOWN",
    detail,
  };
}

function rateEvidence(packet: DossierV2InputPacket) {
  const merged = [
    ...(packet.rate_context?.evidence ?? []),
    ...packet.observed_evidence,
  ];
  return [...new Map(merged.map((item) => [item.evidence_id, item])).values()];
}

function signalContextEvidence(
  evidence: ObservedEvidence[],
  context: string,
): ObservedEvidence | null {
  return evidence
    .filter((item) => metricString(item, "signal_context")?.toLowerCase() === context.toLowerCase())
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;
}

function monitorEvidence(
  evidence: ObservedEvidence[],
  id: string,
): ObservedEvidence | null {
  return evidence
    .filter((item) => item.evidence_id.startsWith(`market-monitor:${id}:`))
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function round(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function bpChange(item: ObservedEvidence | null) {
  const last = metricNumber(item, "last");
  const pct = metricNumber(item, "change_5d_pct");
  if (last === null || pct === null || pct <= -99.99) return null;
  const prior = last / (1 + pct / 100);
  return (last - prior) * 100;
}

function signalState(score: number, resolved: boolean): RateRegimeState {
  if (!resolved) return "UNRESOLVED";
  if (score >= 1) return "HAWKISH";
  if (score <= -1) return "DOVISH";
  return "NEUTRAL";
}

function formatPct(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function formatBp(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp`;
}

function makePolicySignal(
  outlook: DossierPolicyOutlookItem[],
  persistentPricing: PersistentRatePricing | null,
): RateRegimeSignal {
  if (!outlook.length) {
    if (persistentPricing?.direction) {
      const hawkish = persistentPricing.direction === "MORE_HAWKISH";
      return {
        key: "POLICY",
        label: "Next-meeting policy pricing",
        state: hawkish ? "HAWKISH" : "DOVISH",
        score: hawkish ? 1 : -1,
        detail: persistentPricing.detail,
        evidenceRefs: [persistentPricing.evidence.evidence_id],
      };
    }

    return {
      key: "POLICY",
      label: "Policy / macro impulse",
      state: "UNRESOLVED",
      score: 0,
      detail: "No current deterministic policy impulse or directional next-meeting repricing is present in the bounded rate context.",
      evidenceRefs: persistentPricing ? [persistentPricing.evidence.evidence_id] : [],
    };
  }

  const hawkish = outlook.filter((item) => item.policyImpulse === "HAWKISH").length;
  const dovish = outlook.filter((item) => item.policyImpulse === "DOVISH").length;
  const raw = clamp((hawkish - dovish) * 2, -3, 3);
  const state: RateRegimeState = hawkish && dovish
    ? "MIXED"
    : hawkish
      ? "HAWKISH"
      : "DOVISH";

  return {
    key: "POLICY",
    label: "Policy / macro impulse",
    state,
    score: raw,
    detail: outlook
      .slice(0, 3)
      .map((item) => `${item.policyImpulse}: ${item.trigger}`)
      .join(" · "),
    evidenceRefs: [...new Set(outlook.flatMap((item) => [
      item.triggerEvidenceRef,
      item.observedRatePricingEvidenceRef,
      item.observedConfirmationEvidenceRef,
    ].filter((value): value is string => Boolean(value))))],
  };
}

export function buildDossierRateRegime(
  packet: DossierV2InputPacket,
  policyOutlook: DossierPolicyOutlookItem[],
): DossierRateRegimeSnapshot {
  const evidence = rateEvidence(packet);
  const curveDiagnostic = buildRateCurveDiagnostic(evidence, packet.as_of);
  const longEndDiagnostic = buildRateLongEndDiagnostic(packet);
  const globalDurationDiagnostic = buildRateGlobalDurationDiagnostic(packet, curveDiagnostic);
  const crossAssetTransmission = buildRateCrossAssetTransmission(packet, longEndDiagnostic, globalDurationDiagnostic);
  const us2y = monitorEvidence(evidence, "us2y");
  const us5y = monitorEvidence(evidence, "us5y-fred");
  const us10yCash = monitorEvidence(evidence, "us10y");
  const us10yFred = monitorEvidence(evidence, "us10y-fred");
  const us10y = us10yCash ?? us10yFred;
  const us20y = monitorEvidence(evidence, "us20y-fred");
  const us30yDirect = signalContextEvidence(evidence, "us30y");
  const us30yFred = monitorEvidence(evidence, "us30y-fred");
  const us30y = us30yDirect ?? us30yFred;
  const real10y = monitorEvidence(evidence, "us10y-real");
  const breakeven10y = monitorEvidence(evidence, "us10y-breakeven");
  const effectiveFedFunds = monitorEvidence(evidence, "fed-funds-effective");
  const treasurySupply = signalContextEvidence(evidence, "treasury_supply");

  const us2yLevel = metricNumber(us2y, "last");
  const us5yLevel = metricNumber(us5y, "last");
  const us10yLevel = metricNumber(us10y, "last");
  const us20yLevel = metricNumber(us20y, "last");
  const us30yLevel = metricNumber(us30y, "observed_value") ?? metricNumber(us30y, "last");
  const real10yLevel = metricNumber(real10y, "last");
  const breakevenLevel = metricNumber(breakeven10y, "last");
  const effrLevel = metricNumber(effectiveFedFunds, "last");
  const treasuryBuybackMax = metricNumber(treasurySupply, "observed_value");
  const treasuryBuybackPreviousMax = metricNumber(treasurySupply, "previous_value");
  const treasuryBuybackMultiple = treasuryBuybackMax !== null
    && treasuryBuybackPreviousMax !== null
    && treasuryBuybackPreviousMax > 0
      ? treasuryBuybackMax / treasuryBuybackPreviousMax
      : null;

  const us2y5dBp = bpChange(us2y);
  const us5y5dBp = bpChange(us5y);
  const us10y5dBp = bpChange(us10y);
  const us20y5dBp = bpChange(us20y);
  const us30y5dBp = bpChange(us30y);
  const real10y5dBp = bpChange(real10y);
  const breakeven5dBp = bpChange(breakeven10y);

  const persistentRatePricing = latestPersistentRatePricing(evidence);
  const policySignal = makePolicySignal(policyOutlook, persistentRatePricing);

  let frontEndScore = 0;
  if (us2y5dBp !== null) {
    if (us2y5dBp >= 5) frontEndScore += 1;
    else if (us2y5dBp <= -5) frontEndScore -= 1;
  }
  const twoYearVsEffrBp =
    us2yLevel !== null && effrLevel !== null
      ? (us2yLevel - effrLevel) * 100
      : null;
  if (twoYearVsEffrBp !== null) {
    if (twoYearVsEffrBp >= 10) frontEndScore += 1;
    else if (twoYearVsEffrBp <= -10) frontEndScore -= 1;
  }
  frontEndScore = clamp(frontEndScore, -2, 2);
  const frontEndResolved = us2yLevel !== null;
  const frontEndSignal: RateRegimeSignal = {
    key: "FRONT_END",
    label: "Front-end pricing",
    state: signalState(frontEndScore, frontEndResolved),
    score: frontEndScore,
    detail: frontEndResolved
      ? `US 2Y ${formatPct(us2yLevel)}; 5D ${formatBp(us2y5dBp)}${twoYearVsEffrBp === null ? "" : `; vs effective fed funds ${formatBp(twoYearVsEffrBp)}`}.`
      : "US 2Y rate context is unavailable.",
    evidenceRefs: [us2y?.evidence_id, effectiveFedFunds?.evidence_id].filter((value): value is string => Boolean(value)),
  };

  let realYieldScore = 0;
  if (real10yLevel !== null) {
    if (real10yLevel >= 2) realYieldScore += 1;
    else if (real10yLevel <= 1) realYieldScore -= 1;
  }
  if (real10y5dBp !== null) {
    if (real10y5dBp >= 5) realYieldScore += 1;
    else if (real10y5dBp <= -5) realYieldScore -= 1;
  }
  realYieldScore = clamp(realYieldScore, -2, 2);
  const realYieldSignal: RateRegimeSignal = {
    key: "REAL_YIELDS",
    label: "10Y real yield",
    state: signalState(realYieldScore, real10yLevel !== null),
    score: realYieldScore,
    detail: real10yLevel !== null
      ? `10Y real yield ${formatPct(real10yLevel)}; 5D ${formatBp(real10y5dBp)}.`
      : "10Y real-yield context is unavailable.",
    evidenceRefs: [real10y?.evidence_id].filter((value): value is string => Boolean(value)),
  };

  let breakevenScore = 0;
  if (breakevenLevel !== null) {
    if (breakevenLevel >= 2.5) breakevenScore += 1;
    else if (breakevenLevel <= 2.0) breakevenScore -= 1;
  }
  if (breakeven5dBp !== null) {
    if (breakeven5dBp >= 5) breakevenScore += 1;
    else if (breakeven5dBp <= -5) breakevenScore -= 1;
  }
  breakevenScore = clamp(breakevenScore, -2, 2);
  const breakevenSignal: RateRegimeSignal = {
    key: "BREAKEVENS",
    label: "10Y inflation breakeven",
    state: signalState(breakevenScore, breakevenLevel !== null),
    score: breakevenScore,
    detail: breakevenLevel !== null
      ? `10Y breakeven ${formatPct(breakevenLevel)}; 5D ${formatBp(breakeven5dBp)}.`
      : "10Y breakeven context is unavailable.",
    evidenceRefs: [breakeven10y?.evidence_id].filter((value): value is string => Boolean(value)),
  };

  let longEndScore = 0;
  const longEndChanges = [us10y5dBp, us20y5dBp, us30y5dBp].filter((value): value is number => value !== null);
  const risingLongEnd = longEndChanges.filter((value) => value >= 7).length;
  const fallingLongEnd = longEndChanges.filter((value) => value <= -7).length;
  if (risingLongEnd >= 2 || (risingLongEnd === 1 && longEndChanges.length === 1)) longEndScore += 1;
  else if (fallingLongEnd >= 2 || (fallingLongEnd === 1 && longEndChanges.length === 1)) longEndScore -= 1;
  const longEndResolved = us10yLevel !== null || us20yLevel !== null || us30yLevel !== null;
  const longEndDetail = [
    us10yLevel === null ? null : `US 10Y ${formatPct(us10yLevel)}; 5D ${formatBp(us10y5dBp)}`,
    us20yLevel === null ? null : `US 20Y ${formatPct(us20yLevel)}; 5D ${formatBp(us20y5dBp)}`,
    us30yLevel === null ? null : `${us30yDirect ? "verified " : ""}US 30Y ${formatPct(us30yLevel)}; 5D ${formatBp(us30y5dBp)}`,
  ].filter((value): value is string => Boolean(value)).join("; ");
  const longEndSignal: RateRegimeSignal = {
    key: "LONG_END",
    label: "Long-end nominal yields",
    state: signalState(longEndScore, longEndResolved && us10yLevel !== null),
    score: us10yLevel !== null ? longEndScore : 0,
    detail: us10yLevel !== null
      ? `${longEndDetail}.`
      : us30yLevel !== null
        ? `${us30yDirect ? "Verified " : ""}US 30Y ${formatPct(us30yLevel)}; US 10Y monitor unavailable.`
        : "US long-end nominal-yield context is unavailable.",
    evidenceRefs: [us10y?.evidence_id, us20y?.evidence_id, us30y?.evidence_id].filter((value): value is string => Boolean(value)),
  };

  // A larger Treasury liquidity-support buyback is not tightening by itself:
  // it is a debt-management/liquidity operation, not QE. Treat it as a
  // restrictive regime signal only when verified long-end yields independently
  // confirm that term-premium/duration pressure remains elevated.
  const longEndElevated = (us30yLevel !== null && us30yLevel >= 5)
    || (us20yLevel !== null && us20yLevel >= 5)
    || (us10yLevel !== null && us10yLevel >= 5);
  const treasurySupplyResolved = treasurySupply !== null
    && treasuryBuybackMax !== null
    && treasuryBuybackPreviousMax !== null;
  const treasurySupplyScore =
    treasurySupplyResolved
    && treasuryBuybackMultiple !== null
    && treasuryBuybackMultiple >= 2
    && longEndElevated
      ? 1
      : 0;
  const treasurySupplySignal: RateRegimeSignal = {
    key: "TREASURY_SUPPLY",
    label: "Treasury supply / liquidity",
    state: signalState(treasurySupplyScore, treasurySupplyResolved),
    score: treasurySupplyScore,
    detail: treasurySupplyResolved
      ? `Long-end liquidity-support buyback maximum ${treasuryBuybackMax === null ? "n/a" : `${treasuryBuybackMax.toFixed(1)}bn`} vs ${treasuryBuybackPreviousMax === null ? "n/a" : `${treasuryBuybackPreviousMax.toFixed(1)}bn`} previously${treasuryBuybackMultiple === null ? "" : ` (${treasuryBuybackMultiple.toFixed(1)}×)`}. ${longEndElevated ? "Long-end yields remain elevated despite the larger operation, so term-premium/duration pressure remains restrictive." : "Without elevated long-end yields, the larger buyback is not treated as tightening evidence by itself."} Treasury buybacks are liquidity support, not QE.`
      : "No current verified Treasury buyback/supply observation is present in the bounded rate context.",
    evidenceRefs: [
      treasurySupply?.evidence_id,
      us20y?.evidence_id,
      us30y?.evidence_id,
      us10y?.evidence_id,
    ].filter((value): value is string => Boolean(value)),
  };

  const signals = [
    policySignal,
    frontEndSignal,
    realYieldSignal,
    breakevenSignal,
    longEndSignal,
    treasurySupplySignal,
  ];

  const resolvedSignals = signals.filter((item) => item.state !== "UNRESOLVED");
  const positiveSignals = resolvedSignals.filter((item) => item.score > 0);
  const negativeSignals = resolvedSignals.filter((item) => item.score < 0);
  const rawScore = signals.reduce((sum, item) => sum + item.score, 0);
  const score = Math.round(clamp(rawScore / 10, -1, 1) * 100);

  let state: RateRegimeState;
  if (resolvedSignals.length < 2) state = "UNRESOLVED";
  else if (rawScore >= 2) state = "HAWKISH";
  else if (rawScore <= -2) state = "DOVISH";
  else if (positiveSignals.length && negativeSignals.length) state = "MIXED";
  else state = "NEUTRAL";

  const requiredCoverage = [
    ["US 2Y", us2y],
    ["US 10Y nominal", us10y],
    ["US 10Y real yield", real10y],
    ["US 10Y breakeven", breakeven10y],
    ["Effective fed funds", effectiveFedFunds],
  ] as const;
  const missing = requiredCoverage.filter(([, item]) => !item).map(([label]) => label);
  const present = requiredCoverage.length - missing.length;
  const confidence: RateRegimeConfidence =
    resolvedSignals.length < 2 ? "UNRESOLVED"
      : present >= 4 && resolvedSignals.length >= 4 ? "HIGH"
        : present >= 3 ? "MEDIUM"
          : "LOW";

  const curve2s10s = curveDiagnostic.spreads.find((item) => item.key === "2s10s") ?? null;
  const curveSpreadBps = curve2s10s?.bps ?? null;
  const curveState = curveDiagnostic.shape;
  const curveEvidenceRefs = curveDiagnostic.evidenceRefs;

  const primary = policyOutlook[0] ?? null;
  const fallbackNextMeetingOutlook = primary?.nextMeetingRateOutlook
    ?? persistentRatePricing?.direction
    ?? null;
  const fallbackFedWatchDirection = primary?.fedWatchExpectedDirection
    ?? persistentRatePricing?.fedWatchDirection
    ?? null;
  const fallbackObservedRatePricing = primary?.observedRatePricing
    ?? persistentRatePricing?.detail
    ?? null;
  const evidenceRefs = [...new Set([
    ...signals.flatMap((item) => item.evidenceRefs),
    ...curveEvidenceRefs,
    ...longEndDiagnostic.evidenceRefs,
    ...globalDurationDiagnostic.evidenceRefs,
  ])];

  const drivers = signals
    .filter((item) => item.score !== 0)
    .sort((left, right) => Math.abs(right.score) - Math.abs(left.score) || left.key.localeCompare(right.key))
    .slice(0, 4)
    .map((item) => `${item.label}: ${item.state.toLowerCase()} (${item.detail})`);

  const contradictions = positiveSignals.length && negativeSignals.length
    ? [
        `Hawkish signals: ${positiveSignals.map((item) => item.label).join(", ")}.`,
        `Dovish signals: ${negativeSignals.map((item) => item.label).join(", ")}.`,
      ]
    : [];

  const stateLead =
    state === "HAWKISH" ? "Rates conditions are leaning hawkish/restrictive."
      : state === "DOVISH" ? "Rates conditions are leaning dovish/easing."
        : state === "MIXED" ? "Rates conditions are internally mixed."
          : state === "NEUTRAL" ? "Rates conditions are broadly neutral."
            : "The rate regime is unresolved.";

  const summary = `${stateLead} ${drivers.slice(0, 2).join(" ")}`.trim();
  const fredCount = [us2y, us5y, us10yFred, us20y, us30yFred, real10y, breakeven10y, effectiveFedFunds]
    .filter((item) => item?.provenance?.some((ref) => ref.source_type === "FRED")).length;

  const gaps = [
    ...missing.map((label) => `${label} is missing from persistent rate context.`),
    ...(primary?.gaps ?? []),
  ];

  return {
    contractVersion: RATE_REGIME_CONTRACT_VERSION,
    asOf: packet.as_of,
    state,
    score,
    confidence,
    summary,
    nextMeetingRateOutlook: fallbackNextMeetingOutlook,
    fedWatchExpectedDirection: fallbackFedWatchDirection,
    trigger: primary?.trigger ?? null,
    observedRatePricing: fallbackObservedRatePricing,
    observedConfirmation: primary?.observedConfirmation ?? null,
    usRatesReaction: frontEndResolved
      ? `US 2Y 5D ${formatBp(us2y5dBp)}`
      : null,
    usRatesInterpretation: [frontEndSignal.detail, longEndSignal.detail, realYieldSignal.detail]
      .filter(Boolean)
      .join(" "),
    fredBacked: fredCount >= 2,
    curve: {
      spreadBps: round(curveSpreadBps),
      state: curveState,
      detail: curveDiagnostic.detail,
      evidenceRefs: curveEvidenceRefs,
    },
    curveDiagnostic,
    longEndDiagnostic,
    globalDurationDiagnostic,
    crossAssetTransmission,
    signals,
    drivers,
    contradictions,
    evidenceRefs,
    coverage: {
      present,
      total: requiredCoverage.length,
      missing,
    },
    gaps: [...new Set(gaps)],
  };
}
