import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OIL_ORIGINAL_BUCKET, type ArchivedOriginalReceipt } from "../lib/research-gap-oil-private-archive.ts";
import {
  parseArchivedOilSettlementCsv,
  type ReviewedOilCsvProfile,
} from "../lib/research-gap-oil-csv-settlements.ts";

const ICE_URL = "https://www.ice.com/marketdata/20261014/settlements/brent.csv";
const RAW_ID = "59bd4da0-ab53-4ebd-99d1-7d00b48ddc2f";
const TEXT = [
  '"Trade Date","Contract","Settle","Status","Exchange","Units"',
  '"2026-10-14","LCOZ26","81.25","FINAL","ICE","USD_per_barrel"',
  '"2026-10-14","LCOF27","80.95","FINAL","ICE","USD_per_barrel"',
  '"2026-10-14","LCOG27","80.61","FINAL","ICE","USD_per_barrel"',
].join("\r\n") + "\r\n";

const PROFILE: ReviewedOilCsvProfile = {
  profileId: "test-ice-reviewed-format",
  reviewedAt: "2026-10-21T00:00:00Z",
  approved: true,
  benchmark: "BRENT", exchange: "ICE",
  columns: {
    tradeDate: "Trade Date", contract: "Contract",
    settlement: "Settle", settlementStatus: "Status",
    exchange: "Exchange", unit: "Units",
  },
  finalToken: "FINAL", exchangeToken: "ICE", unitToken: "USD_per_barrel",
};

function sha(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
function args(text = TEXT) {
  const sourceBytes = new TextEncoder().encode(text);
  const original: ArchivedOriginalReceipt = {
    bucket: OIL_ORIGINAL_BUCKET, objectPath: "ICE/2026-10-14/" + sha(sourceBytes) + ".csv",
    rawRecordId: RAW_ID, originalSha256: sha(sourceBytes),
    originalArchived: true, finalSettlementVerified: false, canonicalAdmitted: false,
  };
  return {
    benchmark: "BRENT" as const, sourceUrl: ICE_URL, sourceBytes, original,
    tradeDate: "2026-10-14", frontContract: "LCOZ26", nextContract: "LCOF27",
    profile: PROFILE,
  };
}

test("reviewed original exchange CSV yields a candidate, never canonical Evidence", () => {
  const candidate = parseArchivedOilSettlementCsv(args());
  assert.equal(candidate.status, "PARSED_UNADMITTED");
  assert.equal(candidate.benchmark, "BRENT");
  assert.equal(candidate.exchange, "ICE");
  assert.equal(candidate.tradeDate, "2026-10-14");
  assert.equal(candidate.frontContract, "LCOZ26");
  assert.equal(candidate.nextContract, "LCOF27");
  assert.equal(candidate.frontSettle, 81.25);
  assert.equal(candidate.nextSettle, 80.95);
  assert.ok(Math.abs(candidate.spreadUsdPerBarrel - 0.30) < 1e-8);
  assert.equal(candidate.originalSourceSha256, sha(args().sourceBytes));
  assert.equal(candidate.canonicalAdmitted, false);
  assert.equal(candidate.sourceArchived, true);
  assert.equal(candidate.rawRecordId, RAW_ID);
});

test("unreviewed profile or wrong exchange/header cannot interpret downloaded data", () => {
  const valid = args();
  const cases = [
    { profile: { ...PROFILE, approved: false } },
    { profile: { ...PROFILE, benchmark: "WTI" } },
    { profile: { ...PROFILE, exchange: "NYMEX" } },
    { profile: { ...PROFILE, columns: { ...PROFILE.columns, settlement: "Closing Price" } } },
    { profile: { ...PROFILE, finalToken: "" } },
    { sourceUrl: "https://www.ice.com/report-center" },
    { sourceUrl: "https://www.ice.com/marketdata/current/settlements/brent.csv" },
  ] as Record<string, unknown>[];
  for (const item of cases) {
    // Deliberately invalid operator-supplied profiles are a runtime input test.
    assert.throws(() => parseArchivedOilSettlementCsv({ ...valid, ...item } as typeof valid),
      /approved|eligible|CSV original|dated/i);
  }
});

test("raw archive byte hash is mandatory and source cannot be promoted by a forged manifest", () => {
  const a = args();
  assert.throws(() => parseArchivedOilSettlementCsv({
    ...a, original: { ...a.original, originalSha256: "a".repeat(64) },
  }), /hash-mismatched/);
  assert.throws(() => parseArchivedOilSettlementCsv({
    ...a, original: { ...a.original, rawRecordId: "gap-web:claimed-source" },
  }), /non-archived|hash-mismatched/);
  assert.throws(() => parseArchivedOilSettlementCsv({
    ...a, sourceBytes: new TextEncoder().encode("<html>Login required</html>"),
  }), /hash-mismatched/);
});

test("same-day next leg, FINAL, currency and duplicate rows all fail closed", () => {
  const edits = [
    TEXT.replace('"LCOF27","80.95"', '"LCOF27","N/A"'),
    TEXT.replace('"LCOF27","80.95"', '"LCOF27","-80.95"'),
    TEXT.replace('"LCOF27","80.95"', '"LCOF27","80.95 USD"'),
    TEXT.replace('"LCOF27","80.95","FINAL"', '"LCOF27","80.95","PRELIMINARY"'),
    TEXT.replace('"LCOF27","80.95","FINAL","ICE"', '"LCOF27","80.95","FINAL","CME"'),
    TEXT.replace('"LCOF27","80.95","FINAL","ICE","USD_per_barrel"',
      '"LCOF27","80.95","FINAL","ICE","cents_per_barrel"'),
    TEXT.replace('"2026-10-14","LCOF27"', '"2026-10-13","LCOF27"'),
    TEXT + '"2026-10-14","LCOF27","80.95","FINAL","ICE","USD_per_barrel"\n',
    TEXT.replace('"LCOF27","80.95","FINAL","ICE","USD_per_barrel"', ""),
    TEXT.replace(',"Settle",', ',"Settle","Settle",'),
    TEXT.replace(',"80.95","FINAL"', ',"80.95" "FINAL"'),
  ];
  for (const csv of edits) assert.throws(() => parseArchivedOilSettlementCsv(args(csv)));
  assert.throws(() => parseArchivedOilSettlementCsv({ ...args(), tradeDate: "2026-10-15" }), /date or contract/);
  assert.throws(() => parseArchivedOilSettlementCsv({ ...args(), nextContract: "LCOH27" }), /date or contract/);
  assert.throws(() => parseArchivedOilSettlementCsv({ ...args(), frontContract: "CLX26" }), /date or contract/);
});

test("CSV with embedded quoted commas cannot shift columns or be parsed as settlement", () => {
  const weird = TEXT.replace('"LCOZ26"', '"LCOZ,26"');
  assert.throws(() => parseArchivedOilSettlementCsv(args(weird)), /both requested/);
  assert.throws(() => parseArchivedOilSettlementCsv(args(TEXT.slice(0, -3) + '"')), /quoted|Malformed|row/);
});

test("parser is an isolated unadmitted candidate stage; never inserts Evidence or mutates Story", () => {
  const code = readFileSync(new URL("../lib/research-gap-oil-csv-settlements.ts", import.meta.url), "utf8");
  assert.doesNotMatch(code, /\.from\(["'](?:intelligence_evidence|story_thesis_versions)["']\)/);
  assert.doesNotMatch(code, /INSERT INTO/i);
  assert.match(code, /PARSED_UNADMITTED/);
  assert.match(code, /canonicalAdmitted: false/);
  assert.match(code, /consecutiveOilContractMonths/);
});
