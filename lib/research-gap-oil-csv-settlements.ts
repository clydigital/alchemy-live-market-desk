import { createHash } from "node:crypto";
import { consecutiveOilContractMonths } from "./oil-futures-contracts.ts";
import { eligibleDatedOilOriginal } from "./research-gap-oil-source-access.ts";
import { OIL_ORIGINAL_BUCKET, type ArchivedOriginalReceipt } from "./research-gap-oil-private-archive.ts";
import type { OilBenchmark } from "./research-gap-exact-oil-proof.ts";

/**
 * Read-only parsing of a privately archived ORIGINAL exchange CSV. This does
 * not validate a new exchange format by itself or create canonical Evidence.
 * An operator must inspect the original format and approve an exact column
 * profile before a candidate can be derived. No profile is enabled by default.
 */
export type ReviewedOilCsvProfile = {
  profileId: string;
  reviewedAt: string;
  approved: true;
  benchmark: OilBenchmark;
  exchange: "NYMEX" | "ICE";
  columns: {
    tradeDate: string;
    contract: string;
    settlement: string;
    settlementStatus: string;
    exchange: string;
    unit: string;
  };
  finalToken: string;
  exchangeToken: string;
  unitToken: string;
};

export type OilSettlementCandidate = {
  status: "PARSED_UNADMITTED";
  tradeDate: string;
  benchmark: OilBenchmark;
  exchange: "NYMEX" | "ICE";
  frontContract: string;
  nextContract: string;
  frontSettle: number;
  nextSettle: number;
  spreadUsdPerBarrel: number;
  unit: "USD_per_barrel";
  final: true;
  originalSourceSha256: string;
  rawRecordId: string;
  sourceUrl: string;
  profileId: string;
  sourceArchived: true;
  canonicalAdmitted: false;
};

export type OilCsvParseRequest = {
  benchmark: OilBenchmark;
  sourceUrl: string;
  sourceBytes: Uint8Array;
  original: ArchivedOriginalReceipt;
  profile: ReviewedOilCsvProfile;
  tradeDate: string;
  frontContract: string;
  nextContract: string;
};

const MAX_CSV_BYTES = 1_800_000;
const DATE = /^20\d{2}-\d{2}-\d{2}$/;
const HASH = /^[a-f0-9]{64}$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function validDay(date: string): boolean {
  if (!DATE.test(date)) return false;
  const time = new Date(date + "T00:00:00.000Z");
  return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === date;
}

/** Limited strict RFC4180 CSV reader; rejects malformed quoting and NULs. */
function rowsFromCsv(text: string): string[][] {
  if (text.includes("\u0000")) throw new Error("CSV contains invalid NUL bytes.");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let endedQuote = false;
  let started = false;
  function endCell() {
    row.push(cell);
    cell = "";
    quoted = false;
    endedQuote = false;
    started = false;
  }
  function endRow() {
    endCell();
    if (row.some(item => item.trim().length > 0)) rows.push(row);
    row = [];
    if (rows.length > 10_000) throw new Error("CSV exceeds maximum rows.");
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          endedQuote = true;
        }
      } else cell += char;
      continue;
    }
    if (char === ",") {
      endCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else if (char === '"' && !started) {
      quoted = true;
      started = true;
    } else {
      if (char === '"' || endedQuote) throw new Error("Malformed quoted CSV cell.");
      cell += char;
      started = true;
    }
  }
  if (quoted) throw new Error("CSV has unterminated quoted cell.");
  if (cell || row.length || started || endedQuote) endRow();
  return rows;
}

function readSettle(value: string): number {
  // Reject commas, estimated/range prices, NaN, empty or currency-labelled
  // numbers rather than "fixing" an unrecognised publisher format.
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d{0,3})(?:\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Settlement value is not an unambiguous decimal price.");
  }
  const number = Number(trimmed);
  if (!(number > 0 && number < 1000)) {
    throw new Error("Settlement must be positive and less than 1000 USD/barrel.");
  }
  return number;
}

export function parseArchivedOilSettlementCsv(
  input: OilCsvParseRequest,
): OilSettlementCandidate {
  const { benchmark, sourceUrl, sourceBytes, profile, original } = input;
  if (!profile.approved || !profile.profileId.trim()
    || !Number.isFinite(Date.parse(profile.reviewedAt))
    || profile.benchmark !== benchmark
    || profile.exchange !== (benchmark === "WTI" ? "NYMEX" : "ICE")
    || !profile.finalToken.trim() || !profile.exchangeToken.trim()
    || !profile.unitToken.trim()) throw new Error("Missing approved publisher format mapping.");

  const eligibleUrl = eligibleDatedOilOriginal(sourceUrl, benchmark);
  if (!eligibleUrl || eligibleUrl !== sourceUrl || !eligibleUrl.endsWith(".csv")) {
    throw new Error("Only original dated exchange CSV records can be parsed.");
  }
  const provider = benchmark === "WTI" ? "CME" : "ICE";
  const expectedArchivePath = provider + "/" + input.tradeDate + "/" + original.originalSha256 + ".csv";
  if (!original.originalArchived || original.canonicalAdmitted
    || original.bucket !== OIL_ORIGINAL_BUCKET
    || !UUID.test(original.rawRecordId)
    || !HASH.test(original.originalSha256)
    || original.objectPath !== expectedArchivePath
    || sourceBytes.byteLength === 0 || sourceBytes.byteLength > MAX_CSV_BYTES
    || createHash("sha256").update(sourceBytes).digest("hex") !== original.originalSha256) {
    throw new Error("Cannot parse a non-archived or hash-mismatched original.");
  }
  const match = sourceUrl.match(/(20\d{2})[-_/]?(\d{2})[-_/]?(\d{2})/);
  const datedUrl = match && match[1] + "-" + match[2] + "-" + match[3];
  if (!validDay(input.tradeDate) || datedUrl !== input.tradeDate
    || !consecutiveOilContractMonths(benchmark, input.frontContract, input.nextContract)) {
    throw new Error("Requested date or contract pair is not valid.");
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes).replace(/^\uFEFF/, "");
  const rows = rowsFromCsv(text);
  if (rows.length < 3) throw new Error("Missing original CSV header or contract observations.");
  const header = rows[0].map(s => s.trim());
  if (new Set(header).size !== header.length) throw new Error("Duplicate CSV headers.");
  const required = Object.values(profile.columns);
  if (new Set(required).size !== required.length
    || required.some(h => !header.includes(h))) {
    throw new Error("CSV original differs from independently reviewed column profile.");
  }
  const indexes = Object.fromEntries(
    Object.entries(profile.columns).map(([key, value]) => [key, header.indexOf(value)]),
  ) as Record<keyof ReviewedOilCsvProfile["columns"], number>;

  const matches = new Map<string, number>();
  for (const line of rows.slice(1)) {
    if (line.length !== header.length) throw new Error("Malformed publisher CSV row.");
    const contract = line[indexes.contract].trim().toUpperCase();
    if (contract !== input.frontContract.toUpperCase()
      && contract !== input.nextContract.toUpperCase()) continue;
    if (line[indexes.tradeDate].trim() !== input.tradeDate) continue;
    if (line[indexes.exchange].trim() !== profile.exchangeToken
      || line[indexes.unit].trim() !== profile.unitToken
      || line[indexes.settlementStatus].trim() !== profile.finalToken) {
      throw new Error("Contract row is not a FINAL settlement for the approved exchange and unit.");
    }
    if (matches.has(contract)) throw new Error("Conflicting or duplicated contract settlements.");
    matches.set(contract, readSettle(line[indexes.settlement]));
  }
  const front = matches.get(input.frontContract.toUpperCase());
  const next = matches.get(input.nextContract.toUpperCase());
  if (front === undefined || next === undefined) {
    throw new Error("Original file does not supply both requested FINAL contracts.");
  }
  return {
    status: "PARSED_UNADMITTED",
    benchmark,
    exchange: profile.exchange,
    tradeDate: input.tradeDate,
    frontContract: input.frontContract.toUpperCase(),
    nextContract: input.nextContract.toUpperCase(),
    frontSettle: front,
    nextSettle: next,
    spreadUsdPerBarrel: Math.round((front - next) * 1_000_000) / 1_000_000,
    unit: "USD_per_barrel",
    final: true,
    originalSourceSha256: original.originalSha256,
    rawRecordId: original.rawRecordId,
    sourceUrl,
    profileId: profile.profileId,
    sourceArchived: true,
    canonicalAdmitted: false,
  };
}
