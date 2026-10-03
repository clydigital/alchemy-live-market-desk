import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";

export const RATE_LONG_END_DIAGNOSTIC_VERSION = "rate-long-end-diagnostic/1" as const;

export type LongEndObservedDriverState =
  | "REAL_YIELD_LED"
  | "BREAKEVEN_LED"
  | "MIXED_OBSERVED"
  | "NOMINAL_MOVE_ONLY"
  | "QUIET"
  | "UNRESOLVED";

export type EvidenceAvailability = "OBSERVED" | "UNRESOLVED" | "STALE";

export type RateLongEndDiagnostic = {
  contractVersion: typeof RATE_LONG_END_DIAGNOSTIC_VERSION;
  asOf: string;
  nominal10y: {
    levelPct: number | null;
    change5dBp: number | null;
    evidenceRef: string | null;
  };
  real10y: {
    levelPct: number | null;
    change5dBp: number | null;
    evidenceRef: string | null;
  };
  breakeven10y: {
    levelPct: number | null;
    change5dBp: number | null;
    evidenceRef: string | null;
  };
  observedDecomposition: {
    state: LongEndObservedDriverState;
    accountedChangeBp: number | null;
    residualBp: number | null;
    detail: string;
  };
  termPremium: {
    availability: EvidenceAvailability;
    levelPct: number | null;
    change5dBp: number | null;
    evidenceRef: string | null;
    detail: string;
  };
  marketStructure: {
    treasurySupplyEvidenceRef: string | null;
    dealerEvidenceRef: string | null;
    auctionEvidenceRef: string | null;
    dealerNetPositionMillions: number | null;
    dealerNetPositionWeeklyChangeMillions: number | null;
    failsDeliverMillions: number | null;
    failsReceiveMillions: number | null;
    detail: string;
  };
  volatility: {
    moveEvidenceRef: string | null;
    level: number | null;
    change5dPct: number | null;
    detail: string;
  };
  evidenceRefs: string[];
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

function latestByPrefix(packet: DossierV2InputPacket, prefix: string) {
  return packet.observed_evidence
    .filter((item) => item.evidence_id.startsWith(prefix))
    .sort((a, b) => b.available_at.localeCompare(a.available_at))[0] ?? null;
}

function monitor(packet: DossierV2InputPacket, id: string) {
  return latestByPrefix(packet, `market-monitor:${id}:`);
}

function signalContext(packet: DossierV2InputPacket, context: string) {
  const merged = [...(packet.rate_context?.evidence ?? []), ...packet.observed_evidence];
  return merged
    .filter((item) => metricString(item, "signal_context")?.toLowerCase() === context.toLowerCase())
    .sort((a, b) => b.available_at.localeCompare(a.available_at))[0] ?? null;
}

function claimMatch(packet: DossierV2InputPacket, pattern: RegExp) {
  const merged = [...(packet.rate_context?.evidence ?? []), ...packet.observed_evidence];
  return merged
    .filter((item) => pattern.test(item.claim_or_fact))
    .sort((a, b) => b.available_at.localeCompare(a.available_at))[0] ?? null;
}

function bpChange(item: ObservedEvidence | null) {
  const last = metricNumber(item, "last");
  const pct = metricNumber(item, "change_5d_pct");
  if (last === null || pct === null || pct <= -99.99) return null;
  const prior = last / (1 + pct / 100);
  return (last - prior) * 100;
}

function round(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function observedState(
  nominal: number | null,
  real: number | null,
  breakeven: number | null,
): LongEndObservedDriverState {
  if (nominal === null) return "UNRESOLVED";
  if (Math.abs(nominal) < 3) return "QUIET";
  if (real === null || breakeven === null) return "NOMINAL_MOVE_ONLY";
  const realAbs = Math.abs(real);
  const breakevenAbs = Math.abs(breakeven);
  if (realAbs >= breakevenAbs + 3) return "REAL_YIELD_LED";
  if (breakevenAbs >= realAbs + 3) return "BREAKEVEN_LED";
  return "MIXED_OBSERVED";
}

function fmtBp(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp`;
}

function fmtPct(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

export function buildRateLongEndDiagnostic(packet: DossierV2InputPacket): RateLongEndDiagnostic {
  const nominal = monitor(packet, "us10y") ?? monitor(packet, "us10y-fred");
  const real = monitor(packet, "us10y-real");
  const breakeven = monitor(packet, "us10y-breakeven");
  const termPremium = signalContext(packet, "term_premium") ?? signalContext(packet, "acm_term_premium");
  const treasurySupply = signalContext(packet, "treasury_supply");
  const dealers = latestByPrefix(packet, "system1-dollar:dealer-balance-sheet:");
  const auction = signalContext(packet, "treasury_auction")
    ?? claimMatch(packet, /\b(?:Treasury auction|auction tail|stop-through|bid-to-cover|indirect bidders?)\b/i);
  const move = monitor(packet, "move");

  const nominalLevel = metricNumber(nominal, "last");
  const realLevel = metricNumber(real, "last");
  const breakevenLevel = metricNumber(breakeven, "last");
  const nominalChange = round(bpChange(nominal));
  const realChange = round(bpChange(real));
  const breakevenChange = round(bpChange(breakeven));
  const accounted = realChange !== null && breakevenChange !== null
    ? round(realChange + breakevenChange)
    : null;
  const residual = nominalChange !== null && accounted !== null
    ? round(nominalChange - accounted)
    : null;
  const state = observedState(nominalChange, realChange, breakevenChange);

  const termPremiumLevel = metricNumber(termPremium, "observed_value") ?? metricNumber(termPremium, "last");
  const termPremiumChange = metricNumber(termPremium, "change_bps") ?? bpChange(termPremium);
  const termPremiumAvailability: EvidenceAvailability = termPremium
    ? metricString(termPremium, "provider_status") === "STALE" ? "STALE" : "OBSERVED"
    : "UNRESOLVED";

  const dealerPosition = metricNumber(dealers, "treasury_net_position_millions");
  const dealerPositionChange = metricNumber(dealers, "treasury_net_position_weekly_change_millions");
  const failsDeliver = metricNumber(dealers, "fails_deliver_millions");
  const failsReceive = metricNumber(dealers, "fails_receive_millions");

  const moveLevel = metricNumber(move, "last");
  const move5d = metricNumber(move, "change_5d_pct");

  const refs = [
    nominal?.evidence_id,
    real?.evidence_id,
    breakeven?.evidence_id,
    termPremium?.evidence_id,
    treasurySupply?.evidence_id,
    dealers?.evidence_id,
    auction?.evidence_id,
    move?.evidence_id,
  ].filter((value): value is string => Boolean(value));

  const gaps: string[] = [];
  if (!termPremium) gaps.push("No governed term-premium observation is present; do not infer term premium from nominal yields alone.");
  if (!auction) gaps.push("No structured current Treasury-auction absorption evidence is present.");
  if (!move) gaps.push("MOVE/Treasury-volatility is not yet present in the canonical market-monitor sensor set.");
  if (!dealers) gaps.push("NY Fed primary-dealer position/fails evidence is unavailable.");

  return {
    contractVersion: RATE_LONG_END_DIAGNOSTIC_VERSION,
    asOf: packet.as_of,
    nominal10y: {
      levelPct: round(nominalLevel, 3),
      change5dBp: nominalChange,
      evidenceRef: nominal?.evidence_id ?? null,
    },
    real10y: {
      levelPct: round(realLevel, 3),
      change5dBp: realChange,
      evidenceRef: real?.evidence_id ?? null,
    },
    breakeven10y: {
      levelPct: round(breakevenLevel, 3),
      change5dBp: breakevenChange,
      evidenceRef: breakeven?.evidence_id ?? null,
    },
    observedDecomposition: {
      state,
      accountedChangeBp: accounted,
      residualBp: residual,
      detail: `10Y nominal ${fmtPct(nominalLevel)} (${fmtBp(nominalChange)} 5D); real yield ${fmtPct(realLevel)} (${fmtBp(realChange)}); breakeven ${fmtPct(breakevenLevel)} (${fmtBp(breakevenChange)}). ${accounted === null ? "Observed decomposition is incomplete." : `Real-yield + breakeven change accounts for ${fmtBp(accounted)}; residual ${fmtBp(residual)} is not assigned to a cause deterministically.`}`,
    },
    termPremium: {
      availability: termPremiumAvailability,
      levelPct: round(termPremiumLevel, 3),
      change5dBp: round(termPremiumChange),
      evidenceRef: termPremium?.evidence_id ?? null,
      detail: termPremium
        ? `Governed term-premium evidence is present at ${fmtPct(termPremiumLevel)} with change ${fmtBp(termPremiumChange)}.`
        : "Term premium is unresolved. Nominal yield pressure is not sufficient evidence to label a term-premium move.",
    },
    marketStructure: {
      treasurySupplyEvidenceRef: treasurySupply?.evidence_id ?? null,
      dealerEvidenceRef: dealers?.evidence_id ?? null,
      auctionEvidenceRef: auction?.evidence_id ?? null,
      dealerNetPositionMillions: dealerPosition,
      dealerNetPositionWeeklyChangeMillions: dealerPositionChange,
      failsDeliverMillions: failsDeliver,
      failsReceiveMillions: failsReceive,
      detail: [
        treasurySupply ? "Current Treasury supply/buyback evidence is present." : "Treasury supply/buyback evidence is unresolved.",
        dealers ? `Dealer net Treasury position ${dealerPosition ?? "n/a"}m (WoW ${dealerPositionChange ?? "n/a"}m); fails deliver ${failsDeliver ?? "n/a"}m; fails receive ${failsReceive ?? "n/a"}m. Dealer direction remains intentionally uninterpreted.` : "Dealer balance-sheet evidence is unavailable.",
        auction ? "Current auction evidence is present for System 2 review." : "Structured auction evidence is missing.",
      ].join(" "),
    },
    volatility: {
      moveEvidenceRef: move?.evidence_id ?? null,
      level: moveLevel,
      change5dPct: move5d,
      detail: move
        ? `Treasury volatility monitor ${moveLevel ?? "n/a"}; 5D ${move5d === null ? "n/a" : `${move5d >= 0 ? "+" : ""}${move5d.toFixed(2)}%`}.`
        : "MOVE/Treasury volatility is unresolved because no canonical monitor observation is present.",
    },
    evidenceRefs: [...new Set(refs)],
    gaps,
  };
}
