import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {
  SEC_D1_ISSUERS, type SecCashflowIssuerTicker,
} from "./dossier-v2/issuer-sec-quarterly-cashflow.ts";
import {
  buildSecSubmissionsUrl, parseSecSubmissionsPayload,
} from "./providers/sec-edgar.ts";

/** Filing discovery is System 1 only. The existing SEC writer admits facts. */
export const SCHEDULED_SEC_FILINGS_CONTRACT = "scheduled-sec-10q10k/1" as const;
type Filing = { accessionNumber: string; form: "10-Q" | "10-K"; filingDate: string };
type Discovery = { filing: Filing | null; gap: string | null };
type CanonicalSecRow = {
  id: string;
  external_evidence_id: string | null;
  normalised_observation_id: string | null;
  structured_payload: { ticker?: string; secFilingAccession?: string } | null;
};
type WriterResult = {
  persisted: Array<{ id: string; evidenceId: string; observationId: string }>;
  gaps: string[];
};
export type ScheduledSecFilings = {
  contractVersion: typeof SCHEDULED_SEC_FILINGS_CONTRACT;
  collectedAt: string;
  status: "UNCONFIGURED" | "SKIPPED_UNCHANGED" | "CANONICAL_WRITER_RAN" | "DEGRADED";
  evidenceIds: string[];
  gaps: string[];
  filings: Array<{ ticker: SecCashflowIssuerTicker; form: "10-Q" | "10-K" | null;
    accession: string | null; state: "UNCHANGED" | "ADMITTED" | "GAP" }>;
};
type Dependencies = {
  readEvidence?: () => Promise<CanonicalSecRow[]>;
  discover?: (ticker: SecCashflowIssuerTicker, userAgent: string, now: Date) => Promise<Discovery>;
  persist?: (ticker: SecCashflowIssuerTicker, asOf: string, userAgent: string) => Promise<WriterResult>;
  userAgent?: string;
  fetchImpl?: typeof fetch;
};
const TICKERS: SecCashflowIssuerTicker[] = ["GOOGL", "MSFT", "AMZN", "META"];
const DAY = 86_400_000;
function allowedOn(date: string, now: Date) {
  const timestamp = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(timestamp) && timestamp + DAY <= now.getTime();
}
function realContact(userAgent: string) {
  return /^[^\r\n]{12,200}$/.test(userAgent)
    && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(userAgent);
}
async function readCanonical(): Promise<CanonicalSecRow[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("intelligence_evidence")
    .select("id,external_evidence_id,normalised_observation_id,structured_payload")
    .like("external_evidence_id", "sec-cashflow:%")
    .order("available_at", { ascending: false })
    .limit(160);
  if (error) throw Error("SEC canonical lookup failed: " + error.message);
  return (data ?? []) as CanonicalSecRow[];
}
async function latestOfficialFiling(ticker: SecCashflowIssuerTicker, userAgent: string, now: Date, fetchImpl: typeof fetch): Promise<Discovery> {
  const cik = SEC_D1_ISSUERS[ticker].cik;
  const response = await fetchImpl(buildSecSubmissionsUrl(cik), {
    headers: { accept: "application/json", "user-agent": userAgent },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return { filing: null, gap: "SEC_SUBMISSIONS_HTTP_" + response.status };
  const payload = await response.json();
  if (Number(payload?.cik) !== Number(cik)) return { filing: null, gap: "SEC_SUBMISSIONS_CIK_MISMATCH" };
  const filings = parseSecSubmissionsPayload(payload, cik).filings
    .filter(f => allowedOn(f.filingDate, now));
  const originals = filings.filter(f => f.form === "10-Q" || f.form === "10-K");
  const filing = originals[0];
  if (!filing) return { filing: null, gap: "NO_ELIGIBLE_10Q_OR_10K" };
  // A later amendment to the same reporting period is NOT equivalent to the
  // original filing; the existing writer explicitly holds source revisions.
  const amended = filings.some(f => (f.form === "10-Q/A" || f.form === "10-K/A")
    && f.reportDate === filing.reportDate && f.filingDate >= filing.filingDate);
  if (amended) return { filing: null, gap: "LATEST_PERIOD_HAS_10Q_OR_10K_AMENDMENT_REQUIRES_REVIEW" };
  return {
    filing: { accessionNumber: filing.accessionNumber,
      form: filing.form as "10-Q" | "10-K", filingDate: filing.filingDate },
    gap: null,
  };
}
function admitted(rows: CanonicalSecRow[], ticker: SecCashflowIssuerTicker, accession: string) {
  return rows.filter(r => r.normalised_observation_id && r.structured_payload?.ticker === ticker
    && r.structured_payload.secFilingAccession === accession);
}
/**
 * An existing authenticated Live acquisition runs this BEFORE publication.
 * Submissions metadata is checked; companyfacts and database writes are skipped
 * for unchanged exact accession identities. There is no new schedule or model.
 */
export async function collectScheduledSec10q10k(
  now: Date,
  deps: Dependencies = {},
): Promise<ScheduledSecFilings> {
  const collectedAt = now.toISOString();
  const base = { contractVersion: SCHEDULED_SEC_FILINGS_CONTRACT, collectedAt };
  const userAgent = deps.userAgent ?? process.env.SEC_USER_AGENT?.trim() ?? "";
  if (!realContact(userAgent)) return {
    ...base, status: "UNCONFIGURED", evidenceIds: [],
    gaps: ["SEC_USER_AGENT_NOT_CONFIGURED"], filings: [],
  };
  const filings: ScheduledSecFilings["filings"] = [];
  const gaps: string[] = [], evidenceIds = new Set<string>();
  let changed = false;
  try {
    const read = deps.readEvidence ?? readCanonical;
    let current = await read();
    for (const ticker of TICKERS) {
      let accession: string | null = null, form: "10-Q" | "10-K" | null = null;
      try {
        const found = await (deps.discover ?? ((key, ua, date) => latestOfficialFiling(key, ua, date, deps.fetchImpl ?? fetch)))(ticker, userAgent, now);
        if (!found.filing) {
          gaps.push(ticker + ":" + (found.gap ?? "NO_ELIGIBLE_FILING"));
          filings.push({ ticker, accession, form, state: "GAP" });
          continue;
        }
        accession = found.filing.accessionNumber;
        form = found.filing.form;
        if (!/^\d{10}-\d{2}-\d{6}$/.test(accession)) {
          gaps.push(ticker + ":INVALID_SEC_ACCESSION");
          filings.push({ ticker, accession, form, state: "GAP" });
          continue;
        }
        if (admitted(current, ticker, accession).length) {
          filings.push({ ticker, accession, form, state: "UNCHANGED" });
          continue;
        }
        const out = await (deps.persist ?? (async (key, asOf, ua) => {
          const { persistSecIssuerCashflowEvidence } =
            await import("./dossier-v2/persist-sec-quarterly-cashflow.ts");
          return persistSecIssuerCashflowEvidence(asOf, key, { userAgent: ua, maxQuarters: 2 });
        }))(ticker, collectedAt, userAgent);
        // Confirm by read-back. A successful call is not proof that the exact
        // current filing produced an admissible quarterly observation.
        current = await read();
        const matches = admitted(current, ticker, accession);
        if (!matches.length) {
          gaps.push(ticker + ":" + accession + ":CURRENT_FILING_CASHFLOW_NOT_ADMITTED");
          gaps.push(...out.gaps.slice(0, 5).map(g => ticker + ":" + g));
          filings.push({ ticker, accession, form, state: "GAP" });
          continue;
        }
        changed = true;
        for (const r of matches) evidenceIds.add(r.id);
        filings.push({ ticker, accession, form, state: "ADMITTED" });
        gaps.push(...out.gaps.slice(0, 5).map(g => ticker + ":" + g));
      } catch (error) {
        gaps.push(ticker + ":SEC_PROVIDER_OR_WRITER_ERROR:"
          + (error instanceof Error ? error.message : "unknown").slice(0, 160));
        filings.push({ ticker, accession, form, state: "GAP" });
      }
    }
  } catch (error) {
    return { ...base, status: "DEGRADED", evidenceIds: [], filings,
      gaps: ["SEC_CANONICAL_READ_ERROR:" + (error instanceof Error ? error.message : "unknown").slice(0, 160)] };
  }
  return { ...base,
    status: gaps.length ? "DEGRADED" : changed ? "CANONICAL_WRITER_RAN" : "SKIPPED_UNCHANGED",
    evidenceIds: [...evidenceIds], gaps, filings,
  };
}
