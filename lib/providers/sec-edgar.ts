export const SEC_DATA_BASE = "https://data.sec.gov";
export const SEC_SOURCE_NAME = "U.S. Securities and Exchange Commission" as const;

export const SEC_XBRL_CONCEPTS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForProceedsFromOtherPropertyPlantAndEquipment"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
} as const;

export type SecMetricKey = keyof typeof SEC_XBRL_CONCEPTS;

export type SecFiling = {
  accessionNumber: string;
  filingDate: string;
  reportDate: string | null;
  acceptanceDateTime: string | null;
  form: string;
  primaryDocument: string | null;
  primaryDocumentUrl: string | null;
  items: string | null;
};

export type SecFactObservation = {
  concept: string;
  unit: string;
  value: number;
  filed: string;
  periodStart: string | null;
  periodEnd: string;
  form: string | null;
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  accessionNumber: string | null;
  frame: string | null;
};

export type SecMetric = {
  key: SecMetricKey;
  concept: string;
  label: string | null;
  description: string | null;
  latest: SecFactObservation;
  previous: SecFactObservation | null;
};

export type SecCompanySnapshot = {
  state: "ready" | "unconfigured" | "unavailable";
  cik: string;
  entityName: string | null;
  retrievedAt: string | null;
  filings: SecFiling[];
  metrics: Partial<Record<SecMetricKey, SecMetric>>;
  sourceName: typeof SEC_SOURCE_NAME;
  submissionsUrl: string;
  companyFactsUrl: string;
  note: string | null;
};

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordLike : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(value: unknown) {
  const parsed = numberValue(value);
  return parsed === null || !Number.isInteger(parsed) ? null : parsed;
}

export function normalizeSecCik(cik: string | number) {
  const digits = String(cik).replace(/\D/g, "");
  if (!digits || digits.length > 10) throw new Error("SEC CIK must contain 1-10 digits.");
  return digits.padStart(10, "0");
}

export function buildSecSubmissionsUrl(cik: string | number) {
  return `${SEC_DATA_BASE}/submissions/CIK${normalizeSecCik(cik)}.json`;
}

export function buildSecCompanyFactsUrl(cik: string | number) {
  return `${SEC_DATA_BASE}/api/xbrl/companyfacts/CIK${normalizeSecCik(cik)}.json`;
}

function filingDocumentUrl(cik: string, accessionNumber: string, primaryDocument: string | null) {
  if (!primaryDocument) return null;
  const cikNumber = String(Number(cik));
  const accessionPath = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNumber}/${accessionPath}/${primaryDocument}`;
}

export function parseSecSubmissionsPayload(payload: unknown, cikInput: string | number) {
  const root = asRecord(payload);
  const cik = normalizeSecCik(cikInput);
  if (!root) return { entityName: null, filings: [] as SecFiling[] };
  const recent = asRecord(asRecord(root.filings)?.recent);
  if (!recent) return { entityName: stringValue(root.name), filings: [] as SecFiling[] };

  const accession = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const filingDate = Array.isArray(recent.filingDate) ? recent.filingDate : [];
  const reportDate = Array.isArray(recent.reportDate) ? recent.reportDate : [];
  const acceptanceDateTime = Array.isArray(recent.acceptanceDateTime) ? recent.acceptanceDateTime : [];
  const form = Array.isArray(recent.form) ? recent.form : [];
  const primaryDocument = Array.isArray(recent.primaryDocument) ? recent.primaryDocument : [];
  const items = Array.isArray(recent.items) ? recent.items : [];

  const filings: SecFiling[] = [];
  for (let i = 0; i < accession.length; i += 1) {
    const accessionNumber = stringValue(accession[i]);
    const filed = stringValue(filingDate[i]);
    const filingForm = stringValue(form[i]);
    if (!accessionNumber || !filed || !filingForm) continue;
    const document = stringValue(primaryDocument[i]);
    filings.push({
      accessionNumber,
      filingDate: filed,
      reportDate: stringValue(reportDate[i]),
      acceptanceDateTime: stringValue(acceptanceDateTime[i]),
      form: filingForm,
      primaryDocument: document,
      primaryDocumentUrl: filingDocumentUrl(cik, accessionNumber, document),
      items: stringValue(items[i]),
    });
  }

  filings.sort((a, b) => {
    const accepted = (b.acceptanceDateTime || b.filingDate).localeCompare(a.acceptanceDateTime || a.filingDate);
    return accepted || b.accessionNumber.localeCompare(a.accessionNumber);
  });
  return { entityName: stringValue(root.name), filings };
}

function parseFactObservation(row: unknown, concept: string, unit: string): SecFactObservation | null {
  const record = asRecord(row);
  if (!record) return null;
  const value = numberValue(record.val);
  const filed = stringValue(record.filed);
  const periodEnd = stringValue(record.end);
  if (value === null || !filed || !periodEnd) return null;
  return {
    concept,
    unit,
    value,
    filed,
    periodStart: stringValue(record.start),
    periodEnd,
    form: stringValue(record.form),
    fiscalYear: integerValue(record.fy),
    fiscalPeriod: stringValue(record.fp),
    accessionNumber: stringValue(record.accn),
    frame: stringValue(record.frame),
  };
}

function preferredUnit(units: RecordLike) {
  const keys = Object.keys(units);
  return keys.find((key) => key === "USD")
    || keys.find((key) => key === "USD/shares")
    || keys.find((key) => key === "shares")
    || keys[0]
    || null;
}

export function parseSecCompanyFactsPayload(payload: unknown) {
  const root = asRecord(payload);
  const usGaap = asRecord(asRecord(root?.facts)?.["us-gaap"]);
  const metrics: Partial<Record<SecMetricKey, SecMetric>> = {};
  if (!root || !usGaap) return { entityName: stringValue(root?.entityName), metrics };

  for (const [key, candidates] of Object.entries(SEC_XBRL_CONCEPTS) as [SecMetricKey, readonly string[]][]) {
    for (const concept of candidates) {
      const fact = asRecord(usGaap[concept]);
      const units = asRecord(fact?.units);
      if (!fact || !units) continue;
      const unit = preferredUnit(units);
      if (!unit || !Array.isArray(units[unit])) continue;
      const observations = (units[unit] as unknown[])
        .map((row) => parseFactObservation(row, concept, unit))
        .filter((row): row is SecFactObservation => row !== null)
        .sort((a, b) => {
          const period = b.periodEnd.localeCompare(a.periodEnd);
          if (period) return period;
          return b.filed.localeCompare(a.filed);
        });
      if (!observations.length) continue;
      metrics[key] = {
        key,
        concept,
        label: stringValue(fact.label),
        description: stringValue(fact.description),
        latest: observations[0],
        previous: observations[1] || null,
      };
      break;
    }
  }

  return { entityName: stringValue(root.entityName), metrics };
}

function unavailable(cik: string, retrievedAt: string | null, note: string): SecCompanySnapshot {
  return {
    state: "unavailable",
    cik,
    entityName: null,
    retrievedAt,
    filings: [],
    metrics: {},
    sourceName: SEC_SOURCE_NAME,
    submissionsUrl: buildSecSubmissionsUrl(cik),
    companyFactsUrl: buildSecCompanyFactsUrl(cik),
    note,
  };
}

export async function fetchSecCompanySnapshot(
  cikInput: string | number,
  userAgent = process.env.SEC_USER_AGENT?.trim(),
  fetchImpl: typeof fetch = fetch,
): Promise<SecCompanySnapshot> {
  const cik = normalizeSecCik(cikInput);
  const submissionsUrl = buildSecSubmissionsUrl(cik);
  const companyFactsUrl = buildSecCompanyFactsUrl(cik);
  if (!userAgent) {
    return {
      state: "unconfigured",
      cik,
      entityName: null,
      retrievedAt: null,
      filings: [],
      metrics: {},
      sourceName: SEC_SOURCE_NAME,
      submissionsUrl,
      companyFactsUrl,
      note: "SEC_USER_AGENT is not configured. SEC requests require a descriptive user agent with contact information.",
    };
  }

  const retrievedAt = new Date().toISOString();
  const request = (url: string) => fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": userAgent },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  try {
    const [submissionsResponse, factsResponse] = await Promise.all([request(submissionsUrl), request(companyFactsUrl)]);
    if (!submissionsResponse.ok || !factsResponse.ok) {
      return unavailable(
        cik,
        retrievedAt,
        `SEC EDGAR API unavailable: submissions HTTP ${submissionsResponse.status}; companyfacts HTTP ${factsResponse.status}.`,
      );
    }
    const [submissionsPayload, factsPayload] = await Promise.all([submissionsResponse.json(), factsResponse.json()]);
    const submissions = parseSecSubmissionsPayload(submissionsPayload, cik);
    const facts = parseSecCompanyFactsPayload(factsPayload);
    const entityName = submissions.entityName || facts.entityName;
    if (!entityName && !submissions.filings.length && !Object.keys(facts.metrics).length) {
      return unavailable(cik, retrievedAt, "SEC EDGAR returned no usable company filings or XBRL facts.");
    }
    return {
      state: "ready",
      cik,
      entityName,
      retrievedAt,
      filings: submissions.filings,
      metrics: facts.metrics,
      sourceName: SEC_SOURCE_NAME,
      submissionsUrl,
      companyFactsUrl,
      note: null,
    };
  } catch (error) {
    return unavailable(
      cik,
      retrievedAt,
      error instanceof Error ? `SEC EDGAR API unavailable: ${error.message}` : "SEC EDGAR API unavailable.",
    );
  }
}
