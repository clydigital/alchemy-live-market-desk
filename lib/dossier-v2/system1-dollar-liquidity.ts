import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";
import type { DossierRateRegimeSnapshot } from "./rate-regime.ts";

export const SYSTEM1_DOLLAR_LIQUIDITY_V1 = "system1-dollar-liquidity/1" as const;

export type DollarLiquidityDirection =
  | "TIGHTER"
  | "EASIER"
  | "NEUTRAL"
  | "UNRESOLVED";

export type DollarLiquidityState =
  | "TIGHTENING"
  | "SLIGHTLY_TIGHTENING"
  | "NEUTRAL"
  | "SLIGHTLY_EASING"
  | "EASING"
  | "MIXED"
  | "UNRESOLVED";

export type DollarLiquidityConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNRESOLVED";

export type DollarLiquidityComponent = {
  key:
    | "FUNDING"
    | "FRONT_END_COLLATERAL"
    | "CREDIT"
    | "USD"
    | "BALANCE_SHEET"
    | "OFFSHORE_USD";
  label: string;
  direction: DollarLiquidityDirection;
  score: number;
  detail: string;
  evidenceRefs: string[];
};

export type System1DollarLiquiditySnapshot = {
  contractVersion: typeof SYSTEM1_DOLLAR_LIQUIDITY_V1;
  asOf: string;
  state: DollarLiquidityState;
  score: number;
  confidence: DollarLiquidityConfidence;
  summary: string;
  components: DollarLiquidityComponent[];
  drivers: string[];
  contradictions: string[];
  evidenceRefs: string[];
  coverage: {
    resolved: number;
    scoredTotal: number;
    offshoreUsd: "UNRESOLVED";
  };
  gaps: string[];
};

export type PolicyLiquidityInteraction = {
  policyState: DossierRateRegimeSnapshot["state"];
  liquidityState: DollarLiquidityState;
  alignment:
    | "CONFIRMING_TIGHTENING"
    | "CONFIRMING_EASING"
    | "POLICY_LIQUIDITY_DIVERGENCE"
    | "MARKET_LED_TIGHTENING"
    | "MARKET_LED_EASING"
    | "NO_MATERIAL_SIGNAL"
    | "UNRESOLVED";
  priority: "HIGH" | "MEDIUM" | "LOW";
  escalateToBrain: boolean;
  question: string;
};

function metricNumber(item: ObservedEvidence | null | undefined, key: string) {
  const value = item?.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function providerUsable(item: ObservedEvidence | null | undefined) {
  const status = item?.metrics?.provider_status;
  return status !== "STALE" && status !== "UNAVAILABLE";
}

function latestByPrefix(packet: DossierV2InputPacket, prefix: string) {
  return packet.observed_evidence
    .filter((item) => item.evidence_id.startsWith(prefix))
    .sort((a, b) => b.available_at.localeCompare(a.available_at))[0] ?? null;
}

function monitor(packet: DossierV2InputPacket, id: string) {
  return latestByPrefix(packet, `market-monitor:${id}:`);
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function round(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function bpMove(item: ObservedEvidence | null) {
  const last = metricNumber(item, "spread_level_pct") ?? metricNumber(item, "last");
  const pct = metricNumber(item, "change_5d_pct");
  if (last === null || pct === null || pct <= -99.99) return null;
  const prior = last / (1 + pct / 100);
  return (last - prior) * 100;
}

function component(
  key: DollarLiquidityComponent["key"],
  label: string,
  direction: DollarLiquidityDirection,
  score: number,
  detail: string,
  refs: Array<string | null | undefined>,
): DollarLiquidityComponent {
  return {
    key,
    label,
    direction,
    score,
    detail,
    evidenceRefs: refs.filter((value): value is string => Boolean(value)),
  };
}

function fundingComponent(packet: DossierV2InputPacket) {
  const item = latestByPrefix(packet, "system1-dollar:nyfed-rates:");
  const spread = metricNumber(item, "secured_vs_effr_bps");
  if (!providerUsable(item) || spread === null) {
    return component(
      "FUNDING",
      "Secured funding",
      "UNRESOLVED",
      0,
      "EFFR/SOFR/TGCR/BGCR coverage is incomplete.",
      [item?.evidence_id],
    );
  }
  const score = spread >= 8 ? 2 : spread >= 3 ? 1 : spread <= -8 ? -2 : spread <= -3 ? -1 : 0;
  const direction: DollarLiquidityDirection = score > 0 ? "TIGHTER" : score < 0 ? "EASIER" : "NEUTRAL";
  return component(
    "FUNDING",
    "Secured funding",
    direction,
    score,
    `Secured overnight rates are ${spread >= 0 ? "+" : ""}${spread.toFixed(1)} bp versus EFFR.`,
    [item?.evidence_id],
  );
}

function frontEndComponent(packet: DossierV2InputPacket) {
  const official = latestByPrefix(packet, "system1-dollar:treasury-bills:");
  const effrEvidence = latestByPrefix(packet, "system1-dollar:nyfed-rates:") ?? monitor(packet, "fed-funds-effective");
  const bill3m = metricNumber(official, "bill_3m_pct") ?? metricNumber(monitor(packet, "us3m-bill"), "last");
  const bill6m = metricNumber(official, "bill_6m_pct") ?? metricNumber(monitor(packet, "us6m-bill"), "last");
  const effr = metricNumber(effrEvidence, "effr_pct") ?? metricNumber(effrEvidence, "last");
  const officialUsable = !official || providerUsable(official);
  const values = officialUsable
    ? [bill3m, bill6m].filter((value): value is number => value !== null)
    : [];
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const spread = average !== null && effr !== null ? (average - effr) * 100 : null;
  if (spread === null) {
    return component(
      "FRONT_END_COLLATERAL",
      "Front-end / collateral",
      "UNRESOLVED",
      0,
      "Treasury-bill versus effective-funds pricing is incomplete.",
      [official?.evidence_id, effrEvidence?.evidence_id],
    );
  }
  const score = spread >= 15 ? 2 : spread >= 5 ? 1 : spread <= -15 ? -2 : spread <= -5 ? -1 : 0;
  const direction: DollarLiquidityDirection = score > 0 ? "TIGHTER" : score < 0 ? "EASIER" : "NEUTRAL";
  return component(
    "FRONT_END_COLLATERAL",
    "Front-end / collateral",
    direction,
    score,
    `3M/6M bill average is ${spread >= 0 ? "+" : ""}${spread.toFixed(1)} bp versus EFFR.`,
    [official?.evidence_id, effrEvidence?.evidence_id],
  );
}

function creditComponent(packet: DossierV2InputPacket) {
  const hy = monitor(packet, "hy-oas");
  const ig = monitor(packet, "ig-oas");
  const hyMove = bpMove(hy);
  const igMove = bpMove(ig);
  if (hyMove === null && igMove === null) {
    return component(
      "CREDIT",
      "Credit transmission",
      "UNRESOLVED",
      0,
      "HY/IG spread changes are unavailable.",
      [hy?.evidence_id, ig?.evidence_id],
    );
  }
  let score = 0;
  if ((hyMove ?? -Infinity) >= 15 || (igMove ?? -Infinity) >= 8) score = 2;
  else if ((hyMove ?? -Infinity) >= 7 || (igMove ?? -Infinity) >= 4) score = 1;
  else if ((hyMove ?? Infinity) <= -15 && (igMove === null || igMove <= -5)) score = -2;
  else if ((hyMove ?? Infinity) <= -7 && (igMove === null || igMove <= -3)) score = -1;
  const direction: DollarLiquidityDirection = score > 0 ? "TIGHTER" : score < 0 ? "EASIER" : "NEUTRAL";
  return component(
    "CREDIT",
    "Credit transmission",
    direction,
    score,
    `HY OAS 5D ${hyMove === null ? "n/a" : `${hyMove >= 0 ? "+" : ""}${hyMove.toFixed(1)} bp`}; IG OAS 5D ${igMove === null ? "n/a" : `${igMove >= 0 ? "+" : ""}${igMove.toFixed(1)} bp`}.`,
    [hy?.evidence_id, ig?.evidence_id],
  );
}

function usdComponent(packet: DossierV2InputPacket) {
  const usd = monitor(packet, "dxy");
  const change = metricNumber(usd, "change_5d_pct");
  if (change === null) {
    return component("USD", "US dollar", "UNRESOLVED", 0, "Dollar trend is unavailable.", [usd?.evidence_id]);
  }
  const score = change >= 2 ? 2 : change >= 1 ? 1 : change <= -2 ? -2 : change <= -1 ? -1 : 0;
  const direction: DollarLiquidityDirection = score > 0 ? "TIGHTER" : score < 0 ? "EASIER" : "NEUTRAL";
  return component(
    "USD",
    "US dollar",
    direction,
    score,
    `Dollar proxy 5D ${change >= 0 ? "+" : ""}${change.toFixed(2)}%.`,
    [usd?.evidence_id],
  );
}

function balanceSheetComponent(packet: DossierV2InputPacket) {
  const dealers = latestByPrefix(packet, "system1-dollar:dealer-balance-sheet:");
  if (!dealers) {
    return component(
      "BALANCE_SHEET",
      "Dealer balance sheet",
      "UNRESOLVED",
      0,
      "Primary-dealer positions and Treasury fails are unavailable.",
      [],
    );
  }
  const failsDeliver = metricNumber(dealers, "fails_deliver_millions");
  const failsReceive = metricNumber(dealers, "fails_receive_millions");
  const weeklyDeliver = metricNumber(dealers, "fails_deliver_weekly_change_millions");
  const weeklyReceive = metricNumber(dealers, "fails_receive_weekly_change_millions");
  return component(
    "BALANCE_SHEET",
    "Dealer balance sheet",
    "UNRESOLVED",
    0,
    `Dealer fails: deliver ${failsDeliver ?? "n/a"}m (${weeklyDeliver ?? "n/a"}m WoW); receive ${failsReceive ?? "n/a"}m (${weeklyReceive ?? "n/a"}m WoW). Direction remains unresolved until a validated dealer-stress rule exists.`,
    [dealers.evidence_id],
  );
}

export function buildSystem1DollarLiquidity(
  packet: DossierV2InputPacket,
): System1DollarLiquiditySnapshot {
  const components = [
    fundingComponent(packet),
    frontEndComponent(packet),
    creditComponent(packet),
    usdComponent(packet),
    balanceSheetComponent(packet),
    component(
      "OFFSHORE_USD",
      "Offshore USD",
      "UNRESOLVED",
      0,
      "Cross-currency basis / FX-swap dollar funding is not yet in the canonical provider set.",
      [],
    ),
  ];

  const scored = components.filter((item) =>
    ["FUNDING", "FRONT_END_COLLATERAL", "CREDIT", "USD"].includes(item.key)
    && item.direction !== "UNRESOLVED"
  );
  const rawScore = scored.reduce((sum, item) => sum + item.score, 0);
  const positives = scored.filter((item) => item.score > 0);
  const negatives = scored.filter((item) => item.score < 0);

  let state: DollarLiquidityState;
  if (scored.length < 2) state = "UNRESOLVED";
  else if (rawScore >= 5) state = "TIGHTENING";
  else if (rawScore >= 2) state = "SLIGHTLY_TIGHTENING";
  else if (rawScore <= -5) state = "EASING";
  else if (rawScore <= -2) state = "SLIGHTLY_EASING";
  else if (positives.length && negatives.length) state = "MIXED";
  else state = "NEUTRAL";

  const confidence: DollarLiquidityConfidence =
    scored.length === 4 ? "HIGH"
      : scored.length === 3 ? "MEDIUM"
        : scored.length === 2 ? "LOW"
          : "UNRESOLVED";

  const score = Math.round(clamp(rawScore / 8, -1, 1) * 100);
  const drivers = components
    .filter((item) => item.score !== 0)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.direction.toLowerCase()} — ${item.detail}`);
  const contradictions = positives.length && negatives.length
    ? [
        `Tightening: ${positives.map((item) => item.label).join(", ")}.`,
        `Easing: ${negatives.map((item) => item.label).join(", ")}.`,
      ]
    : [];
  const evidenceRefs = [...new Set(components.flatMap((item) => item.evidenceRefs))];
  const summaryLead =
    state === "TIGHTENING" ? "Dollar liquidity is tightening."
      : state === "SLIGHTLY_TIGHTENING" ? "Dollar liquidity is slightly tightening."
        : state === "EASING" ? "Dollar liquidity is easing."
          : state === "SLIGHTLY_EASING" ? "Dollar liquidity is slightly easing."
            : state === "MIXED" ? "Dollar-liquidity signals are mixed."
              : state === "NEUTRAL" ? "Dollar liquidity is broadly neutral."
                : "Dollar liquidity is unresolved.";

  return {
    contractVersion: SYSTEM1_DOLLAR_LIQUIDITY_V1,
    asOf: packet.as_of,
    state,
    score,
    confidence,
    summary: `${summaryLead} ${drivers.slice(0, 2).join(" ")}`.trim(),
    components,
    drivers,
    contradictions,
    evidenceRefs,
    coverage: {
      resolved: scored.length,
      scoredTotal: 4,
      offshoreUsd: "UNRESOLVED",
    },
    gaps: [
      ...(components.find((item) => item.key === "BALANCE_SHEET")?.direction === "UNRESOLVED"
        ? ["Dealer balance-sheet direction is intentionally unresolved pending a validated rule."]
        : []),
      "Offshore USD / cross-currency basis is not yet normalized; do not call this a complete eurodollar-system measure.",
    ],
  };
}

function tight(state: DollarLiquidityState) {
  return state === "TIGHTENING" || state === "SLIGHTLY_TIGHTENING";
}

function easy(state: DollarLiquidityState) {
  return state === "EASING" || state === "SLIGHTLY_EASING";
}

export function buildPolicyLiquidityInteraction(
  rateRegime: DossierRateRegimeSnapshot,
  liquidity: System1DollarLiquiditySnapshot,
): PolicyLiquidityInteraction {
  const policy = rateRegime.state;
  const liq = liquidity.state;

  let alignment: PolicyLiquidityInteraction["alignment"] = "UNRESOLVED";
  if (liq === "UNRESOLVED" || policy === "UNRESOLVED" || policy === "MIXED") {
    alignment = liq === "NEUTRAL" ? "NO_MATERIAL_SIGNAL" : "UNRESOLVED";
  } else if (policy === "HAWKISH" && tight(liq)) alignment = "CONFIRMING_TIGHTENING";
  else if (policy === "DOVISH" && easy(liq)) alignment = "CONFIRMING_EASING";
  else if ((policy === "HAWKISH" && easy(liq)) || (policy === "DOVISH" && tight(liq))) {
    alignment = "POLICY_LIQUIDITY_DIVERGENCE";
  } else if (policy === "NEUTRAL" && tight(liq)) alignment = "MARKET_LED_TIGHTENING";
  else if (policy === "NEUTRAL" && easy(liq)) alignment = "MARKET_LED_EASING";
  else if (liq === "NEUTRAL") alignment = "NO_MATERIAL_SIGNAL";

  const credit = liquidity.components.find((item) => item.key === "CREDIT");
  const priority: PolicyLiquidityInteraction["priority"] =
    alignment === "POLICY_LIQUIDITY_DIVERGENCE" ? "HIGH"
      : alignment === "CONFIRMING_TIGHTENING" && credit?.direction === "TIGHTER" ? "HIGH"
        : ["CONFIRMING_TIGHTENING", "CONFIRMING_EASING", "MARKET_LED_TIGHTENING", "MARKET_LED_EASING"].includes(alignment)
          ? "MEDIUM"
          : "LOW";

  const question =
    alignment === "POLICY_LIQUIDITY_DIVERGENCE"
      ? "Why is the dollar-liquidity system moving against the policy/rates regime, and which transmission channel is dominant?"
      : alignment === "CONFIRMING_TIGHTENING"
        ? credit?.direction === "TIGHTER"
          ? "Is confirmed policy-plus-dollar tightening now transmitting into credit and broader risk assets?"
          : "Why are policy and dollar conditions tightening while credit remains relatively contained?"
        : alignment === "CONFIRMING_EASING"
          ? "Is policy easing transmitting through funding, credit and the dollar strongly enough to support broader risk assets?"
          : alignment === "MARKET_LED_TIGHTENING"
            ? "What is driving market-led dollar tightening despite a neutral policy state?"
            : alignment === "MARKET_LED_EASING"
              ? "What is driving market-led dollar easing despite a neutral policy state?"
              : "No material policy-versus-liquidity divergence requires escalation.";

  return {
    policyState: policy,
    liquidityState: liq,
    alignment,
    priority,
    escalateToBrain: priority !== "LOW",
    question,
  };
}
