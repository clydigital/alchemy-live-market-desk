import assert from "node:assert/strict";
import test from "node:test";
import { verifiedOilFrontEligibility, type OilExpiryOriginal } from "../lib/oil-futures-front-eligibility.ts";

const HASH = "b".repeat(64);
const ID = "891fd481-0409-47bc-aa90-d61fb440c212";
const CAPTURED = "2026-10-20T12:00:00Z";
const AVAILABLE = "2026-10-21T00:00:00Z";

function original(benchmark: "WTI" | "BRENT"): OilExpiryOriginal {
  const wti = benchmark === "WTI";
  const provider = wti ? "CME" : "ICE";
  const url = wti
    ? "https://www.cmegroup.com/rulebook/NYMEX/2/200.pdf"
    : "https://www.ice.com/products/219/brent-crude-futures/expiry";
  return {
    id: ID, provider: "OIL_EXPIRY_ORIGINAL", source_url: url,
    content_hash: HASH, content_type: wti ? "application/pdf" : "text/html",
    payload: {
      contractVersion: "oil-expiry-original-archive/1",
      benchmark, provider, fullMonthlyListing: true,
      extractorProfileApproved: true, archiveVerified: true,
      originalSourceSha256: HASH, sourceUrl: url, capturedAt: CAPTURED,
      archiveBucket: "alchemy-oil-originals-private",
      archivePath: "EXPIRY/" + provider + "/" + HASH + (wti ? ".pdf" : ".html"),
      // Synthetic expiry calendars. No actual exchange settlement values
      // or archive rows are created by these tests.
      expiries: wti ? [
        { contract: "CLV26", lastTradeDate: "2026-09-22" },
        { contract: "CLX26", lastTradeDate: "2026-10-20" },
        { contract: "CLZ26", lastTradeDate: "2026-11-20" },
        { contract: "CLF27", lastTradeDate: "2026-12-21" },
      ] : [
        { contract: "LCOX26", lastTradeDate: "2026-09-30" },
        { contract: "LCOZ26", lastTradeDate: "2026-10-30" },
        { contract: "LCOF27", lastTradeDate: "2026-11-30" },
        { contract: "LCOG27", lastTradeDate: "2026-12-30" },
      ],
    },
  };
}
function qualify(
  benchmark: "WTI" | "BRENT", front: string, next: string, changes: Record<string, unknown> = {},
): boolean {
  return verifiedOilFrontEligibility({
    benchmark, tradeDate: "2026-10-14", frontContract: front, nextContract: next,
    expiryRawRecordId: ID, expiryOriginal: original(benchmark), availableAt: AVAILABLE,
    ...changes,
  });
}

test("verified original exchange expiry records establish actual front TWO eligible contracts", () => {
  assert.equal(qualify("WTI", "CLX26", "CLZ26"), true);
  assert.equal(qualify("BRENT", "LCOZ26", "LCOF27"), true);
  assert.equal(qualify("WTI", "CLZ26", "CLF27"), false,
    "Adjacent WTI December/January prices were not October 14 F1/F2");
  assert.equal(qualify("BRENT", "LCOF27", "LCOG27"), false,
    "Adjacent Brent January/February prices were not October 14 F1/F2");
  assert.equal(qualify("BRENT", "LCOX26", "LCOZ26"), false,
    "Expired November Brent cannot be front month on October 14");
});

test("missing or fabricated original exchange expiry archive never suffices", () => {
  assert.equal(qualify("WTI", "CLX26", "CLZ26", { expiryOriginal: null }), false);
  assert.equal(qualify("WTI", "CLX26", "CLZ26", { expiryRawRecordId: "gap-web:source" }), false);
  assert.equal(qualify("WTI", "CLX26", "CLZ26", { expiryOriginal: { ...original("WTI"), provider: "SEARCH_RESULT" } }), false);
  const raw = original("WTI");
  const edits = [
    { content_hash: "a".repeat(64) },
    { source_url: "https://cmegroup.com.evil.test/futures.pdf" },
    { content_type: "application/json" },
    { payload: { ...raw.payload, archiveVerified: false } },
    { payload: { ...raw.payload, fullMonthlyListing: false } },
    { payload: { ...raw.payload, extractorProfileApproved: false } },
    { payload: { ...raw.payload, expiries: [] } },
    { payload: { ...raw.payload, sourceUrl: "https://example.org" } },
    { payload: { ...raw.payload, archiveBucket: "public" } },
    { payload: { ...raw.payload, originalSourceSha256: "0".repeat(64) } },
    { payload: { ...raw.payload, capturedAt: "2026-10-22T00:00:00Z" } },
    { payload: { ...raw.payload, capturedAt: "2026-10-13T00:00:00Z" } },
  ];
  for (const change of edits) {
    assert.equal(qualify("WTI", "CLX26", "CLZ26",
      { expiryOriginal: { ...raw, ...change } }), false, JSON.stringify(change).slice(0,200));
  }
});

test("futures expiry archive must include the prior contract, not merely two convenient prices", () => {
  const raw = original("BRENT");
  const rows = raw.payload?.expiries as Array<{ contract: string; lastTradeDate: string }>;
  assert.equal(qualify("BRENT", "LCOZ26", "LCOF27", {
    expiryOriginal: { ...raw, payload: { ...raw.payload, expiries: rows.filter(x => x.contract !== "LCOX26") } },
  }), false);
  assert.equal(qualify("BRENT", "LCOZ26", "LCOF27", {
    expiryOriginal: { ...raw, payload: { ...raw.payload, expiries: rows.map(x =>
      x.contract === "LCOX26" ? { ...x, lastTradeDate: "2026-10-20" } : x) } },
  }), false);
  assert.equal(qualify("BRENT", "LCOZ26", "LCOF27", {
    expiryOriginal: { ...raw, payload: { ...raw.payload, expiries: rows.concat(rows[1]) } },
  }), false);
});

test("calendar observations do not become available before capture, and malformed days fail closed", () => {
  assert.equal(qualify("WTI", "CLX26", "CLZ26", { availableAt: "2026-10-19T00:00:00Z" }), false);
  assert.equal(qualify("WTI", "CLX26", "CLZ26", { tradeDate: "2026-10-32" }), false);
  assert.equal(qualify("WTI", "CLX26", "CLZ26", { tradeDate: "2026-10-19" }), true);
  assert.equal(qualify("WTI", "CLX26", "CLZ26", { tradeDate: "2026-10-21" }), false);
});
