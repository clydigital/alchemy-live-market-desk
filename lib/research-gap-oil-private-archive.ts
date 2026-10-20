import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { eligibleDatedOilOriginal } from "./research-gap-oil-source-access.ts";
import type { OilBenchmark } from "./research-gap-exact-oil-proof.ts";

export const OIL_ORIGINAL_BUCKET = "alchemy-oil-originals-private";
const MAX_BYTES = 1_800_000;
const HASH = /^[a-f0-9]{64}$/i;

export type ArchivedOriginalReceipt = {
  bucket: typeof OIL_ORIGINAL_BUCKET;
  objectPath: string;
  rawRecordId: string;
  originalSha256: string;
  originalArchived: true;
  finalSettlementVerified: false;
  canonicalAdmitted: false;
};

export type OilOriginalArchiveStore = {
  ensurePrivateBucket(bucket: string): Promise<void>;
  uploadOnce(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  readObject(bucket: string, path: string): Promise<Uint8Array>;
  findRaw(sourceUrl: string, sha256: string): Promise<string | null>;
  appendRaw(input: { sourceUrl: string; sha256: string; payload: Record<string, unknown>; observedAt: string; contentType: string }): Promise<string>;
};

function sha(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
function datedPath(sourceUrl: string): string | null {
  const path = new URL(sourceUrl).pathname;
  const match = path.match(/(20\d{2})(?:[-_/]?)(\d{2})(?:[-_/]?)(\d{2})/);
  if (!match) return null;
  const date = match[1] + "-" + match[2] + "-" + match[3];
  const d = new Date(date + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date ? date : null;
}

/**
 * Archive original response bytes only when the publisher has been separately
 * approved for retention. This is a *raw source* intake, NOT a parsed
 * settlement, FINAL bulletin validation, or canonical Evidence/Story mutation.
 *
 * Uploads are content addressed and never overwritten; always read back and
 * compare the SHA-256 from actual bytes before appending source-record metadata.
 */
export async function persistCapturedOilOriginal(input: {
  benchmark: OilBenchmark;
  sourceUrl: string;
  bytes: Uint8Array;
  fetchedSha256: string;
  collectedAt: string;
  rightsApproved: boolean;
  store: OilOriginalArchiveStore;
}): Promise<ArchivedOriginalReceipt> {
  const sourceUrl = eligibleDatedOilOriginal(input.sourceUrl, input.benchmark);
  if (!input.rightsApproved) throw new Error("Publisher retention approval not enabled.");
  if (!sourceUrl) throw new Error("Publisher URL is not an eligible original dated file.");
  if (!HASH.test(input.fetchedSha256) || sha(input.bytes) !== input.fetchedSha256.toLowerCase()) {
    throw new Error("Original response SHA-256 mismatch.");
  }
  if (!input.bytes.length || input.bytes.length > MAX_BYTES) throw new Error("Original exceeds bound or is empty.");
  const capturedAt = new Date(input.collectedAt);
  if (!Number.isFinite(capturedAt.getTime()) || capturedAt.toISOString() !== input.collectedAt) {
    throw new Error("Collection timestamp must be exact UTC ISO.");
  }
  const tradeDate = datedPath(sourceUrl);
  if (!tradeDate) throw new Error("Publisher original lacks a valid historical date.");
  const pdf = sourceUrl.toLowerCase().endsWith(".pdf");
  const contentType = pdf ? "application/pdf" : "text/csv";
  if (pdf && new TextDecoder().decode(input.bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("Original bytes are not a PDF.");
  }
  const ext = pdf ? "pdf" : "csv";
  const provider = input.benchmark === "WTI" ? "CME" : "ICE";
  const objectPath = provider + "/" + tradeDate + "/" + input.fetchedSha256.toLowerCase() + "." + ext;

  await input.store.ensurePrivateBucket(OIL_ORIGINAL_BUCKET);
  await input.store.uploadOnce(OIL_ORIGINAL_BUCKET, objectPath, input.bytes, contentType);
  const retrieved = await input.store.readObject(OIL_ORIGINAL_BUCKET, objectPath);
  if (sha(retrieved) !== input.fetchedSha256.toLowerCase()) throw new Error("Archive read-back hash mismatch.");

  const payload = {
    contractVersion: "oil-original-archive/1",
    benchmark: input.benchmark,
    provider,
    tradeDate,
    originalSourceSha256: input.fetchedSha256.toLowerCase(),
    archiveBucket: OIL_ORIGINAL_BUCKET,
    archivePath: objectPath,
    archiveVerified: true,
    finalSettlementVerified: false,
    canonicalAdmitted: false,
    sourceUrl,
    // We explicitly do NOT infer F1/F2, FINAL status or prices from a valid PDF.
  };
  let rawRecordId = await input.store.findRaw(sourceUrl, input.fetchedSha256.toLowerCase());
  if (!rawRecordId) rawRecordId = await input.store.appendRaw({
    sourceUrl, sha256: input.fetchedSha256.toLowerCase(), payload,
    observedAt: capturedAt.toISOString(), contentType,
  });
  return {
    bucket: OIL_ORIGINAL_BUCKET, objectPath, rawRecordId,
    originalSha256: input.fetchedSha256.toLowerCase(),
    originalArchived: true, finalSettlementVerified: false, canonicalAdmitted: false,
  };
}

/** The two independent exchange retention approvals are OFF by default. */
export function oilPublisherRetentionApproved(benchmark: OilBenchmark): boolean {
  return process.env[benchmark === "WTI" ? "OIL_CME_ARCHIVE_RETENTION_APPROVED" : "OIL_ICE_ARCHIVE_RETENTION_APPROVED"] === "true";
}

/**
 * Production-only service role adapter. Bucket is PRIVATE with no public RLS
 * policies; there are no signed/public URLs. Authenticated source retrieval
 * is not attempted. Only call when the approved publisher flag is enabled.
 */
export async function archiveCapturedOilOriginal(input: {
  benchmark: OilBenchmark;
  sourceUrl: string;
  originalBytes: Uint8Array;
  fetchedSha256: string;
}): Promise<ArchivedOriginalReceipt> {
  if (!oilPublisherRetentionApproved(input.benchmark)) throw new Error("Retention not approved for this exchange.");
  const client = createSupabaseAdminClient();
  const store: OilOriginalArchiveStore = {
    async ensurePrivateBucket(bucket) {
      const existing = await client.storage.getBucket(bucket);
      if (existing.data) {
        if (existing.data.public) throw new Error("Original-source archive bucket must remain private.");
        return;
      }
      const result = await client.storage.createBucket(bucket, {
        public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: ["application/pdf", "text/csv"],
      });
      if (result.error) {
        const retry = await client.storage.getBucket(bucket);
        if (!retry.data || retry.data.public) throw new Error("Cannot provision private original-source bucket.");
      }
    },
    async uploadOnce(bucket, path, bytes, contentType) {
      const put = await client.storage.from(bucket).upload(path, bytes, {
        contentType, cacheControl: "0", upsert: false,
      });
      if (put.error && !/already exists|duplicate|conflict|409/i.test(put.error.message)) {
        throw new Error("Original-source upload failed: " + put.error.message);
      }
    },
    async readObject(bucket, path) {
      const res = await client.storage.from(bucket).download(path);
      if (res.error || !res.data) throw new Error("Cannot verify archived original bytes.");
      return new Uint8Array(await res.data.arrayBuffer());
    },
    async findRaw(sourceUrl, digest) {
      const result = await client.from("raw_source_records")
        .select("id").eq("source_url", sourceUrl).eq("content_hash", digest)
        .eq("provider", "OIL_ORIGINAL").limit(1).maybeSingle<{ id: string }>();
      if (result.error) throw new Error("Cannot read original-source record.");
      return result.data?.id ?? null;
    },
    async appendRaw(row) {
      const response = await client.from("raw_source_records").insert({
        provider: "OIL_ORIGINAL", source_url: row.sourceUrl,
        source_type: "exchange_original_file", content_type: row.contentType,
        content_hash: row.sha256, content_text: null, payload: row.payload,
        published_at: null, observed_at: row.observedAt, source_id: null,
        ingestion_key: "oil-original:" + row.sha256,
      }).select("id").single<{ id: string }>();
      if (response.error || !response.data?.id) {
        const retry = await store.findRaw(row.sourceUrl, row.sha256);
        if (retry) return retry;
        throw new Error("Original-source record metadata insert failed.");
      }
      return response.data.id;
    },
  };
  return persistCapturedOilOriginal({
    benchmark: input.benchmark,
    sourceUrl: input.sourceUrl,
    bytes: input.originalBytes,
    fetchedSha256: input.fetchedSha256,
    collectedAt: new Date().toISOString(),
    rightsApproved: true,
    store,
  });
}
