import assert from "node:assert/strict";
import test from "node:test";

import {
  augmentCandidateSnapshotWithTreasuryAuctions,
  type CanonicalSnapshotResult,
} from "../lib/dossier-v2/canonical-snapshot.ts";
import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";
import { buildRateLongEndDiagnostic } from "../lib/dossier-v2/rate-long-end-diagnostic.ts";
import {
  fetchTreasuryAuctions,
  parseTreasuryAuctionSnapshot,
  treasuryAuctionQueryUrl,
} from "../lib/providers/treasury-auctions.ts";

const NOW = new Date("2026-10-04T00:00:00.000Z");

function row(overrides: Record<string, string | null> = {}) {
  return {
    cusip: "91282CZZ1",
    security_type: "Note",
    security_term: "10-Year",
    original_security_term: "10-Year",
    announcement_date: "2026-09-23",
    auction_date: "2026-09-30",
    issue_date: "2026-10-05",
    maturity_date: "2036-09-30",
    high_yield: "5.125",
    bid_to_cover_ratio: "2.42",
    offering_amt: "42000000000",
    comp_accepted: "40000000000",
    primary_dealer_accepted: "5000000000",
    direct_bidder_accepted: "10000000000",
    indirect_bidder_accepted: "25000000000",
    inflation_index_security: "No",
    floating_rate: "No",
    ...overrides,
  };
}

function baseResult(): CanonicalSnapshotResult {
  return {
    snapshot: {
      observed_evidence: [],
      price_data: { status: "OK", available_at: NOW.toISOString() },
      macro_data: { status: "OK", available_at: NOW.toISOString() },
    } as CandidateSnapshot,
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

test("Treasury auction adapter keeps the latest nominal coupon result per maturity", () => {
  const snapshot = parseTreasuryAuctionSnapshot({
    data: [
      row(),
      row({ cusip: "91282CYY2", auction_date: "2026-08-31", high_yield: "4.990" }),
      row({
        cusip: "912810ZZ3",
        security_type: "Bond",
        security_term: "30-Year",
        original_security_term: "30-Year",
        auction_date: "2026-09-24",
        high_yield: "5.410",
        bid_to_cover_ratio: "2.31",
      }),
      row({
        cusip: "912797ZZ4",
        security_type: "Bill",
        security_term: "13-Week",
        original_security_term: "13-Week",
      }),
      row({
        cusip: "91282CZZ5",
        security_type: "Note",
        security_term: "10-Year",
        original_security_term: "10-Year",
        inflation_index_security: "Yes",
      }),
    ],
  }, NOW);

  assert.equal(snapshot.status, "PARTIAL");
  assert.deepEqual(snapshot.auctions.map((item) => item.securityTerm), ["10-Year", "30-Year"]);
  assert.equal(snapshot.auctions[0].highYieldPct, 5.125);
  assert.equal(snapshot.auctions[0].bidToCover, 2.42);
  assert.equal(snapshot.auctions[0].primaryDealerAcceptedPct, 12.5);
  assert.equal(snapshot.auctions[0].directBidderAcceptedPct, 25);
  assert.equal(snapshot.auctions[0].indirectBidderAcceptedPct, 62.5);
});

test("Treasury auction query is keyless, bounded and requests official result fields", () => {
  const url = treasuryAuctionQueryUrl(NOW);
  assert.match(url, /^https:\/\/api\.fiscaldata\.treasury\.gov\/services\/api\/fiscal_service\/v1\/accounting\/od\/auctions_query\?/);
  assert.match(decodeURIComponent(url), /auction_date:gte:2026-06-06,auction_date:lte:2026-11-18/);
  assert.match(decodeURIComponent(url), /announcement_date/);
  assert.match(decodeURIComponent(url), /bid_to_cover_ratio/);
  assert.match(decodeURIComponent(url), /primary_dealer_accepted/);
  assert.match(decodeURIComponent(url), /comp_accepted/);
  assert.match(decodeURIComponent(url), /page\[size\]=500/);
});

test("snapshot augmentation admits official auction facts without inventing a tail", () => {
  const auctionSnapshot = parseTreasuryAuctionSnapshot({
    data: [
      row(),
      row({
        cusip: "912810ZZ3",
        security_type: "Bond",
        security_term: "30-Year",
        original_security_term: "30-Year",
        auction_date: "2026-09-24",
        high_yield: "5.410",
        bid_to_cover_ratio: "2.31",
      }),
      row({
        cusip: "91282CXX6",
        security_type: "Note",
        security_term: "5-Year",
        original_security_term: "5-Year",
        auction_date: "2026-09-23",
        high_yield: "4.985",
        bid_to_cover_ratio: "2.55",
      }),
    ],
  }, NOW);

  const result = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    auctionSnapshot,
    { asOf: NOW.toISOString() },
  );
  const evidence = result.snapshot.observed_evidence ?? [];

  assert.equal(evidence.length, 3);
  const tenYear = evidence.find((item) => item.evidence_id === "treasury-auction:91282CZZ1:2026-09-30");
  assert.ok(tenYear);
  const tenYearMetrics = (tenYear?.metrics ?? {}) as Record<string, unknown>;
  assert.equal(tenYear?.source_type, "OFFICIAL_DATA");
  assert.equal(tenYear?.available_at, "2026-09-30T21:00:00.000Z");
  assert.equal(tenYearMetrics.signal_context, "treasury_auction");
  assert.equal(tenYearMetrics.tail_bps, null);
  assert.equal(tenYearMetrics.when_issued_yield_pct, null);
  assert.match(String(tenYear?.claim_or_fact ?? ""), /tail or stop-through is not determined/i);
  assert.equal(result.snapshot.sources_status?.treasury_auctions?.status, "OK");
});

test("same-day auction rows remain unavailable before the conservative results boundary", () => {
  const sameDay = parseTreasuryAuctionSnapshot({
    data: [row({ auction_date: "2026-10-04" })],
  }, NOW);

  const beforeBoundary = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    sameDay,
    { asOf: "2026-10-04T19:00:00.000Z" },
  );
  assert.equal(beforeBoundary.snapshot.observed_evidence?.length, 0);

  const afterBoundary = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    sameDay,
    { asOf: "2026-10-04T22:00:00.000Z" },
  );
  assert.equal(afterBoundary.snapshot.observed_evidence?.length, 1);
});

test("official auction evidence survives packet assembly and reaches long-end review without a deterministic stress verdict", () => {
  const auctionSnapshot = parseTreasuryAuctionSnapshot({
    data: [
      row(),
      row({
        cusip: "912810ZZ3",
        security_type: "Bond",
        security_term: "30-Year",
        original_security_term: "30-Year",
        auction_date: "2026-09-24",
      }),
      row({
        cusip: "91282CXX6",
        security_type: "Note",
        security_term: "5-Year",
        original_security_term: "5-Year",
        auction_date: "2026-09-23",
      }),
    ],
  }, NOW);
  const augmented = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    auctionSnapshot,
    { asOf: NOW.toISOString() },
  );
  const packet = assembleDossierV2InputPacket(
    { as_of: NOW.toISOString() },
    augmented.snapshot,
  );

  assert.ok(packet.rate_context?.evidence.some((item) =>
    item.evidence_id === "treasury-auction:91282CZZ1:2026-09-30"
  ));
  assert.equal(
    packet.observed_evidence.some((item) =>
      item.evidence_id === "treasury-auction:91282CZZ1:2026-09-30"
    ),
    false,
    "older auction context must not masquerade as fresh observed evidence",
  );
  const diagnostic = buildRateLongEndDiagnostic(packet);
  assert.equal(diagnostic.marketStructure.auctionEvidenceRef, "treasury-auction:91282CZZ1:2026-09-30");
  assert.match(diagnostic.marketStructure.detail, /System 2 review/);
});

test("official announced coupon sizes create governed supply context without inventing yield direction", () => {
  const snapshot = parseTreasuryAuctionSnapshot({
    data: [
      row({
        cusip: "91282C10N",
        security_term: "10-Year",
        original_security_term: "10-Year",
        announcement_date: "2026-10-01",
        auction_date: "2026-10-08",
        offering_amt: "43000000000",
        high_yield: null,
        bid_to_cover_ratio: null,
        comp_accepted: null,
        primary_dealer_accepted: null,
        direct_bidder_accepted: null,
        indirect_bidder_accepted: null,
      }),
      row({
        cusip: "91282C10P",
        security_term: "10-Year",
        original_security_term: "10-Year",
        announcement_date: "2026-09-03",
        auction_date: "2026-09-10",
        offering_amt: "39000000000",
      }),
      row({
        cusip: "91281020N",
        security_type: "Bond",
        security_term: "20-Year",
        original_security_term: "20-Year",
        announcement_date: "2026-10-01",
        auction_date: "2026-10-21",
        offering_amt: "17000000000",
        high_yield: null,
        bid_to_cover_ratio: null,
        comp_accepted: null,
        primary_dealer_accepted: null,
        direct_bidder_accepted: null,
        indirect_bidder_accepted: null,
      }),
      row({
        cusip: "91281020P",
        security_type: "Bond",
        security_term: "20-Year",
        original_security_term: "20-Year",
        announcement_date: "2026-09-10",
        auction_date: "2026-09-17",
        offering_amt: "13000000000",
      }),
      row({
        cusip: "91281030N",
        security_type: "Bond",
        security_term: "30-Year",
        original_security_term: "30-Year",
        announcement_date: "2026-10-01",
        auction_date: "2026-10-15",
        offering_amt: "26000000000",
        high_yield: null,
        bid_to_cover_ratio: null,
        comp_accepted: null,
        primary_dealer_accepted: null,
        direct_bidder_accepted: null,
        indirect_bidder_accepted: null,
      }),
      row({
        cusip: "91281030P",
        security_type: "Bond",
        security_term: "30-Year",
        original_security_term: "30-Year",
        announcement_date: "2026-09-03",
        auction_date: "2026-09-10",
        offering_amt: "22000000000",
      }),
    ],
  }, NOW);

  assert.equal(snapshot.couponSupply.status, "OK");
  assert.equal(snapshot.couponSupply.asOf, "2026-10-01");
  assert.equal(snapshot.couponSupply.comparisons.length, 3);
  assert.equal(
    snapshot.couponSupply.comparisons.find((item) => item.securityTerm === "10-Year")?.changeUsd,
    4_000_000_000,
  );

  const augmented = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    snapshot,
    { asOf: "2026-10-04T22:00:00.000Z" },
  );
  const supply = augmented.snapshot.observed_evidence?.find((item) =>
    item.evidence_id === "treasury-supply:coupon-sizes:2026-10-01"
  );
  assert.ok(supply);
  const metrics = (supply?.metrics ?? {}) as Record<string, unknown>;
  assert.equal(supply?.source_type, "OFFICIAL_DATA");
  assert.equal(metrics.signal_context, "treasury_supply");
  assert.equal(metrics.supply_measure, "announced_nominal_coupon_offering_sizes");
  assert.equal(metrics.observed_value, 86);
  assert.equal(metrics.previous_value, 74);
  assert.equal(metrics.long_end_change_usd_bn, 12);
  assert.match(String(supply?.claim_or_fact ?? ""), /does not by itself establish net borrowing/i);

  const packet = assembleDossierV2InputPacket(
    { as_of: "2026-10-04T22:00:00.000Z" },
    augmented.snapshot,
  );
  assert.ok(packet.rate_context?.evidence.some((item) =>
    item.evidence_id === "treasury-supply:coupon-sizes:2026-10-01"
  ));
  assert.equal(
    packet.observed_evidence.some((item) =>
      item.evidence_id === "treasury-supply:coupon-sizes:2026-10-01"
    ),
    false,
    "older supply context must remain protected rate memory rather than fresh news",
  );
  const diagnostic = buildRateLongEndDiagnostic(packet);
  assert.equal(
    diagnostic.marketStructure.treasurySupplyEvidenceRef,
    "treasury-supply:coupon-sizes:2026-10-01",
  );
});

test("same-day announced supply remains unavailable before the conservative announcement boundary", () => {
  const snapshot = parseTreasuryAuctionSnapshot({
    data: [
      row({
        cusip: "91282CSAME",
        announcement_date: "2026-10-04",
        auction_date: "2026-10-08",
        offering_amt: "43000000000",
        high_yield: null,
        bid_to_cover_ratio: null,
      }),
      row({
        cusip: "91282CPREV",
        announcement_date: "2026-09-03",
        auction_date: "2026-09-10",
        offering_amt: "39000000000",
      }),
    ],
  }, NOW);

  const before = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    snapshot,
    { asOf: "2026-10-04T19:00:00.000Z" },
  );
  assert.equal(
    before.snapshot.observed_evidence?.some((item) => item.evidence_id.startsWith("treasury-supply:")),
    false,
  );

  const after = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    snapshot,
    { asOf: "2026-10-04T22:00:00.000Z" },
  );
  assert.equal(
    after.snapshot.observed_evidence?.some((item) => item.evidence_id === "treasury-supply:coupon-sizes:2026-10-04"),
    true,
  );
});

test("Treasury auction acquisition fails closed", async () => {
  const snapshot = await fetchTreasuryAuctions(NOW, async () => new Response("down", { status: 503 }));
  assert.equal(snapshot.status, "UNAVAILABLE");
  assert.equal(snapshot.auctions.length, 0);
  assert.match(snapshot.warnings[0] ?? "", /HTTP 503/);
});


test("Treasury auction context expires from protected rate memory after 45 days", () => {
  const oldAuction = parseTreasuryAuctionSnapshot({
    data: [
      row({ auction_date: "2026-08-01" }),
      row({
        cusip: "912810OLD",
        security_type: "Bond",
        security_term: "30-Year",
        original_security_term: "30-Year",
        auction_date: "2026-08-01",
      }),
      row({
        cusip: "91282COLD",
        security_type: "Note",
        security_term: "5-Year",
        original_security_term: "5-Year",
        auction_date: "2026-08-01",
      }),
    ],
  }, new Date("2026-08-02T00:00:00.000Z"));

  const augmented = augmentCandidateSnapshotWithTreasuryAuctions(
    baseResult(),
    oldAuction,
    { asOf: "2026-10-04T00:00:00.000Z" },
  );
  const packet = assembleDossierV2InputPacket(
    { as_of: "2026-10-04T00:00:00.000Z" },
    augmented.snapshot,
  );

  assert.equal(
    packet.rate_context?.evidence.some((item) => item.evidence_id.startsWith("treasury-auction:")),
    false,
  );
  assert.equal(
    packet.observed_evidence.some((item) => item.evidence_id.startsWith("treasury-auction:")),
    false,
  );
});
