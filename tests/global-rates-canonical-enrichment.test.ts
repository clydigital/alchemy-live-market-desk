import assert from "node:assert/strict";
import test from "node:test";

import {
  augmentCandidateSnapshotWithGlobalRatesEvidence,
  type CanonicalSnapshotResult,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import type { BundesbankBund10Snapshot } from "../lib/providers/bundesbank-bund10.ts";
import type { BoeGilt10Snapshot } from "../lib/providers/boe-gilt10.ts";
import type { JapanMofJgbSnapshot } from "../lib/providers/japan-mof-jgb-yields.ts";
import type { JapanMofWeeklySnapshot } from "../lib/providers/japan-mof-weekly-flows.ts";
import type { TreasuryTicSnapshot } from "../lib/providers/treasury-tic-holdings.ts";

const AS_OF = "2026-10-03T08:00:00.000Z";

function base(): CanonicalSnapshotResult {
  return {
    snapshot: {
      observed_evidence: [],
      research_leads: [],
      catalysts: [],
      price_data: { status: "OK", available_at: AS_OF },
      macro_data: { status: "OK", available_at: AS_OF },
      sources_status: {},
    },
    diagnostics: {
      rows_considered: 0,
      observed_count: 0,
      lead_count: 0,
      catalyst_count: 0,
      skipped_future_count: 0,
      skipped_expired_scheduled_count: 0,
      latest_available_at: null,
      price_data_status: "OK",
      macro_data_status: "OK",
    },
  };
}

test("global-rates enrichment admits JGB, TIC and MOF weekly flow as separate official evidence", () => {
  const jgb: JapanMofJgbSnapshot = {
    status: "OK",
    fetchedAt: AS_OF,
    asOf: "2026-10-01",
    sourceName: "Japan Ministry of Finance",
    sourceUrls: ["history", "current"],
    latest: { date: "2026-10-01", y2: 2.2, y10: 3, y30: 3.4 },
    previous5: { date: "2026-09-24", y2: 2.1, y10: 2.9, y30: 3.3 },
    changes5dBp: { y2: 10, y10: 10, y30: 10 },
    warnings: [],
  };
  const tic: TreasuryTicSnapshot = {
    status: "OK",
    fetchedAt: AS_OF,
    latestPeriod: "2026-07",
    previousPeriod: "2026-06",
    sourceName: "U.S. Department of the Treasury · Treasury International Capital",
    sourceUrl: "https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt",
    countries: [
      { country: "Japan", latestUsdBn: 1103.9, previousUsdBn: 1116.7, monthlyChangeUsdBn: -12.8 },
      { country: "Grand Total", latestUsdBn: 9500, previousUsdBn: 9400, monthlyChangeUsdBn: 100 },
      { country: "Of Which: Foreign Official", latestUsdBn: 3900, previousUsdBn: 3880, monthlyChangeUsdBn: 20 },
    ],
    custodyAttributionCaveat: "Custody location may not equal beneficial owner.",
    warnings: [],
  };
  const flows: JapanMofWeeklySnapshot = {
    state: "ready",
    retrievedAt: AS_OF,
    rows: [],
    latest: {
      periodLabel: "2026/09/20-2026/09/26",
      inferredGregorianYear: 2026,
      outwardSignConvention: "net_purchase_positive",
      outwardEquityNetJpyBn: 10,
      outwardLongTermDebtNetJpyBn: 420,
      outwardShortTermDebtNetJpyBn: 20,
      outwardTotalNetJpyBn: 450,
      outwardEquityNetPurchaseJpyBn: 10,
      outwardLongTermDebtNetPurchaseJpyBn: 420,
      outwardShortTermDebtNetPurchaseJpyBn: 20,
      outwardTotalNetPurchaseJpyBn: 450,
      inwardEquityNetJpyBn: 5,
      inwardLongTermDebtNetJpyBn: 10,
      inwardShortTermDebtNetJpyBn: 2,
      inwardTotalNetJpyBn: 17,
    },
    sourceName: "Japan Ministry of Finance",
    sourceUrl: "https://www.mof.go.jp/policy/international_policy/reference/itn_transactions_in_securities/week.csv",
    sourceUnit: "JPY 100 million",
    canonicalUnit: "JPY bn",
    note: "Weekly foreign securities transactions; not Treasury-specific.",
  };

  const result = augmentCandidateSnapshotWithGlobalRatesEvidence(
    base(),
    jgb,
    tic,
    flows,
    { asOf: AS_OF },
  );
  const evidence = result.snapshot.observed_evidence ?? [];

  assert.equal(evidence.length, 3);
  const flow = evidence.find((item) => item.grouping_key === "global-rates:japan-mof-flows");
  const flowMetrics = flow?.metrics as Record<string, unknown>;
  assert.equal(flowMetrics.treasury_specific, false);

  const ticEvidence = evidence.find((item) => item.grouping_key === "global-rates:tic");
  const ticMetrics = ticEvidence?.metrics as Record<string, unknown>;
  assert.equal(ticMetrics.japan_monthly_change_usd_bn, -12.8);
  assert.match(String(ticMetrics.custody_attribution_caveat), /beneficial owner/i);

  const jgbEvidence = evidence.find((item) => item.grouping_key === "global-rates:jgb");
  const jgbMetrics = jgbEvidence?.metrics as Record<string, unknown>;
  assert.equal(jgbMetrics.jgb_10y_pct, 3);
  assert.equal(jgbMetrics.jgb_10y_change_5d_bp, 10);
});


test("global-rates enrichment admits official Bund and gilt observations as separate comparable evidence", () => {
  const jgb: JapanMofJgbSnapshot = {
    status: "OK",
    fetchedAt: AS_OF,
    asOf: "2026-10-01",
    sourceName: "Japan Ministry of Finance",
    sourceUrls: ["history", "current"],
    latest: { date: "2026-10-01", y2: 2.2, y10: 3, y30: 3.4 },
    previous5: { date: "2026-09-24", y2: 2.1, y10: 2.9, y30: 3.3 },
    changes5dBp: { y2: 10, y10: 10, y30: 10 },
    warnings: [],
  };
  const tic: TreasuryTicSnapshot = {
    status: "OK",
    fetchedAt: AS_OF,
    latestPeriod: "2026-07",
    previousPeriod: "2026-06",
    sourceName: "U.S. Department of the Treasury · Treasury International Capital",
    sourceUrl: "https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt",
    countries: [{ country: "Japan", latestUsdBn: 1103.9, previousUsdBn: 1116.7, monthlyChangeUsdBn: -12.8 }],
    custodyAttributionCaveat: "Custody location may not equal beneficial owner.",
    warnings: [],
  };
  const flows: JapanMofWeeklySnapshot = {
    state: "unavailable",
    retrievedAt: AS_OF,
    rows: [],
    latest: null,
    sourceName: "Japan Ministry of Finance",
    sourceUrl: "https://www.mof.go.jp/policy/international_policy/reference/itn_transactions_in_securities/week.csv",
    sourceUnit: "JPY 100 million",
    canonicalUnit: "JPY bn",
    note: "Unavailable in fixture.",
  };
  const bund: BundesbankBund10Snapshot = {
    status: "OK",
    fetchedAt: AS_OF,
    sourceName: "Deutsche Bundesbank",
    sourceUrl: "https://api.statistiken.bundesbank.de/rest/data/BBSSY/D.REN.EUR.A630.000000WT1010.A?format=text_csv&lang=en&detail=dataonly&lastNObservations=6",
    series: "BBSSY.D.REN.EUR.A630.000000WT1010.A",
    latest: { date: "2026-10-01", yieldPct: 3.8 },
    previous5: { date: "2026-09-24", yieldPct: 3.72 },
    change5dBp: 8,
    warnings: [],
  };
  const gilt: BoeGilt10Snapshot = {
    status: "OK",
    fetchedAt: AS_OF,
    sourceName: "Bank of England",
    sourceUrl: "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes",
    series: "IUDMNPY",
    latest: { date: "2026-10-01", yieldPct: 5.1 },
    previous5: { date: "2026-09-24", yieldPct: 5.03 },
    change5dBp: 7,
    warnings: [],
  };

  const result = augmentCandidateSnapshotWithGlobalRatesEvidence(
    base(),
    jgb,
    tic,
    flows,
    { asOf: AS_OF },
    bund,
    gilt,
  );
  const evidence = result.snapshot.observed_evidence ?? [];
  const bundEvidence = evidence.find((item) => item.grouping_key === "global-rates:bund");
  const giltEvidence = evidence.find((item) => item.grouping_key === "global-rates:gilt");

  assert.ok(bundEvidence);
  assert.ok(giltEvidence);
  assert.equal((bundEvidence?.metrics as Record<string, unknown>).signal_context, "bund_10y");
  assert.equal((bundEvidence?.metrics as Record<string, unknown>).change_5d_bp, 8);
  assert.equal((giltEvidence?.metrics as Record<string, unknown>).signal_context, "gilt_10y");
  assert.equal((giltEvidence?.metrics as Record<string, unknown>).change_5d_bp, 7);
});
