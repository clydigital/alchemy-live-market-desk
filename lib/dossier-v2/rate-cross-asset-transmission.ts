import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";
import type { RateLongEndDiagnostic } from "./rate-long-end-diagnostic.ts";
import type { RateGlobalDurationDiagnostic } from "./rate-global-duration-diagnostic.ts";

export const RATE_CROSS_ASSET_TRANSMISSION_VERSION = "rate-cross-asset-transmission/1" as const;

export type RateTransmissionState =
  | "HIGH_RATES_CONTAINED"
  | "VALUATION_PRESSURE"
  | "CREDIT_STRESS"
  | "GROWTH_SCARE_RISK_OFF"
  | "MIXED"
  | "UNRESOLVED";

export type GoldTransmissionState =
  | "PRESSURED_AS_EXPECTED"
  | "RELIEF_AS_EXPECTED"
  | "RESILIENT_DIVERGENCE"
  | "WEAK_DIVERGENCE"
  | "MIXED"
  | "UNRESOLVED";

export type CreditTransmissionState =
  | "CONTAINED"
  | "WIDENING"
  | "STRESS"
  | "EASING"
  | "UNRESOLVED";

export type EquityDurationState =
  | "RESILIENT"
  | "VALUATION_PRESSURE"
  | "BROAD_RISK_OFF"
  | "MIXED"
  | "UNRESOLVED";

export type CarryTransmissionState =
  | "USD_CARRY_ALIGNED"
  | "CARRY_UNWIND_ALIGNED"
  | "DIVERGENT"
  | "MIXED"
  | "UNRESOLVED";

export type RateCrossAssetTransmission = {
  contractVersion: typeof RATE_CROSS_ASSET_TRANSMISSION_VERSION;
  asOf: string;
  state: RateTransmissionState;
  ratePressure: {
    restrictive: boolean;
    easingImpulse: boolean;
    nominal10yPct: number | null;
    nominal10yChange5dBp: number | null;
    real10yPct: number | null;
    real10yChange5dBp: number | null;
    detail: string;
  };
  gold: {
    state: GoldTransmissionState;
    goldChange5dPct: number | null;
    dxyChange5dPct: number | null;
    realYieldChange5dBp: number | null;
    detail: string;
    evidenceRefs: string[];
  };
  credit: {
    state: CreditTransmissionState;
    hyOasPct: number | null;
    hyOasChange5dBp: number | null;
    igOasPct: number | null;
    igOasChange5dBp: number | null;
    detail: string;
    evidenceRefs: string[];
  };
  equityDuration: {
    state: EquityDurationState;
    spxChange5dPct: number | null;
    ndxChange5dPct: number | null;
    rspChange5dPct: number | null;
    iwmChange5dPct: number | null;
    smhChange5dPct: number | null;
    ndxVsRsp5dPct: number | null;
    smhVsNdx5dPct: number | null;
    detail: string;
    evidenceRefs: string[];
  };
  carry: {
    state: CarryTransmissionState;
    ustJgb10yGapChange5dBp: number | null;
    usdJpyChange5dPct: number | null;
    detail: string;
    evidenceRefs: string[];
  };
  detail: string;
  evidenceRefs: string[];
  gaps: string[];
};

function latestByPrefix(packet: DossierV2InputPacket, prefix: string) {
  return packet.observed_evidence
    .filter((item) => item.evidence_id.startsWith(prefix))
    .sort((left, right) => right.available_at.localeCompare(left.available_at))[0] ?? null;
}

function monitor(packet: DossierV2InputPacket, id: string) {
  return latestByPrefix(packet, `market-monitor:${id}:`);
}

function metricNumber(item: ObservedEvidence | null | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function spreadBp(item: ObservedEvidence | null) {
  const level = metricNumber(item, "spread_level_pct") ?? metricNumber(item, "last");
  const pct = metricNumber(item, "change_5d_pct");
  if (level === null || pct === null || pct <= -99.99) return null;
  const prior = level / (1 + pct / 100);
  return round((level - prior) * 100);
}

function pct5d(item: ObservedEvidence | null) {
  return round(metricNumber(item, "change_5d_pct"), 2);
}

function goldState(realBp: number | null, goldPct: number | null): GoldTransmissionState {
  if (realBp === null || goldPct === null) return "UNRESOLVED";
  if (realBp >= 5 && goldPct <= -1) return "PRESSURED_AS_EXPECTED";
  if (realBp <= -5 && goldPct >= 1) return "RELIEF_AS_EXPECTED";
  if (realBp >= 5 && goldPct >= 1) return "RESILIENT_DIVERGENCE";
  if (realBp <= -5 && goldPct <= -1) return "WEAK_DIVERGENCE";
  return "MIXED";
}

function creditState(hyBp: number | null, igBp: number | null): CreditTransmissionState {
  if (hyBp === null && igBp === null) return "UNRESOLVED";
  if ((hyBp ?? 0) >= 20 || (igBp ?? 0) >= 8) return "STRESS";
  if ((hyBp ?? 0) >= 10 || (igBp ?? 0) >= 4) return "WIDENING";
  if ((hyBp ?? 0) <= -10 || (igBp ?? 0) <= -4) return "EASING";
  return "CONTAINED";
}

function equityState(input: {
  realBp: number | null;
  spx: number | null;
  ndx: number | null;
  rsp: number | null;
  iwm: number | null;
}): EquityDurationState {
  const { realBp, spx, ndx, rsp, iwm } = input;
  const observed = [spx, ndx, rsp, iwm].filter((value): value is number => value !== null);
  if (observed.length < 2) return "UNRESOLVED";
  if (observed.length >= 3 && observed.filter((value) => value <= -1.5).length >= 3) return "BROAD_RISK_OFF";
  if (realBp !== null && realBp >= 5 && ndx !== null && rsp !== null && ndx <= -1 && ndx - rsp <= -1) {
    return "VALUATION_PRESSURE";
  }
  if (realBp !== null && realBp >= 5 && ndx !== null && rsp !== null && ndx >= 0 && ndx - rsp >= -0.5) {
    return "RESILIENT";
  }
  return "MIXED";
}

function carryState(gapChange: number | null, usdJpyChange: number | null): CarryTransmissionState {
  if (gapChange === null || usdJpyChange === null) return "UNRESOLVED";
  if (gapChange >= 10 && usdJpyChange >= 1) return "USD_CARRY_ALIGNED";
  if (gapChange <= -10 && usdJpyChange <= -1) return "CARRY_UNWIND_ALIGNED";
  if ((gapChange >= 10 && usdJpyChange <= -1) || (gapChange <= -10 && usdJpyChange >= 1)) return "DIVERGENT";
  return "MIXED";
}

function fmt(value: number | null, suffix = "") {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

export function buildRateCrossAssetTransmission(
  packet: DossierV2InputPacket,
  longEnd: RateLongEndDiagnostic,
  globalDuration: RateGlobalDurationDiagnostic,
): RateCrossAssetTransmission {
  const gold = monitor(packet, "gold");
  const dxy = monitor(packet, "dxy");
  const hy = monitor(packet, "hy-oas");
  const ig = monitor(packet, "ig-oas");
  const spx = monitor(packet, "spx");
  const ndx = monitor(packet, "ndx");
  const rsp = monitor(packet, "rsp");
  const iwm = monitor(packet, "russell");
  const smh = monitor(packet, "smh");

  const gold5d = pct5d(gold);
  const dxy5d = pct5d(dxy);
  const hyChange = spreadBp(hy);
  const igChange = spreadBp(ig);
  const spx5d = pct5d(spx);
  const ndx5d = pct5d(ndx);
  const rsp5d = pct5d(rsp);
  const iwm5d = pct5d(iwm);
  const smh5d = pct5d(smh);
  const real5d = longEnd.real10y.change5dBp;
  const nominal5d = longEnd.nominal10y.change5dBp;
  const realLevel = longEnd.real10y.levelPct;
  const nominalLevel = longEnd.nominal10y.levelPct;

  const restrictive = (nominalLevel !== null && nominalLevel >= 5)
    || (realLevel !== null && realLevel >= 2)
    || (nominal5d !== null && nominal5d >= 7)
    || (real5d !== null && real5d >= 5);
  const easingImpulse = (nominal5d !== null && nominal5d <= -7)
    || (real5d !== null && real5d <= -5);

  const goldTransmission = goldState(real5d, gold5d);
  const creditTransmission = creditState(hyChange, igChange);
  const equityTransmission = equityState({
    realBp: real5d,
    spx: spx5d,
    ndx: ndx5d,
    rsp: rsp5d,
    iwm: iwm5d,
  });
  const carryTransmission = carryState(
    globalDuration.relativeRates.ustJgb10yChange5dBp,
    globalDuration.fx.change5dPct,
  );

  let state: RateTransmissionState = "UNRESOLVED";
  if (
    easingImpulse
    && creditTransmission === "STRESS"
    && equityTransmission === "BROAD_RISK_OFF"
  ) {
    state = "GROWTH_SCARE_RISK_OFF";
  } else if (creditTransmission === "STRESS") {
    state = "CREDIT_STRESS";
  } else if (restrictive && equityTransmission === "VALUATION_PRESSURE") {
    state = "VALUATION_PRESSURE";
  } else if (
    restrictive
    && (creditTransmission === "CONTAINED" || creditTransmission === "EASING")
    && (equityTransmission === "RESILIENT" || equityTransmission === "MIXED")
  ) {
    state = "HIGH_RATES_CONTAINED";
  } else if (
    creditTransmission !== "UNRESOLVED"
    || equityTransmission !== "UNRESOLVED"
    || goldTransmission !== "UNRESOLVED"
    || carryTransmission !== "UNRESOLVED"
  ) {
    state = "MIXED";
  }

  const ndxVsRsp = ndx5d !== null && rsp5d !== null ? round(ndx5d - rsp5d, 2) : null;
  const smhVsNdx = smh5d !== null && ndx5d !== null ? round(smh5d - ndx5d, 2) : null;

  const gaps: string[] = [];
  if (!gold || real5d === null) gaps.push("Gold/real-yield transmission is incomplete.");
  if (!hy && !ig) gaps.push("HY/IG spread evidence is unavailable.");
  if (!ndx || !rsp || !spx) gaps.push("Equity-duration comparison lacks SPX/NDX/RSP coverage.");
  if (globalDuration.relativeRates.ustJgb10yChange5dBp === null || globalDuration.fx.change5dPct === null) {
    gaps.push("Carry transmission lacks comparable UST-JGB gap change or USDJPY change.");
  }

  const evidenceRefs = [...new Set([
    longEnd.real10y.evidenceRef,
    longEnd.nominal10y.evidenceRef,
    gold?.evidence_id,
    dxy?.evidence_id,
    hy?.evidence_id,
    ig?.evidence_id,
    spx?.evidence_id,
    ndx?.evidence_id,
    rsp?.evidence_id,
    iwm?.evidence_id,
    smh?.evidence_id,
    globalDuration.fx.evidenceRef,
    globalDuration.japanRates.evidenceRef,
    ...globalDuration.evidenceRefs,
  ].filter((value): value is string => Boolean(value)))];

  return {
    contractVersion: RATE_CROSS_ASSET_TRANSMISSION_VERSION,
    asOf: packet.as_of,
    state,
    ratePressure: {
      restrictive,
      easingImpulse,
      nominal10yPct: nominalLevel,
      nominal10yChange5dBp: nominal5d,
      real10yPct: realLevel,
      real10yChange5dBp: real5d,
      detail: `10Y nominal ${nominalLevel === null ? "n/a" : `${nominalLevel.toFixed(2)}%`} (${fmt(nominal5d, " bp")} 5D); real yield ${realLevel === null ? "n/a" : `${realLevel.toFixed(2)}%`} (${fmt(real5d, " bp")} 5D).`,
    },
    gold: {
      state: goldTransmission,
      goldChange5dPct: gold5d,
      dxyChange5dPct: dxy5d,
      realYieldChange5dBp: real5d,
      detail: `Gold 5D ${fmt(gold5d, "%")}; 10Y real yield ${fmt(real5d, " bp")}; DXY proxy ${fmt(dxy5d, "%")}. ${goldTransmission.replaceAll("_", " ").toLowerCase()} describes the observed relationship only; it does not assign a structural gold-demand cause.`,
      evidenceRefs: [gold?.evidence_id, dxy?.evidence_id, longEnd.real10y.evidenceRef].filter((value): value is string => Boolean(value)),
    },
    credit: {
      state: creditTransmission,
      hyOasPct: metricNumber(hy, "spread_level_pct") ?? metricNumber(hy, "last"),
      hyOasChange5dBp: hyChange,
      igOasPct: metricNumber(ig, "spread_level_pct") ?? metricNumber(ig, "last"),
      igOasChange5dBp: igChange,
      detail: `HY OAS 5D ${fmt(hyChange, " bp")}; IG OAS 5D ${fmt(igChange, " bp")}. State: ${creditTransmission.replaceAll("_", " ").toLowerCase()}.`,
      evidenceRefs: [hy?.evidence_id, ig?.evidence_id].filter((value): value is string => Boolean(value)),
    },
    equityDuration: {
      state: equityTransmission,
      spxChange5dPct: spx5d,
      ndxChange5dPct: ndx5d,
      rspChange5dPct: rsp5d,
      iwmChange5dPct: iwm5d,
      smhChange5dPct: smh5d,
      ndxVsRsp5dPct: ndxVsRsp,
      smhVsNdx5dPct: smhVsNdx,
      detail: `SPX ${fmt(spx5d, "%")}; NDX ${fmt(ndx5d, "%")}; RSP ${fmt(rsp5d, "%")}; IWM ${fmt(iwm5d, "%")}; SMH ${fmt(smh5d, "%")}. NDX vs RSP ${fmt(ndxVsRsp, " pts")}; SMH vs NDX ${fmt(smhVsNdx, " pts")}.`,
      evidenceRefs: [spx?.evidence_id, ndx?.evidence_id, rsp?.evidence_id, iwm?.evidence_id, smh?.evidence_id].filter((value): value is string => Boolean(value)),
    },
    carry: {
      state: carryTransmission,
      ustJgb10yGapChange5dBp: globalDuration.relativeRates.ustJgb10yChange5dBp,
      usdJpyChange5dPct: globalDuration.fx.change5dPct,
      detail: `UST-JGB 10Y gap 5D ${fmt(globalDuration.relativeRates.ustJgb10yChange5dBp, " bp")}; USDJPY 5D ${fmt(globalDuration.fx.change5dPct, "%")}. State: ${carryTransmission.replaceAll("_", " ").toLowerCase()}.`,
      evidenceRefs: [globalDuration.fx.evidenceRef, globalDuration.japanRates.evidenceRef].filter((value): value is string => Boolean(value)),
    },
    detail: `Rates transmission state: ${state.replaceAll("_", " ").toLowerCase()}. Credit is ${creditTransmission.replaceAll("_", " ").toLowerCase()}, equity duration is ${equityTransmission.replaceAll("_", " ").toLowerCase()}, gold is ${goldTransmission.replaceAll("_", " ").toLowerCase()}, and carry is ${carryTransmission.replaceAll("_", " ").toLowerCase()}.`,
    evidenceRefs,
    gaps,
  };
}
