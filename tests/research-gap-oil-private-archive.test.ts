import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  OIL_ORIGINAL_BUCKET, persistCapturedOilOriginal,
  type OilOriginalArchiveStore,
} from "../lib/research-gap-oil-private-archive.ts";

const CME = "https://www.cmegroup.com/daily_bulletin/archive/20261014/Section61_Energy_Futures_Products.pdf";
const ICE = "https://www.ice.com/marketdata/20261014/settlements/brent.csv";
const PDF = new TextEncoder().encode("%PDF-1.7\nA synthetic original-file test document.");
const CSV = new TextEncoder().encode("date,symbol,settle\n2026-10-14,LCOZ26,80.33\n");
const collectedAt = "2026-10-21T04:30:00.000Z";
function hash(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }

function fixture() {
  const objects = new Map<string, Uint8Array>();
  const rows = new Map<string, string>();
  let writes = 0;
  let bucketCalls = 0;
  let readbacks = 0;
  const store: OilOriginalArchiveStore = {
    async ensurePrivateBucket(bucket) {
      bucketCalls++;
      assert.equal(bucket, OIL_ORIGINAL_BUCKET);
    },
    async uploadOnce(bucket, path, bytes, contentType) {
      writes++;
      assert.equal(bucket, OIL_ORIGINAL_BUCKET);
      assert.match(path, /^CME\/2026-10-14\/[a-f0-9]{64}\.pdf$|^ICE\/2026-10-14\/[a-f0-9]{64}\.csv$/);
      assert.ok(contentType === "application/pdf" || contentType === "text/csv");
      const key = bucket + "/" + path;
      if (!objects.has(key)) objects.set(key, bytes.slice());
    },
    async readObject(bucket, path) {
      readbacks++;
      const b = objects.get(bucket + "/" + path);
      if (!b) throw new Error("missing");
      return b.slice();
    },
    async findRaw(source, digest) { return rows.get(source + "\n" + digest) ?? null; },
    async appendRaw(input) {
      assert.equal(input.payload.archiveVerified, true);
      assert.equal(input.payload.canonicalAdmitted, false);
      assert.equal(input.payload.finalSettlementVerified, false);
      assert.equal(input.sha256, input.payload.originalSourceSha256);
      assert.equal(input.observedAt, collectedAt);
      const id = "4e25cf98-b21a-4e18-91c3-5a1947ab0c14";
      rows.set(input.sourceUrl + "\n" + input.sha256, id);
      return id;
    },
  };
  return { store, objects, rows, getWrites: () => writes, getBucketCalls: () => bucketCalls, getReadbacks: () => readbacks };
}

function args(store: OilOriginalArchiveStore, overrides: Record<string, unknown> = {}) {
  return {
    benchmark: "WTI" as const, sourceUrl: CME, bytes: PDF,
    fetchedSha256: hash(PDF), collectedAt, rightsApproved: true, store, ...overrides,
  };
}

test("archive is immutable, private, source/date/content-addressed and byte-readback verified", async () => {
  const f = fixture();
  const first = await persistCapturedOilOriginal(args(f.store));
  const second = await persistCapturedOilOriginal(args(f.store));
  assert.deepEqual(first, second);
  assert.equal(first.bucket, OIL_ORIGINAL_BUCKET);
  assert.equal(first.originalSha256, hash(PDF));
  assert.equal(first.originalArchived, true);
  assert.equal(first.finalSettlementVerified, false);
  assert.equal(first.canonicalAdmitted, false);
  assert.equal(f.rows.size, 1, "retries must never mint duplicate raw-source records");
  assert.equal(f.objects.size, 1, "identical file bytes must not be overwritten");
  assert.equal(f.getWrites(), 2);
  assert.equal(f.getReadbacks(), 2, "each run checks the actual archived bytes");
});

test("ICE settlement CSV original may be preserved without becoming an accepted ICE price", async () => {
  const f = fixture();
  const result = await persistCapturedOilOriginal({
    benchmark: "BRENT", sourceUrl: ICE, bytes: CSV, fetchedSha256: hash(CSV),
    collectedAt, rightsApproved: true, store: f.store,
  });
  assert.match(result.objectPath, /^ICE\/2026-10-14\/[a-f0-9]{64}\.csv$/);
  assert.equal(result.finalSettlementVerified, false);
  assert.equal(result.canonicalAdmitted, false);
});

test("no license, forged hash, invalid source/date and HTML disguised as PDF or CSV never upload", async () => {
  const f = fixture();
  const cases: Array<[string, Record<string, unknown>]> = [
    ["license not approved", { rightsApproved: false }],
    ["forged digest", { fetchedSha256: "f".repeat(64) }],
    ["wrong source", { sourceUrl: "https://www.cmegroup.com.evil.test/daily_bulletin/archive/20261014/a.pdf" }],
    ["rotating source", { sourceUrl: "https://www.cmegroup.com/daily_bulletin/current/Section61_Energy_Futures_Products.pdf" }],
    ["invalid month", { sourceUrl: "https://www.cmegroup.com/daily_bulletin/archive/20261314/Section61_Energy_Futures_Products.pdf" }],
    ["no UTC collection time", { collectedAt: "2026-10-21" }],
    ["HTML with wrong signature", { bytes: new TextEncoder().encode("<html>Denied</html>"), fetchedSha256: hash(new TextEncoder().encode("<html>Denied</html>")) }],
    ["empty content", { bytes: new Uint8Array(), fetchedSha256: hash(new Uint8Array()) }],
    ["wrong commodity", { benchmark: "BRENT" }],
    ["bad CSV", { benchmark: "BRENT", sourceUrl: ICE, bytes: new TextEncoder().encode("<html>login</html>"), fetchedSha256: hash(new TextEncoder().encode("<html>login</html>")) }],
  ];
  for (const [name, changes] of cases) {
    await assert.rejects(() => persistCapturedOilOriginal(args(f.store, changes)), /.+/, name);
    assert.equal(f.objects.size, 0, name);
    assert.equal(f.rows.size, 0, name);
  }
});

test("storage readback corruption never inserts source metadata", async () => {
  const f = fixture();
  f.store.readObject = async () => new TextEncoder().encode("%PDF-FAKE");
  await assert.rejects(() => persistCapturedOilOriginal(args(f.store)), /Archive read-back hash mismatch/);
  assert.equal(f.rows.size, 0);
});

test("metadata insert failure cannot create a false canonical observation", async () => {
  const f = fixture();
  f.store.appendRaw = async () => { throw new Error("metadata store down"); };
  await assert.rejects(() => persistCapturedOilOriginal(args(f.store)), /metadata store down/);
  assert.equal(f.rows.size, 0);
  assert.equal(f.objects.size, 1, "source object remains recoverable for idempotent retry");
});

test("approved publisher environment flag is off unless explicitly enabled", async () => {
  const { oilPublisherRetentionApproved } = await import("../lib/research-gap-oil-private-archive.ts");
  const wti = process.env.OIL_CME_ARCHIVE_RETENTION_APPROVED;
  const brent = process.env.OIL_ICE_ARCHIVE_RETENTION_APPROVED;
  try {
    delete process.env.OIL_CME_ARCHIVE_RETENTION_APPROVED;
    delete process.env.OIL_ICE_ARCHIVE_RETENTION_APPROVED;
    assert.equal(oilPublisherRetentionApproved("WTI"), false);
    assert.equal(oilPublisherRetentionApproved("BRENT"), false);
    process.env.OIL_CME_ARCHIVE_RETENTION_APPROVED = "true";
    assert.equal(oilPublisherRetentionApproved("WTI"), true);
    assert.equal(oilPublisherRetentionApproved("BRENT"), false);
  } finally {
    if (wti === undefined) delete process.env.OIL_CME_ARCHIVE_RETENTION_APPROVED;
    else process.env.OIL_CME_ARCHIVE_RETENTION_APPROVED = wti;
    if (brent === undefined) delete process.env.OIL_ICE_ARCHIVE_RETENTION_APPROVED;
    else process.env.OIL_ICE_ARCHIVE_RETENTION_APPROVED = brent;
  }
});
