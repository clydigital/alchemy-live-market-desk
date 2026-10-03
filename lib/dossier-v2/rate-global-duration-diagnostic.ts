import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";
import type { RateCurveDiagnostic } from "./rate-curve-diagnostic.ts";

export const RATE_GLOBAL_DURATION_DIAGNOSTIC_VERSION = "rate-global-duration-diagnostic/1" as const;

export type GlobalDurationState =
  | "US_JAPAN_TIGHTENING"
  | "US_JAPAN_EASING"
  | "US_JAPAN_DIVERGENCE"
  | "MIXED"
  | "UNRESOLVED";

export type HoldingsDirection = "INCREASED" | "DECREASED" | "FLAT" | "UNRESOLVED";
export type FlowDirection = "NET_PURCHASE" | "NET_SALE" | "FLAT" | "UNRESOLVED";

export type RateGlobalDurationDiagnostic = {
  contractVersion: typeof RATE_GLOBAL_DURATION_DIAGNOSTIC_VERSION;
  asOf: string;
  japanRates: {
    asOf: string | null;
    jgb2yPct: number | null;
    jgb10yPct: number | null;
    jgb30yPct: number | null;
    jgb2yChange5dBp: number | null;
    jgb10yChange5dBp: number | null;
    jgb30yChange5dBp: number | null;
    evidenceRef: string | null;
  };
  relativeRates: {
    ustJgb2yBp: number | null;
    ustJgb10yBp: number | null;
    ustJgb30yBp: number | null;
    ustJgb2yChange5dBp: number | null;
    ustJgb10yChange5dBp: number | null;
    ustJgb30yChange5dBp: number | null;
    state: GlobalDurationState;
    globalLabelEligible: boolean;
    detail: string;
  };
  fx: {
    usdJpy: number | null;
    change5dPct: number | null;
    evidenceRef: string | null;
    detail: string;
  };
  foreignTreasuryDemand: {
    period: string | null;
    japanHoldingsUsdBn: number | null;
    japanPreviousUsdBn: number | null;
    japanMonthlyChangeUsdBn: number | null;
    japanHoldingsDirection: HoldingsDirection;
    totalForeignHoldingsUsdBn: number | null;
    foreignOfficialHoldingsUsdBn: number | null;
    custodyAttributionCaveat: string | null;
    evidenceRef: string | null;
    detail: string;
  };
  japanPortfolioFlows: {
    periodLabel: string | null;
    outwardLongTermDebtNetPurchaseJpyBn: number | null;
    outwardTotalNetPurchaseJpyBn: number | null;
    direction: FlowDirection;
    treasurySpecific: false;
    evidenceRef: string | null;
    detail: string;
  };
  comparability: {
    canCompareTicAndWeeklyMofAsSameFlow: false;
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
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;
}

function monitor(packet: DossierV2InputPacket, id: string) {
  return latestByPrefix(packet, `market-monitor:${id}:`);
}

function allEvidence(packet: DossierV2InputPacket) {
  const merged = [...(packet.rate_context?.evidence ?? []), ...packet.observed_evidence];
  return [...new Map(merged.map((item) => [item.evidence_id, item])).values()];
}

function explicitSovereignEvidence(packet: DossierV2InputPacket, context: string) {
  return allEvidence(packet)
    .filter((item) => metricString(item, "signal_context")?.toLowerCase() === context)
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;
}

function curvePoint(curve: RateCurveDiagnostic, maturity: "2Y" | "10Y" | "30Y") {
  return curve.points.find((item) => item.maturity === maturity) ?? null;
}

function round(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function spreadBp(us: number | null, foreign: number | null) {
  return us === null || foreign === null ? null : round((us - foreign) * 100);
}

function spreadChangeBp(us: number | null, foreign: number | null) {
  return us === null || foreign === null ? null : round(us - foreign);
}

function sign(value: number | null, threshold = 3) {
  if (value === null) return "UNRESOLVED" as const;
  if (value >= threshold) return "UP" as const;
  if (value <= -threshold) return "DOWN" as const;
  return "FLAT" as const;
}

function globalDurationState(
  us10: number | null,
  us30: number | null,
  jp10: number | null,
  jp30: number | null,
): GlobalDurationState {
  const us = [us10, us30].filter((value): value is number => value !== null);
  const jp = [jp10, jp30].filter((value): value is number => value !== null);
  if (!us.length || !jp.length) return "UNRESOLVED";

  const usAvg = us.reduce((sum, value) => sum + value, 0) / us.length;
  const jpAvg = jp.reduce((sum, value) => sum + value, 0) / jp.length;
  const usSign = sign(usAvg);
  const jpSign = sign(jpAvg);
  if (usSign === "UP" && jpSign === "UP") return "US_JAPAN_TIGHTENING";
  if (usSign === "DOWN" && jpSign === "DOWN") return "US_JAPAN_EASING";
  if (
    (usSign === "UP" && jpSign === "DOWN")
    || (usSign === "DOWN" && jpSign === "UP")
  ) return "US_JAPAN_DIVERGENCE";
  return "MIXED";
}

function holdingsDirection(value: number | null): HoldingsDirection {
  if (value === null) return "UNRESOLVED";
  if (value > 0.5) return "INCREASED";
  if (value < -0.5) return "DECREASED";
  return "FLAT";
}

function flowDirection(value: number | null): FlowDirection {
  if (value === null) return "UNRESOLVED";
  if (value > 1) return "NET_PURCHASE";
  if (value < -1) return "NET_SALE";
  return "FLAT";
}

function fmtBp(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp`;
}

function fmtPct(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function fmtUsdBn(value: number | null) {
  return value === null ? "n/a" : `$${value.toFixed(1)}bn`;
}

export function buildRateGlobalDurationDiagnostic(
  packet: DossierV2InputPacket,
  curve: RateCurveDiagnostic,
): RateGlobalDurationDiagnostic {
  const jgb = latestByPrefix(packet, "global-rates:jgb:");
  const tic = latestByPrefix(packet, "global-rates:tic:");
  const mofFlows = latestByPrefix(packet, "global-rates:japan-mof-flows:");
  const usdJpy = monitor(packet, "usdjpy");

  const bund = explicitSovereignEvidence(packet, "bund_10y");
  const gilt = explicitSovereignEvidence(packet, "gilt_10y");

  const us2 = curvePoint(curve, "2Y");
  const us10 = curvePoint(curve, "10Y");
  const us30 = curvePoint(curve, "30Y");

  const jp2 = metricNumber(jgb, "jgb_2y_pct");
  const jp10 = metricNumber(jgb, "jgb_10y_pct");
  const jp30 = metricNumber(jgb, "jgb_30y_pct");
  const jp2Change = metricNumber(jgb, "jgb_2y_change_5d_bp");
  const jp10Change = metricNumber(jgb, "jgb_10y_change_5d_bp");
  const jp30Change = metricNumber(jgb, "jgb_30y_change_5d_bp");

  const state = globalDurationState(
    us10?.change5dBp ?? null,
    us30?.change5dBp ?? null,
    jp10Change,
    jp30Change,
  );

  const globalLabelEligible = Boolean(
    jgb
    && jp10Change !== null
    && jp30Change !== null
    && bund
    && gilt
    && metricNumber(bund, "observed_value") !== null
    && metricNumber(gilt, "observed_value") !== null
    && metricNumber(bund, "change_5d_bp") !== null
    && metricNumber(gilt, "change_5d_bp") !== null
  );

  const jpyLast = metricNumber(usdJpy, "last");
  const jpyChange = metricNumber(usdJpy, "change_5d_pct");

  const japanHoldings = metricNumber(tic, "japan_holdings_usd_bn");
  const japanPrevious = metricNumber(tic, "japan_previous_usd_bn");
  const japanMonthlyChange = metricNumber(tic, "japan_monthly_change_usd_bn");
  const totalForeign = metricNumber(tic, "total_foreign_holdings_usd_bn");
  const foreignOfficial = metricNumber(tic, "foreign_official_holdings_usd_bn");
  const custodyCaveat = metricString(tic, "custody_attribution_caveat");

  const outwardLongDebt = metricNumber(mofFlows, "outward_long_term_debt_net_purchase_jpy_bn");
  const outwardTotal = metricNumber(mofFlows, "outward_total_net_purchase_jpy_bn");

  const gaps: string[] = [];
  if (!jgb) gaps.push("Direct Japan MOF JGB constant-maturity evidence is unavailable.");
  if (!tic) gaps.push("Treasury TIC country-level Treasury holdings are unavailable.");
  if (!mofFlows) gaps.push("Japan MOF weekly outward securities-flow evidence is unavailable.");
  if (!usdJpy) gaps.push("Explicit USDJPY market evidence is unavailable; DXY is not a substitute.");
  if (!bund) gaps.push("Comparable Bund long-end evidence is missing, so a broad global-duration label is not fully confirmed.");
  if (!gilt) gaps.push("Comparable gilt long-end evidence is missing, so a broad global-duration label is not fully confirmed.");

  const evidenceRefs = [
    jgb?.evidence_id,
    tic?.evidence_id,
    mofFlows?.evidence_id,
    usdJpy?.evidence_id,
    bund?.evidence_id,
    gilt?.evidence_id,
    ...curve.evidenceRefs,
  ].filter((value): value is string => Boolean(value));

  return {
    contractVersion: RATE_GLOBAL_DURATION_DIAGNOSTIC_VERSION,
    asOf: packet.as_of,
    japanRates: {
      asOf: jgb?.occurrence_time?.slice(0, 10) ?? null,
      jgb2yPct: jp2,
      jgb10yPct: jp10,
      jgb30yPct: jp30,
      jgb2yChange5dBp: jp2Change,
      jgb10yChange5dBp: jp10Change,
      jgb30yChange5dBp: jp30Change,
      evidenceRef: jgb?.evidence_id ?? null,
    },
    relativeRates: {
      ustJgb2yBp: spreadBp(us2?.yieldPct ?? null, jp2),
      ustJgb10yBp: spreadBp(us10?.yieldPct ?? null, jp10),
      ustJgb30yBp: spreadBp(us30?.yieldPct ?? null, jp30),
      ustJgb2yChange5dBp: spreadChangeBp(us2?.change5dBp ?? null, jp2Change),
      ustJgb10yChange5dBp: spreadChangeBp(us10?.change5dBp ?? null, jp10Change),
      ustJgb30yChange5dBp: spreadChangeBp(us30?.change5dBp ?? null, jp30Change),
      state,
      globalLabelEligible,
      detail: [
        `UST–JGB 2Y ${fmtBp(spreadBp(us2?.yieldPct ?? null, jp2))}`,
        `10Y ${fmtBp(spreadBp(us10?.yieldPct ?? null, jp10))}`,
        `30Y ${fmtBp(spreadBp(us30?.yieldPct ?? null, jp30))}`,
        `US/Japan long-end state: ${state.replaceAll("_", " ").toLowerCase()}`,
        globalLabelEligible
          ? "Bund and gilt evidence are also present, so a broader global-duration label has cross-sovereign support."
          : "Bund/gilt confirmation is incomplete, so this is US–Japan evidence rather than a complete global-duration verdict.",
      ].join(". ") + ".",
    },
    fx: {
      usdJpy: jpyLast,
      change5dPct: jpyChange,
      evidenceRef: usdJpy?.evidence_id ?? null,
      detail: jpyLast === null
        ? "USDJPY is unresolved."
        : `USDJPY ${jpyLast.toFixed(3)}; 5D ${jpyChange === null ? "n/a" : `${jpyChange >= 0 ? "+" : ""}${jpyChange.toFixed(2)}%`}.`,
    },
    foreignTreasuryDemand: {
      period: metricString(tic, "period"),
      japanHoldingsUsdBn: japanHoldings,
      japanPreviousUsdBn: japanPrevious,
      japanMonthlyChangeUsdBn: japanMonthlyChange,
      japanHoldingsDirection: holdingsDirection(japanMonthlyChange),
      totalForeignHoldingsUsdBn: totalForeign,
      foreignOfficialHoldingsUsdBn: foreignOfficial,
      custodyAttributionCaveat: custodyCaveat,
      evidenceRef: tic?.evidence_id ?? null,
      detail: tic
        ? `TIC Japan Treasury holdings ${fmtUsdBn(japanHoldings)} versus ${fmtUsdBn(japanPrevious)} prior month; reported holdings ${holdingsDirection(japanMonthlyChange).toLowerCase()} by ${fmtUsdBn(japanMonthlyChange === null ? null : Math.abs(japanMonthlyChange))}. This is a monthly holdings change, not a same-week transaction measure.`
        : "TIC foreign Treasury holdings are unresolved.",
    },
    japanPortfolioFlows: {
      periodLabel: metricString(mofFlows, "period_label"),
      outwardLongTermDebtNetPurchaseJpyBn: outwardLongDebt,
      outwardTotalNetPurchaseJpyBn: outwardTotal,
      direction: flowDirection(outwardLongDebt),
      treasurySpecific: false,
      evidenceRef: mofFlows?.evidence_id ?? null,
      detail: mofFlows
        ? `Japan MOF weekly residents' outward long-term debt flow: ${outwardLongDebt === null ? "n/a" : `${outwardLongDebt >= 0 ? "+" : ""}${outwardLongDebt.toFixed(1)} JPY bn`} (${flowDirection(outwardLongDebt).replaceAll("_", " ").toLowerCase()}). This covers foreign long-term debt securities generally and is not Treasury-specific.`
        : "Japan MOF weekly portfolio-flow evidence is unresolved.",
    },
    comparability: {
      canCompareTicAndWeeklyMofAsSameFlow: false,
      detail: "TIC is monthly U.S. Treasury holdings by reported country/custody location. Japan MOF weekly data covers Japanese residents' foreign securities transactions by asset class, not U.S. Treasuries specifically. Use them as separate context, not one synthetic flow series.",
    },
    evidenceRefs: [...new Set(evidenceRefs)],
    gaps,
  };
}
