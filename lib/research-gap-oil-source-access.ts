import { createHash } from "node:crypto";

import type { OilBenchmark } from "./research-gap-exact-oil-proof.ts";

/**
 * An acquisition diagnostic run by the EXISTING Research Gap evaluation path.
 * It must never create an Evidence UUID, infer a settlement, or mark a source FINAL.
 */
export type OilSourceAccessStatus =
  | "NO_DATED_ORIGINAL_URL"
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "REDIRECT_BLOCKED"
  | "FETCH_FAILED"
  | "SOURCE_TOO_LARGE"
  | "WRONG_MEDIA_TYPE"
  | "RETRIEVED_UNARCHIVED"
  | "ARCHIVED_UNVERIFIED"
  | "ARCHIVE_FAILED";

export type OilSourceAccessResult = {
  benchmark: OilBenchmark;
  sourceUrl: string | null;
  status: OilSourceAccessStatus;
  httpStatus: number | null;
  bytes: number | null;
  fetchedSha256: string | null;
  originalArchived: boolean;
  canonicalAdmitted: false;
};

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
/**
 * Bounded in-memory capture for a future private archival writer. It cannot
 * itself establish FINAL status, preserve a document, or admit Evidence.
 * Callers must not serialise originalBytes to public API responses or logs.
 */
export type OilOriginalCapture = {
  result: OilSourceAccessResult;
  originalBytes: Uint8Array | null;
};

const MAX_ORIGINAL_BYTES = 1_800_000;
const MAX_URLS_PER_BENCHMARK = 2;
const TIMEOUT_MS = 5_000;
const ISO_DATE = /(?:20\d{2}(?:[-_/]?\d{2}){2})/;

export function eligibleDatedOilOriginal(
  input: string,
  benchmark: OilBenchmark,
): string | null {
  try {
    const u = new URL(input);
    const hostname = u.hostname.toLowerCase();
    const expected = benchmark === "WTI" ? "www.cmegroup.com" : "www.ice.com";
    if (u.protocol !== "https:" || hostname !== expected || u.port || u.username
      || u.password || u.search || u.hash || u.href.length > 400) return null;
    const path = decodeURIComponent(u.pathname);
    // A rotating /current/ link cannot become a historical document.
    if (!ISO_DATE.test(path)
      || /\/(?:latest|current|preliminary)\//i.test(path)
      || /(?:\.\.|\\|\/\/)/.test(path)
      || !/\.(?:pdf|csv)$/i.test(path)) return null;
    if (benchmark === "WTI" && !/(?:daily[_-]?bulletin|settlement)/i.test(path)) return null;
    if (benchmark === "BRENT" && !/(?:settlement|report)/i.test(path)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function fail(benchmark: OilBenchmark, url: string | null, status: OilSourceAccessStatus, code: number | null): OilSourceAccessResult {
  return {
    benchmark, sourceUrl: url, status, httpStatus: code,
    bytes: null, fetchedSha256: null,
    originalArchived: false, canonicalAdmitted: false,
  };
}

export async function captureDatedOilOriginal(
  benchmark: OilBenchmark,
  url: string,
  fetcher: Fetcher = fetch,
): Promise<OilOriginalCapture> {
  const rejected = (
    source: OilBenchmark, originalUrl: string | null,
    status: OilSourceAccessStatus, code: number | null,
  ): OilOriginalCapture => ({
    result: fail(source, originalUrl, status, code),
    originalBytes: null,
  });
  const eligible = eligibleDatedOilOriginal(url, benchmark);
  if (!eligible) return rejected(benchmark, null, "NO_DATED_ORIGINAL_URL", null);

  try {
    // Manual redirect handling also prohibits publisher->third-party credential/login
    // redirects. No cookies, authorization headers, or browser session sharing.
    const response = await fetcher(eligible, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/pdf,text/csv" },
    });
    const status = response.status;
    if (status >= 300 && status < 400) return rejected(benchmark, eligible, "REDIRECT_BLOCKED", status);
    if (status === 401) return rejected(benchmark, eligible, "AUTH_REQUIRED", status);
    if (status === 403) return rejected(benchmark, eligible, "ACCESS_DENIED", status);
    if (status === 429) return rejected(benchmark, eligible, "RATE_LIMITED", status);
    if (status === 404 || status === 410) return rejected(benchmark, eligible, "NOT_FOUND", status);
    if (!response.ok || !response.body) return rejected(benchmark, eligible, "FETCH_FAILED", status);

    const media = (response.headers.get("content-type") ?? "").toLowerCase();
    const expectPdf = eligible.toLowerCase().endsWith(".pdf");
    const claimedLength = Number(response.headers.get("content-length") || 0);
    if (claimedLength > MAX_ORIGINAL_BYTES) return rejected(benchmark, eligible, "SOURCE_TOO_LARGE", status);
    if (expectPdf ? !media.includes("pdf") : !(media.includes("csv") || media.includes("text/plain"))) {
      return rejected(benchmark, eligible, "WRONG_MEDIA_TYPE", status);
    }
    const reader = response.body.getReader();
    const digest = createHash("sha256");
    const chunks: Uint8Array[] = [];
    let firstBytes = new Uint8Array(0);
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_ORIGINAL_BYTES) {
          await reader.cancel();
          return rejected(benchmark, eligible, "SOURCE_TOO_LARGE", status);
        }
        chunks.push(value.slice());
        if (firstBytes.length < 24) {
          const next = new Uint8Array(Math.min(24, firstBytes.length + value.length));
          next.set(firstBytes);
          next.set(value.slice(0, next.length - firstBytes.length), firstBytes.length);
          firstBytes = next;
        }
        digest.update(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (bytes === 0) return rejected(benchmark, eligible, "WRONG_MEDIA_TYPE", status);
    const prefix = new TextDecoder().decode(firstBytes);
    if (expectPdf ? !prefix.startsWith("%PDF-") : !/^[^\r\n]{2,}/.test(prefix)) {
      return rejected(benchmark, eligible, "WRONG_MEDIA_TYPE", status);
    }
    // Raw bytes are NOT retained by this health probe. Even a valid original
    // download must be archived and parsed by a separate permissioned adapter.
    // Keep only bounded original bytes for a separately authorised archive
    // writer. The existing probe still returns diagnostics without raw bytes.
    const originalBytes = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      originalBytes.set(chunk, offset);
      offset += chunk.length;
    }
    return {
      result: {
        benchmark, sourceUrl: eligible, status: "RETRIEVED_UNARCHIVED",
        httpStatus: status, bytes, fetchedSha256: digest.digest("hex"),
        originalArchived: false, canonicalAdmitted: false,
      },
      originalBytes,
    };
  } catch {
    return rejected(benchmark, eligible, "FETCH_FAILED", null);
  }
}

/**
 * Public-facing diagnostic path remains metadata-only. No original bytes are
 * placed in the Research Gap JSON or logging surface.
 */
export async function probeDatedOilOriginal(
  benchmark: OilBenchmark,
  url: string,
  fetcher: Fetcher = fetch,
): Promise<OilSourceAccessResult> {
  const capture = await captureDatedOilOriginal(benchmark, url, fetcher);
  return capture.result;
}

/**
 * Every scheduled evaluate uses a bounded source check. No match means an
 * explicit actionable access gap; irrelevant research avoids publisher calls.
 */
export async function inspectOilPublisherAccess(input: {
  required: readonly OilBenchmark[];
  citedUrls: readonly string[];
  fetcher?: Fetcher;
}): Promise<OilSourceAccessResult[]> {
  const checks: OilSourceAccessResult[] = [];
  for (const benchmark of input.required) {
    const urls = [...new Set(input.citedUrls
      .map(url => eligibleDatedOilOriginal(url, benchmark))
      .filter((url): url is string => url !== null))]
      .slice(0, MAX_URLS_PER_BENCHMARK);
    if (!urls.length) {
      checks.push(fail(benchmark, null, "NO_DATED_ORIGINAL_URL", null));
      continue;
    }
    // Strict cap 2 docs per publisher and no retry storm in the web request.
    for (const url of urls) {
      // Only if the operator independently enabled publisher retention does
      // this existing research cycle also append an immutable PRIVATE archive.
      const approvalKey = benchmark === "WTI"
        ? "OIL_CME_ARCHIVE_RETENTION_APPROVED"
        : "OIL_ICE_ARCHIVE_RETENTION_APPROVED";
      if (process.env[approvalKey] !== "true") {
        checks.push(await probeDatedOilOriginal(benchmark, url, input.fetcher));
        continue;
      }
      const capture = await captureDatedOilOriginal(benchmark, url, input.fetcher);
      if (!capture.originalBytes || !capture.result.fetchedSha256
        || capture.result.status !== "RETRIEVED_UNARCHIVED") {
        checks.push(capture.result);
        continue;
      }
      try {
        // Lazy server-only provider client: no secret or original bytes enter
        // API replies/logs. Archived bytes are NOT parsed/accepted settlements.
        const { archiveCapturedOilOriginal } = await import("./research-gap-oil-private-archive.ts");
        const receipt = await archiveCapturedOilOriginal({
          benchmark, sourceUrl: url,
          originalBytes: capture.originalBytes,
          fetchedSha256: capture.result.fetchedSha256,
        });
        checks.push({
          ...capture.result, status: "ARCHIVED_UNVERIFIED",
          originalArchived: receipt.originalArchived, canonicalAdmitted: false,
        });
      } catch {
        checks.push({ ...capture.result, status: "ARCHIVE_FAILED" });
      }
    }
  }
  return checks;
}
