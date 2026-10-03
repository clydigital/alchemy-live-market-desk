import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import { buildRateCurveDiagnostic } from "../lib/dossier-v2/rate-curve-diagnostic.ts";
import { buildRateGlobalDurationDiagnostic } from "../lib/dossier-v2/rate-global-duration-diagnostic.ts";
import { buildRateLongEndDiagnostic } from "../lib/dossier-v2/rate-long-end-diagnostic.ts";
import {
  buildRateCrossAssetTransmission,
  RATE_CROSS_ASSET_TRANSMISSION_VERSION,
} from "../lib/dossier-v2/rate-cross-asset-transmission.ts";

const AS_OF = "2026-10-03T08:00:00.000Z";

function market(
  id: string,
  last: number,
  prior: number,
  extraMetrics: Record<string, unknown> = {},
) {
  return {
    evidence_id: `market-monitor:${id}:2026-10-03`,
    claim_or_fact: `${id} was ${last}.`,
    category: "Market",
    source_type: "MARKET_DATA",
    available_at: AS_OF,
    occurrence_time: AS_OF,
    grouping_key: id === "hy-oas" || id === "ig-oas" ? "market-monitor:credit-oas" : `market-monitor:${id}`,
    metrics: {
      last,
      change_5d_pct: ((last / prior) - 1) * 100,
      frequency: "daily",
      ...extraMetrics,
    },
    provenance: [{ source_type: "TEST", source_id: `market-monitor:${id}` }],
  };
}

function jgb(input: {
  y10?: number;
  prior10?: number;
  y30?: number;
  prior30?: number;
} = {}) {
  const y10 = input.y10 ?? 3.00;
  const prior10 = input.prior10 ?? 2.98;
  const y30 = input.y30 ?? 3.40;
  const prior30 = input.prior30 ?? 3.38;
  return {
    evidence_id: "global-rates:jgb:2026-10-03",
    claim_or_fact: "Japan MOF JGB curve.",
    category: "Rates",
    source_type: "OFFICIAL_DATA",
    available_at: AS_OF,
    occurrence_time: AS_OF,
    grouping_key: "global-rates:jgb",
    metrics: {
      signal_kind: "global_rates",
      signal_context: "jgb_curve",
      jgb_2y_pct: 2.20,
      jgb_10y_pct: y10,
      jgb_30y_pct: y30,
      jgb_2y_change_5d_bp: 2,
      jgb_10y_change_5d_bp: (y10 - prior10) * 100,
      jgb_30y_change_5d_bp: (y30 - prior30) * 100,
      provider_status: "OK",
    },
    provenance: [{ source_type: "TEST", source_id: "jgb" }],
  };
}

function packet(input: {
  us10?: [number, number];
  real10?: [number, number];
  gold?: [number, number];
  dxy?: [number, number];
  hy?: [number, number];
  ig?: [number, number];
  spx?: [number, number];
  ndx?: [number, number];
  rsp?: [number, number];
  iwm?: [number, number];
  smh?: [number, number];
  usdjpy?: [number, number];
  jgb10?: [number, number];
} = {}) {
  const us10 = input.us10 ?? [5.20, 5.10];
  const real10 = input.real10 ?? [2.30, 2.20];
  const gold = input.gold ?? [100, 101.5];
  const dxy = input.dxy ?? [100.5, 100];
  const hy = input.hy ?? [3.20, 3.18];
  const ig = input.ig ?? [0.90, 0.89];
  const spx = input.spx ?? [101, 100];
  const ndx = input.ndx ?? [101.2, 100];
  const rsp = input.rsp ?? [100.8, 100];
  const iwm = input.iwm ?? [100.5, 100];
  const smh = input.smh ?? [101.5, 100];
  const usdjpy = input.usdjpy ?? [147, 145];
  const jgb10 = input.jgb10 ?? [3.00, 2.98];

  const observed = [
    market("us2y", 4.8, 4.8),
    market("us5y-fred", 4.95, 4.95),
    market("us10y", us10[0], us10[1]),
    market("us20y-fred", 5.55, 5.50),
    market("us30y-fred", 5.65, 5.60),
    market("us10y-real", real10[0], real10[1]),
    market("us10y-breakeven", 3.00, 3.00),
    market("gold", gold[0], gold[1]),
    market("dxy", dxy[0], dxy[1]),
    market("hy-oas", hy[0], hy[1], { spread_level_pct: hy[0] }),
    market("ig-oas", ig[0], ig[1], { spread_level_pct: ig[0] }),
    market("spx", spx[0], spx[1]),
    market("ndx", ndx[0], ndx[1]),
    market("rsp", rsp[0], rsp[1]),
    market("russell", iwm[0], iwm[1]),
    market("smh", smh[0], smh[1]),
    market("usdjpy", usdjpy[0], usdjpy[1]),
    jgb({ y10: jgb10[0], prior10: jgb10[1] }),
  ];

  const snapshot: CandidateSnapshot = {
    observed_evidence: observed,
    price_data: { status: "OK", available_at: AS_OF },
    macro_data: { status: "OK", available_at: AS_OF },
  };
  return assembleDossierV2InputPacket({ as_of: AS_OF }, snapshot);
}

function transmission(input: Parameters<typeof packet>[0] = {}) {
  const p = packet(input);
  const curve = buildRateCurveDiagnostic(p.observed_evidence, AS_OF);
  const longEnd = buildRateLongEndDiagnostic(p);
  const global = buildRateGlobalDurationDiagnostic(p, curve);
  return buildRateCrossAssetTransmission(p, longEnd, global);
}

test("high rates with contained credit and resilient equities are classified as contained, not systemic stress", () => {
  const result = transmission();

  assert.equal(result.contractVersion, RATE_CROSS_ASSET_TRANSMISSION_VERSION);
  assert.equal(result.ratePressure.restrictive, true);
  assert.equal(result.credit.state, "CONTAINED");
  assert.equal(result.equityDuration.state, "RESILIENT");
  assert.equal(result.state, "HIGH_RATES_CONTAINED");
});

test("rising real yields plus NDX underperformance can show valuation pressure without credit stress", () => {
  const result = transmission({
    ndx: [98, 100],
    rsp: [100.2, 100],
    spx: [99.6, 100],
    iwm: [100, 100],
    smh: [96.5, 100],
  });

  assert.equal(result.credit.state, "CONTAINED");
  assert.equal(result.equityDuration.state, "VALUATION_PRESSURE");
  assert.equal(result.state, "VALUATION_PRESSURE");
  assert.ok((result.equityDuration.ndxVsRsp5dPct ?? 0) < -1);
});

test("material HY or IG widening becomes credit stress even if rates remain restrictive", () => {
  const result = transmission({
    hy: [3.50, 3.20],
    ig: [1.00, 0.90],
  });

  assert.equal(result.credit.state, "STRESS");
  assert.equal(result.state, "CREDIT_STRESS");
  assert.ok((result.credit.hyOasChange5dBp ?? 0) >= 20);
  assert.ok((result.credit.igOasChange5dBp ?? 0) >= 8);
});

test("falling rates with widening credit and broad equity weakness classify growth-scare risk-off", () => {
  const result = transmission({
    us10: [5.05, 5.25],
    real10: [2.10, 2.25],
    hy: [3.50, 3.20],
    ig: [1.00, 0.90],
    spx: [97.5, 100],
    ndx: [97, 100],
    rsp: [97.2, 100],
    iwm: [96.5, 100],
    smh: [96, 100],
  });

  assert.equal(result.ratePressure.easingImpulse, true);
  assert.equal(result.credit.state, "STRESS");
  assert.equal(result.equityDuration.state, "BROAD_RISK_OFF");
  assert.equal(result.state, "GROWTH_SCARE_RISK_OFF");
});

test("real yields up while gold rises is a resilience divergence, not proof of a structural cause", () => {
  const result = transmission({
    gold: [102, 100],
    real10: [2.30, 2.20],
  });

  assert.equal(result.gold.state, "RESILIENT_DIVERGENCE");
  assert.match(result.gold.detail, /does not assign a structural gold-demand cause/i);
});

test("falling real yields with falling gold is a weak divergence rather than aligned relief", () => {
  const result = transmission({
    gold: [98, 100],
    real10: [2.10, 2.20],
  });

  assert.equal(result.gold.state, "WEAK_DIVERGENCE");
});

test("wider UST-JGB gap with stronger USDJPY is aligned USD carry evidence", () => {
  const result = transmission({
    us10: [5.30, 5.10],
    jgb10: [3.00, 2.98],
    usdjpy: [148, 145],
  });

  assert.equal(result.carry.state, "USD_CARRY_ALIGNED");
  assert.ok((result.carry.ustJgb10yGapChange5dBp ?? 0) >= 10);
  assert.ok((result.carry.usdJpyChange5dPct ?? 0) >= 1);
});

test("relative-rate and USDJPY signals pointing opposite ways are marked divergent", () => {
  const result = transmission({
    us10: [5.30, 5.10],
    jgb10: [3.00, 2.98],
    usdjpy: [143, 145],
  });

  assert.equal(result.carry.state, "DIVERGENT");
});

test("missing local transmission legs fail closed without fabricating stress", () => {
  const p = packet();
  p.observed_evidence = p.observed_evidence.filter((item) =>
    !item.evidence_id.startsWith("market-monitor:hy-oas:")
    && !item.evidence_id.startsWith("market-monitor:ig-oas:")
    && !item.evidence_id.startsWith("market-monitor:ndx:")
    && !item.evidence_id.startsWith("market-monitor:rsp:")
  );
  const curve = buildRateCurveDiagnostic(p.observed_evidence, AS_OF);
  const longEnd = buildRateLongEndDiagnostic(p);
  const global = buildRateGlobalDurationDiagnostic(p, curve);
  const result = buildRateCrossAssetTransmission(p, longEnd, global);

  assert.equal(result.credit.state, "UNRESOLVED");
  assert.ok(result.gaps.some((gap) => /HY\/IG/));
  assert.ok(result.gaps.some((gap) => /equity-duration/));
  assert.notEqual(result.state, "CREDIT_STRESS");
});
