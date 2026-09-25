import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";
import type { MarketMonitor, MarketMonitorRow } from "./market-monitor.ts";
import type { NyFedPrimaryDealerSnapshot } from "./providers/ny-fed-primary-dealers.ts";
import type { NyFedReferenceRatesSnapshot } from "./providers/ny-fed-reference-rates.ts";
import type { TreasuryBillSnapshot } from "./providers/treasury-bills.ts";

export const MARKET_INTELLIGENCE_SNAPSHOT_V1 = "market-intelligence-snapshot/v1" as const;

export type MonetarySignalDirection =
  | "TIGHTER"
  | "EASIER"
  | "NEUTRAL"
  | "MIXED"
  | "UNRESOLVED";

export type CrossSignalConfirmation =
  | "CONFIRMING"
  | "CONTRADICTING"
  | "UNRESOLVED";

export type MarketIntelligenceSignal = {
  key: string;
  label: string;
  direction: MonetarySignalDirection;
  confirmation: CrossSignalConfirmation;
  detail: string;
  asOf: string | null;
  sourceName: string;
  sourceUrl: string | null;
  evidenceRefs: string[];
  metrics: Record<string, number | string | null>;
};

export type MarketIntelligenceSnapshotV1 = {
  contractVersion: typeof MARKET_INTELLIGENCE_SNAPSHOT_V1;
  generatedAt: string;
  source: "Alchemy Live Market Desk";
  dossier: {
    status: string;
    dossierId: string;
    asOf: string;
    degraded: boolean;
  };
  regime: {
    headline: string;
    answer: string;
    regimeImplication: string;
    regimeFamily: string;
    whatWouldChangeMind: string;
    rateRegime: DossierPresentationV1["rateRegime"];
  };
  dollarLiquidity: DossierPresentationV1["dollarLiquidity"];
  policyLiquidityInteraction: DossierPresentationV1["policyLiquidityInteraction"];
  monetarySignals: {
    baseline: DossierPresentationV1["rateRegime"]["state"];
    signals: MarketIntelligenceSignal[];
    confirming: string[];
    contradicting: string[];
    unresolved: string[];
    summary: string;
  };
  marketState: {
    lenses: DossierPresentationV1["regimeStrip"];
    selectedRows: Array<{
      id: string;
      symbol: string;
      label: string;
      last: number | null;
      change5d: number | null;
      asOf: string | null;
      sourceName: string;
      sourceUrl: string;
    }>;
    dailyAssetState: unknown;
  };
  stories: DossierPresentationV1["whatMattersNow"]["stories"];
  investigations: DossierPresentationV1["watchNext"];
  stockRadar: DossierPresentationV1["stockRadar"];
  creatorVerification: unknown;
  sourceHealth: {
    dossier: "OK" | "DEGRADED";
    marketMonitor: "OK" | "PARTIAL" | "UNAVAILABLE";
    fredRates: "OK" | "PARTIAL";
    nyFedReferenceRates: NyFedReferenceRatesSnapshot["status"];
    nyFedPrimaryDealers: NyFedPrimaryDealerSnapshot["status"];
    treasuryBills: TreasuryBillSnapshot["status"];
    treasurySupply: "UNRESOLVED";
  };
  contradictions: Array<{
    id: string;
    title: string;
    detail: string;
    assets: string[];
  }>;
  researchGaps: string[];
  guardrails: string[];
};

function row(monitor: MarketMonitor, id: string) {
  return monitor.rows.find((item) => item.id === id) ?? null;
}

function bpMove(item: MarketMonitorRow | null) {
  const last = item?.last;
  const pct = item?.change5d;
  if (typeof last !== "number" || typeof pct !== "number" || pct <= -99.99) return null;
  const prior = last / (1 + pct / 100);
  return (last - prior) * 100;
}

function round(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function fmtPct(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function fmtBp(value: number | null) {
  return value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp`;
}

function directionFromRateState(
  state: DossierPresentationV1["rateRegime"]["state"],
): MonetarySignalDirection {
  if (state === "HAWKISH") return "TIGHTER";
  if (state === "DOVISH") return "EASIER";
  if (state === "NEUTRAL") return "NEUTRAL";
  if (state === "MIXED") return "MIXED";
  return "UNRESOLVED";
}

function confirmation(
  baseline: DossierPresentationV1["rateRegime"]["state"],
  direction: MonetarySignalDirection,
): CrossSignalConfirmation {
  if (direction === "UNRESOLVED" || direction === "NEUTRAL" || direction === "MIXED") return "UNRESOLVED";
  if (baseline === "HAWKISH") return direction === "TIGHTER" ? "CONFIRMING" : "CONTRADICTING";
  if (baseline === "DOVISH") return direction === "EASIER" ? "CONFIRMING" : "CONTRADICTING";
  return "UNRESOLVED";
}

function nyFedRate(snapshot: NyFedReferenceRatesSnapshot, type: "EFFR" | "SOFR" | "TGCR" | "BGCR") {
  return snapshot.rates.find((item) => item.type === type) ?? null;
}

function rateSignal(
  presentation: DossierPresentationV1,
  item: NonNullable<DossierPresentationV1["rateRegime"]["signals"]>[number],
): MarketIntelligenceSignal {
  const direction = directionFromRateState(item.state);
  return {
    key: `RATES_${item.key}`,
    label: item.label,
    direction,
    confirmation: confirmation(presentation.rateRegime.state, direction),
    detail: item.detail,
    asOf: presentation.rateRegime.asOf ?? presentation.asOf,
    sourceName: "Live deterministic rate regime",
    sourceUrl: null,
    evidenceRefs: [...item.evidenceRefs],
    metrics: { score: item.score },
  };
}

function fundingSignal(
  presentation: DossierPresentationV1,
  nyFed: NyFedReferenceRatesSnapshot,
): MarketIntelligenceSignal {
  const effr = nyFedRate(nyFed, "EFFR");
  const secured = ["SOFR", "TGCR", "BGCR"].map((type) => nyFedRate(nyFed, type as "SOFR" | "TGCR" | "BGCR")).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const sameDate = effr && secured.length
    ? secured.every((item) => item.effectiveDate === effr.effectiveDate)
    : false;
  const spread = effr && sameDate
    ? (secured.reduce((sum, item) => sum + item.percentRate, 0) / secured.length - effr.percentRate) * 100
    : null;
  let direction: MonetarySignalDirection = "UNRESOLVED";
  if (nyFed.status === "OK" && spread !== null) {
    direction = spread >= 8 ? "TIGHTER" : spread <= -8 ? "EASIER" : "NEUTRAL";
  }
  const volumes = secured.map((item) => `${item.type} $${item.volumeInBillions ?? "n/a"}bn`).join(", ");
  return {
    key: "FUNDING",
    label: "Secured funding / collateral",
    direction,
    confirmation: confirmation(presentation.rateRegime.state, direction),
    detail: effr && secured.length
      ? `EFFR ${fmtPct(effr.percentRate)}; SOFR/TGCR/BGCR average spread vs EFFR ${fmtBp(round(spread))}. Volumes: ${volumes}.`
      : "NY Fed EFFR/SOFR/TGCR/BGCR coverage is incomplete.",
    asOf: nyFed.asOf,
    sourceName: nyFed.sourceName,
    sourceUrl: nyFed.sourceUrl,
    evidenceRefs: [],
    metrics: {
      effr: effr?.percentRate ?? null,
      sofr: nyFedRate(nyFed, "SOFR")?.percentRate ?? null,
      tgcr: nyFedRate(nyFed, "TGCR")?.percentRate ?? null,
      bgcr: nyFedRate(nyFed, "BGCR")?.percentRate ?? null,
      securedVsEffrBps: round(spread),
      sofrVolumeBillions: nyFedRate(nyFed, "SOFR")?.volumeInBillions ?? null,
      tgcrVolumeBillions: nyFedRate(nyFed, "TGCR")?.volumeInBillions ?? null,
      bgcrVolumeBillions: nyFedRate(nyFed, "BGCR")?.volumeInBillions ?? null,
    },
  };
}

function billsSignal(
  presentation: DossierPresentationV1,
  monitor: MarketMonitor,
  nyFed: NyFedReferenceRatesSnapshot,
  treasuryBills: TreasuryBillSnapshot,
): MarketIntelligenceSignal {
  const treasury3m = treasuryBills.points.find((item) => item.tenor === "3M") ?? null;
  const treasury6m = treasuryBills.points.find((item) => item.tenor === "6M") ?? null;
  const fred3m = row(monitor, "us3m-bill");
  const fred6m = row(monitor, "us6m-bill");
  const bill3m = treasury3m?.yieldPercent ?? fred3m?.last ?? null;
  const bill6m = treasury6m?.yieldPercent ?? fred6m?.last ?? null;
  const effr = nyFedRate(nyFed, "EFFR")?.percentRate ?? row(monitor, "fed-funds-effective")?.last ?? null;
  const values = [bill3m, bill6m].filter((value): value is number => typeof value === "number");
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const spread = average !== null && effr !== null ? (average - effr) * 100 : null;
  let direction: MonetarySignalDirection = "UNRESOLVED";
  if (spread !== null) direction = spread >= 10 ? "TIGHTER" : spread <= -10 ? "EASIER" : "NEUTRAL";
  const sourceName = treasuryBills.points.length
    ? treasuryBills.sourceName
    : "Federal Reserve Economic Data";
  const sourceUrl = treasuryBills.points.length
    ? treasuryBills.sourceUrl
    : fred3m?.sourceUrl ?? fred6m?.sourceUrl ?? null;
  return {
    key: "BILLS",
    label: "Treasury bills / front-end cash",
    direction,
    confirmation: confirmation(presentation.rateRegime.state, direction),
    detail: average === null
      ? "3M/6M Treasury-bill yields are unavailable."
      : `3M ${fmtPct(bill3m)}; 6M ${fmtPct(bill6m)}; average vs EFFR ${fmtBp(round(spread))}.`,
    asOf: treasuryBills.asOf
      ?? [fred3m?.asOf, fred6m?.asOf].filter((value): value is string => Boolean(value)).sort().at(-1)
      ?? null,
    sourceName,
    sourceUrl,
    evidenceRefs: [],
    metrics: {
      bill3m,
      bill6m,
      effectiveFedFunds: effr,
      billsVsEffrBps: round(spread),
    },
  };
}

function creditSignal(
  presentation: DossierPresentationV1,
  monitor: MarketMonitor,
): MarketIntelligenceSignal {
  const hy = row(monitor, "hy-oas");
  const ig = row(monitor, "ig-oas");
  const hyMove = bpMove(hy);
  const igMove = bpMove(ig);
  let direction: MonetarySignalDirection = "UNRESOLVED";
  if (hyMove !== null || igMove !== null) {
    if ((hyMove ?? -Infinity) >= 15 || (igMove ?? -Infinity) >= 8) direction = "TIGHTER";
    else if ((hyMove ?? Infinity) <= -15 && (igMove === null || igMove <= -5)) direction = "EASIER";
    else direction = "NEUTRAL";
  }
  return {
    key: "CREDIT",
    label: "Credit spreads",
    direction,
    confirmation: confirmation(presentation.rateRegime.state, direction),
    detail: `HY OAS ${hy?.last ?? "n/a"} (5D ${fmtBp(round(hyMove))}); IG OAS ${ig?.last ?? "n/a"} (5D ${fmtBp(round(igMove))}).`,
    asOf: [hy?.asOf, ig?.asOf].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
    sourceName: "Federal Reserve Economic Data",
    sourceUrl: hy?.sourceUrl ?? ig?.sourceUrl ?? null,
    evidenceRefs: [],
    metrics: {
      hyOas: hy?.last ?? null,
      hyOas5dBps: round(hyMove),
      igOas: ig?.last ?? null,
      igOas5dBps: round(igMove),
    },
  };
}

function usdSignal(
  presentation: DossierPresentationV1,
  monitor: MarketMonitor,
): MarketIntelligenceSignal {
  const usd = row(monitor, "dxy");
  const change = usd?.change5d ?? null;
  let direction: MonetarySignalDirection = "UNRESOLVED";
  if (change !== null) direction = change >= 1 ? "TIGHTER" : change <= -1 ? "EASIER" : "NEUTRAL";
  return {
    key: "USD",
    label: "US dollar transmission",
    direction,
    confirmation: confirmation(presentation.rateRegime.state, direction),
    detail: usd ? `${usd.label} 5D ${change === null ? "n/a" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}.` : "USD market monitor is unavailable.",
    asOf: usd?.asOf ?? null,
    sourceName: usd?.sourceName ?? "Market monitor",
    sourceUrl: usd?.sourceUrl ?? null,
    evidenceRefs: [],
    metrics: { proxyLevel: usd?.last ?? null, change5dPct: change },
  };
}

function dealerSignal(
  presentation: DossierPresentationV1,
  dealers: NyFedPrimaryDealerSnapshot,
): MarketIntelligenceSignal {
  const position = dealers.series.find((item) => item.keyId === "PDPOSGST-TOT") ?? null;
  const failsDeliver = dealers.series.find((item) => item.keyId === "PDFTD-USTET") ?? null;
  const failsReceive = dealers.series.find((item) => item.keyId === "PDFTR-USTET") ?? null;
  const direction: MonetarySignalDirection = "UNRESOLVED";
  return {
    key: "DEALER_POSITIONING",
    label: "Primary-dealer balance sheet",
    direction,
    confirmation: confirmation(presentation.rateRegime.state, direction),
    detail: position?.valueMillions !== null && position?.valueMillions !== undefined
      ? `Treasury dealer net position ex-TIPS $${position.valueMillions.toLocaleString()}m; weekly change ${position.weeklyChangeMillions === null ? "n/a" : `$${position.weeklyChangeMillions.toLocaleString()}m`}. Fails to deliver ${failsDeliver?.valueMillions ?? "n/a"}m; fails to receive ${failsReceive?.valueMillions ?? "n/a"}m. Direction is not forced without a validated balance-sheet interpretation.`
      : "Primary-dealer Treasury positioning is unavailable; direction remains unresolved.",
    asOf: dealers.asOf,
    sourceName: dealers.sourceName,
    sourceUrl: dealers.sourceUrl,
    evidenceRefs: [],
    metrics: {
      treasuryNetPositionMillions: position?.valueMillions ?? null,
      treasuryNetPositionWeeklyChangeMillions: position?.weeklyChangeMillions ?? null,
      failsToDeliverMillions: failsDeliver?.valueMillions ?? null,
      failsToReceiveMillions: failsReceive?.valueMillions ?? null,
    },
  };
}

function treasurySupplySignal(
  presentation: DossierPresentationV1,
): MarketIntelligenceSignal {
  const direction: MonetarySignalDirection = "UNRESOLVED";
  return {
    key: "TREASURY_SUPPLY",
    label: "Treasury supply / auctions",
    direction,
    confirmation: confirmation(presentation.rateRegime.state, direction),
    detail: "Live has Treasury auction/supply research logic, but market-intelligence-snapshot/v1 does not yet normalize a current machine-readable supply impulse. Keep this unresolved rather than infer from yields.",
    asOf: presentation.asOf,
    sourceName: "Live Desk research state",
    sourceUrl: null,
    evidenceRefs: [],
    metrics: {},
  };
}

export function buildMarketIntelligenceSnapshot({
  status,
  presentation,
  monitor,
  nyFedReferenceRates,
  nyFedPrimaryDealers,
  treasuryBills,
  dailyAssetState = null,
  creatorVerification = null,
  generatedAt = new Date().toISOString(),
}: {
  status: string;
  presentation: DossierPresentationV1;
  monitor: MarketMonitor;
  nyFedReferenceRates: NyFedReferenceRatesSnapshot;
  nyFedPrimaryDealers: NyFedPrimaryDealerSnapshot;
  treasuryBills: TreasuryBillSnapshot;
  dailyAssetState?: unknown;
  creatorVerification?: unknown;
  generatedAt?: string;
}): MarketIntelligenceSnapshotV1 {
  const signals = [
    ...(presentation.rateRegime.signals ?? []).map((item) => rateSignal(presentation, item)),
    fundingSignal(presentation, nyFedReferenceRates),
    billsSignal(presentation, monitor, nyFedReferenceRates, treasuryBills),
    creditSignal(presentation, monitor),
    usdSignal(presentation, monitor),
    dealerSignal(presentation, nyFedPrimaryDealers),
    treasurySupplySignal(presentation),
  ];
  const confirming = signals.filter((item) => item.confirmation === "CONFIRMING").map((item) => item.key);
  const contradicting = signals.filter((item) => item.confirmation === "CONTRADICTING").map((item) => item.key);
  const unresolved = signals.filter((item) => item.confirmation === "UNRESOLVED").map((item) => item.key);
  const selectedIds = new Set([
    "us2y",
    "us10y-fred",
    "us10y-real",
    "us10y-breakeven",
    "fed-funds-effective",
    "us3m-bill",
    "us6m-bill",
    "hy-oas",
    "ig-oas",
    "dxy",
  ]);
  const selectedRows = monitor.rows
    .filter((item) => selectedIds.has(item.id))
    .map((item) => ({
      id: item.id,
      symbol: item.symbol,
      label: item.label,
      last: item.last,
      change5d: item.change5d,
      asOf: item.asOf,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
    }));

  const gaps = [
    ...presentation.health.researchGaps.map((item) => `${item.category}: ${item.description}`),
    ...(presentation.rateRegime.gaps ?? []),
    ...nyFedReferenceRates.warnings,
    ...nyFedPrimaryDealers.warnings,
    ...treasuryBills.warnings,
    "Treasury supply/auction state is not yet normalized into market-intelligence-snapshot/v1.",
  ];

  return {
    contractVersion: MARKET_INTELLIGENCE_SNAPSHOT_V1,
    generatedAt,
    source: "Alchemy Live Market Desk",
    dossier: {
      status,
      dossierId: presentation.dossierId,
      asOf: presentation.asOf,
      degraded: presentation.health.degraded,
    },
    regime: {
      headline: presentation.header.headline,
      answer: presentation.header.answer,
      regimeImplication: presentation.header.regimeImplication,
      regimeFamily: presentation.header.regimeFamily,
      whatWouldChangeMind: presentation.header.whatWouldChangeMind,
      rateRegime: structuredClone(presentation.rateRegime),
    },
    dollarLiquidity: structuredClone(presentation.dollarLiquidity ?? null),
    policyLiquidityInteraction: structuredClone(presentation.policyLiquidityInteraction ?? null),
    monetarySignals: {
      baseline: presentation.rateRegime.state,
      signals,
      confirming,
      contradicting,
      unresolved,
      summary: `Rate baseline ${presentation.rateRegime.state}; ${confirming.length} confirming, ${contradicting.length} contradicting, ${unresolved.length} unresolved/neutral monetary-market layers.`,
    },
    marketState: {
      lenses: structuredClone(presentation.regimeStrip),
      selectedRows,
      dailyAssetState: structuredClone(dailyAssetState),
    },
    stories: structuredClone(presentation.whatMattersNow.stories),
    investigations: structuredClone(presentation.watchNext),
    stockRadar: structuredClone(presentation.stockRadar),
    creatorVerification: structuredClone(creatorVerification),
    sourceHealth: {
      dossier: presentation.health.degraded ? "DEGRADED" : "OK",
      marketMonitor: !monitor.rows.length ? "UNAVAILABLE" : monitor.limitations.length ? "PARTIAL" : "OK",
      fredRates: presentation.rateRegime.fredBacked ? "OK" : "PARTIAL",
      nyFedReferenceRates: nyFedReferenceRates.status,
      nyFedPrimaryDealers: nyFedPrimaryDealers.status,
      treasuryBills: treasuryBills.status,
      treasurySupply: "UNRESOLVED",
    },
    contradictions: [
      ...monitor.contradictions.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        assets: [...item.assets],
      })),
      ...contradicting.map((key) => {
        const signal = signals.find((item) => item.key === key)!;
        return {
          id: `monetary:${key.toLowerCase()}`,
          title: `${signal.label} contradicts the current rate baseline`,
          detail: signal.detail,
          assets: [key],
        };
      }),
    ],
    researchGaps: [...new Set(gaps.filter(Boolean))],
    guardrails: [
      "This snapshot is a read-only Live canonical market-intelligence view for downstream consumers.",
      "Power Stack may map these signals to portfolio exposures but must not recompute or send Live-derived macro confirmation back to Live.",
      "UNRESOLVED is a valid state. Missing, stale or ambiguous data must not be coerced into a directional signal.",
      "Company fundamentals, valuation, portfolio construction and entry discipline remain Power Stack-owned.",
    ],
  };
}
