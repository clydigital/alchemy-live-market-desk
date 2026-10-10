import { createHash } from "node:crypto";
import { buildSecCompanyFactsUrl, normalizeSecCik } from "../providers/sec-edgar.ts";

/** D1a source-backed filing intake. The wider cohort must reuse this algorithm. */
export const SEC_CASHFLOW_METHOD = "sec-consolidated-cashflow-quarter-v1" as const;
export type SecCashflowIssuerTicker = "GOOGL" | "MSFT" | "AMZN" | "META";

export const SEC_D1_ISSUERS: Record<SecCashflowIssuerTicker, {
  symbol: SecCashflowIssuerTicker;
  cik: string;
  entityName: string;
  aliases: readonly string[];
  secUrl: string;
  filingIndexCik: string;
}> = {
  GOOGL: {
    symbol: "GOOGL", cik: "0001652044", entityName: "Alphabet Inc.",
    aliases: ["Alphabet Inc", "ALPHABET INC"],
    secUrl: buildSecCompanyFactsUrl("1652044"), filingIndexCik: "1652044",
  },
  MSFT: {
    symbol: "MSFT", cik: "0000789019", entityName: "Microsoft Corporation",
    aliases: ["MICROSOFT CORP", "MICROSOFT CORPORATION"],
    secUrl: buildSecCompanyFactsUrl("789019"), filingIndexCik: "789019",
  },
  AMZN: {
    symbol: "AMZN", cik: "0001018724", entityName: "Amazon.com, Inc.",
    aliases: ["AMAZON COM INC", "AMAZON.COM INC", "AMAZON.COM, INC."],
    secUrl: buildSecCompanyFactsUrl("1018724"), filingIndexCik: "1018724",
  },
  META: {
    symbol: "META", cik: "0001326801", entityName: "Meta Platforms, Inc.",
    aliases: ["META PLATFORMS INC", "META PLATFORMS, INC."],
    secUrl: buildSecCompanyFactsUrl("1326801"), filingIndexCik: "1326801",
  },
};
export const SEC_CASHFLOW_SOURCE = "U.S. Securities and Exchange Commission" as const;
/** Backward-compatible explicit first-issuer alias. */
export const SEC_D1A_ISSUER = SEC_D1_ISSUERS.GOOGL;

export type SecCashFlowComponent = {
  accessionNumber: string;
  form: "10-Q" | "10-K";
  filed: string;
  fiscalYear: number;
  fiscalPeriod: "Q1" | "Q2" | "Q3" | "FY";
  periodStart: string;
  periodEnd: string;
  operatingCashFlowYtdUsd: number;
  cashPpeYtdUsd: number;
};
export type SecQuarterCashFlow = {
  issuerCik: string;
  ticker: SecCashflowIssuerTicker;
  entityScope: "CONSOLIDATED";
  accountingBasis: "US_GAAP";
  fiscalYear: number;
  fiscalQuarter: 1 | 2 | 3 | 4;
  periodStart: string;
  periodEnd: string;
  filedDate: string;
  availableAt: string;
  currentAccession: string;
  predecessorAccession: string | null;
  cfoUsd: number;
  cashPpeUsd: number;
  simpleFcfUsd: number;
  capexToPositiveCfo: number | null;
  sourceUrl: string;
  filingIndexUrl: string;
  componentCfoYtdUsd: number;
  componentCashPpeYtdUsd: number;
  predecessorCfoYtdUsd: number;
  predecessorCashPpeYtdUsd: number;
  contentHash: string;
  /** Two different fiscal periods are required for a two-quarter watch. */
  observationIdentity: string;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function isoDay(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + "T00:00:00Z"))
    && new Date(Date.parse(value + "T00:00:00Z")).toISOString().startsWith(value);
}
function dayMs(day: string) {
  return Date.parse(day + "T00:00:00Z");
}
function nextDay(day: string) {
  return new Date(dayMs(day) + 86_400_000).toISOString().slice(0, 10);
}
function elapsedDays(start: string, end: string) {
  return (dayMs(end) - dayMs(start)) / 86_400_000 + 1;
}
function accessionOk(value: unknown): value is string {
  return typeof value === "string" && /^\d{10}-\d{2}-\d{6}$/.test(value);
}
type FactRow = {
  value: number;
  concept: "NetCashProvidedByUsedInOperatingActivities" | "PaymentsToAcquirePropertyPlantAndEquipment";
  accessionNumber: string;
  form: "10-Q" | "10-K";
  filed: string;
  fiscalYear: number;
  fiscalPeriod: "Q1" | "Q2" | "Q3" | "FY";
  start: string;
  end: string;
};
function rows(payload: unknown, concept: FactRow["concept"], asOfMs: number, ticker: SecCashflowIssuerTicker): FactRow[] {
  const fact = object(object(object(payload)?.facts)?.["us-gaap"]);
  const candidate = object(object(fact?.[concept])?.units);
  const inputs = candidate?.USD;
  if (!Array.isArray(inputs)) return [];
  return inputs.flatMap((value): FactRow[] => {
    const row = object(value);
    if (!row) return [];
    if (!isoDay(row.start) || !isoDay(row.end) || !isoDay(row.filed)
      || dayMs(row.end) < dayMs(row.start)
      || !accessionOk(row.accn)
      || (row.form !== "10-Q" && row.form !== "10-K")
      || !Number.isInteger(row.fy) || typeof row.fy !== "number"
      || !["Q1", "Q2", "Q3", "FY"].includes(String(row.fp))
      || typeof row.val !== "number" || !Number.isFinite(row.val)) return [];
    const form = row.form as "10-Q" | "10-K";
    const fp = row.fp as FactRow["fiscalPeriod"];
    if ((fp === "FY") !== (form === "10-K")) return [];
    // SEC CompanyFacts includes prior-year comparatives with a later filing's
    // fy/fp. Match the actual fiscal quarter END calendar year and month.
    // Microsoft FY26 Q1/Q2 end Sep/Dec 2025, Q3/FY end Mar/Jun 2026.
    const expectedYear = ticker === "MSFT" && (fp === "Q1" || fp === "Q2")
      ? (row.fy as number) - 1 : row.fy;
    const expectedMonth = ticker === "MSFT"
      ? { Q1: "09", Q2: "12", Q3: "03", FY: "06" }[fp]
      : { Q1: "03", Q2: "06", Q3: "09", FY: "12" }[fp];
    if (Number(row.end.slice(0, 4)) !== expectedYear || row.end.slice(5, 7) !== expectedMonth) return [];
    const availableAt = dayMs(nextDay(row.filed));
    if (availableAt > asOfMs || dayMs(row.end) > asOfMs) return [];
    const expectedDays: Record<FactRow["fiscalPeriod"], [number, number]> = {
      Q1: [75, 110], Q2: [160, 210], Q3: [250, 305], FY: [335, 390],
    };
    const elapsed = elapsedDays(row.start, row.end);
    const [low, high] = expectedDays[fp];
    if (elapsed < low || elapsed > high) return [];
    return [{
      value: row.val as number, concept, accessionNumber: row.accn,
      form, filed: row.filed, fiscalYear: row.fy as number, fiscalPeriod: fp,
      start: row.start, end: row.end,
    }];
  });
}
function pairedComponents(
  cfo: FactRow[],
  capex: FactRow[],
): { components: SecCashFlowComponent[]; unresolved: string[] } {
  const byGroup = new Map<string, { cfo: number[]; capex: number[]; info: FactRow }>();
  for (const row of [...cfo, ...capex]) {
    const key = [row.accessionNumber,row.filed,row.fiscalYear,row.fiscalPeriod,row.start,row.end].join("|");
    const current = byGroup.get(key) ?? { cfo: [], capex: [], info: row };
    (row.concept === "NetCashProvidedByUsedInOperatingActivities" ? current.cfo : current.capex).push(row.value);
    byGroup.set(key, current);
  }
  const components: SecCashFlowComponent[] = [];
  const unresolved: string[] = [];
  for (const [key, group] of byGroup) {
    if (group.cfo.length === 0 || group.capex.length === 0) continue;
    if (new Set(group.cfo).size !== 1 || new Set(group.capex).size !== 1
      || group.capex[0] < 0) {
      unresolved.push(key + ":CONFLICTING_OR_NEGATIVE_FACT_VALUES");
      continue;
    }
    const i = group.info;
    components.push({
      accessionNumber: i.accessionNumber, form: i.form, filed: i.filed,
      fiscalYear: i.fiscalYear, fiscalPeriod: i.fiscalPeriod,
      periodStart: i.start, periodEnd: i.end,
      operatingCashFlowYtdUsd: group.cfo[0],
      cashPpeYtdUsd: group.capex[0],
    });
  }
  return { components, unresolved };
}
function orderNewest(a: SecCashFlowComponent, b: SecCashFlowComponent) {
  return b.filed.localeCompare(a.filed)
    || b.accessionNumber.localeCompare(a.accessionNumber);
}
function quarterNumber(fp: SecCashFlowComponent["fiscalPeriod"]): 1|2|3|4 {
  return fp === "Q1" ? 1 : fp === "Q2" ? 2 : fp === "Q3" ? 3 : 4;
}
function previous(fp: SecCashFlowComponent["fiscalPeriod"]) {
  return fp === "FY" ? "Q3" : fp === "Q3" ? "Q2" : fp === "Q2" ? "Q1" : null;
}
/** Do not use the SEC "latest" XBRL row as a single quarter; most CFO/capex rows are YTD. */
export function extractSecQuarterCashFlows(
  payload: unknown,
  asOf: string,
  ticker: SecCashflowIssuerTicker,
): { items: SecQuarterCashFlow[]; gaps: string[] } {
  const issuer = SEC_D1_ISSUERS[ticker];
  if (!issuer) return { items: [], gaps: ["UNKNOWN_ISSUER"] };
  const nowMs = Date.parse(asOf);
  if (!Number.isFinite(nowMs)) return { items: [], gaps: ["INVALID_AS_OF"] };
  const root = object(payload);
  if (!root || Number(root.cik) !== Number(issuer.cik)) {
    return { items: [], gaps: ["CIK_MISMATCH_OR_MISSING"] };
  }
  const entity = typeof root.entityName === "string" ? root.entityName.trim() : "";
  const normalizedEntity = entity.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!issuer.aliases.some((candidate) => candidate.toUpperCase().replace(/[^A-Z0-9]/g, "") === normalizedEntity)) {
    return { items: [], gaps: ["ENTITY_IDENTITY_MISMATCH"] };
  }
  const x = pairedComponents(
    rows(payload, "NetCashProvidedByUsedInOperatingActivities", nowMs, ticker),
    rows(payload, "PaymentsToAcquirePropertyPlantAndEquipment", nowMs, ticker),
  );
  const selected = new Map<string, SecCashFlowComponent>();
  for (const p of x.components) {
    const key = p.fiscalYear + ":" + p.fiscalPeriod + ":" + p.periodEnd;
    const old = selected.get(key);
    if (!old || orderNewest(p, old) < 0) selected.set(key,p);
  }
  const list = [...selected.values()].sort((a,b) =>
    b.periodEnd.localeCompare(a.periodEnd) || orderNewest(a,b));
  const items: SecQuarterCashFlow[] = [], gaps = [...x.unresolved];
  for (const current of list) {
    const priorPeriod = previous(current.fiscalPeriod);
    const prior = priorPeriod
      ? x.components.filter((p) => p.fiscalYear === current.fiscalYear
        && p.fiscalPeriod === priorPeriod
        && p.periodStart === current.periodStart
        && p.periodEnd < current.periodEnd
        && p.filed <= current.filed
        && elapsedDays(p.periodEnd, current.periodEnd) <= 112)
          .sort(orderNewest)[0] ?? null
      : null;
    if (priorPeriod && !prior) {
      gaps.push(current.fiscalYear + ":" + current.fiscalPeriod + ":PRIOR_FISCAL_YTD_NOT_VERIFIED");
      continue;
    }
    const qStart = prior ? nextDay(prior.periodEnd) : current.periodStart;
    if (elapsedDays(qStart,current.periodEnd) < 70 || elapsedDays(qStart,current.periodEnd)>110) {
      gaps.push(current.fiscalYear + ":" + current.fiscalPeriod + ":QUARTER_WINDOW_MISMATCH");
      continue;
    }
    const cfo = current.operatingCashFlowYtdUsd - (prior?.operatingCashFlowYtdUsd ?? 0);
    const capex = current.cashPpeYtdUsd - (prior?.cashPpeYtdUsd ?? 0);
    if (!Number.isFinite(cfo) || !Number.isFinite(capex) || capex < 0) {
      gaps.push(current.fiscalYear + ":" + current.fiscalPeriod + ":IMPLAUSIBLE_CAPEX_DELTA");
      continue;
    }
    const id = ["sec-cashflow",issuer.cik,current.fiscalYear,"Q"+quarterNumber(current.fiscalPeriod),qStart,current.periodEnd].join(":");
    const stable = {
      id,cfo,capex,accession:current.accessionNumber,prior:prior?.accessionNumber??null,
      filed:current.filed,quarterStart:qStart,quarterEnd:current.periodEnd,
      currentCfoYtd:current.operatingCashFlowYtdUsd,currentCapexYtd:current.cashPpeYtdUsd,
      priorCfoYtd:prior?.operatingCashFlowYtdUsd??0,priorCapexYtd:prior?.cashPpeYtdUsd??0,
    };
    const contentHash = createHash("sha256").update(JSON.stringify(stable)).digest("hex");
    items.push({
      issuerCik: issuer.cik, ticker, entityScope:"CONSOLIDATED", accountingBasis:"US_GAAP",
      fiscalYear:current.fiscalYear, fiscalQuarter:quarterNumber(current.fiscalPeriod),
      periodStart:qStart,periodEnd:current.periodEnd,filedDate:current.filed,
      availableAt:nextDay(current.filed)+"T00:00:00Z",
      currentAccession:current.accessionNumber,predecessorAccession:prior?.accessionNumber??null,
      cfoUsd:cfo,cashPpeUsd:capex,simpleFcfUsd:cfo-capex,
      capexToPositiveCfo:cfo>0?Number((capex/cfo).toFixed(6)):null,
      sourceUrl:issuer.secUrl,
      filingIndexUrl:"https://www.sec.gov/Archives/edgar/data/"+issuer.filingIndexCik+"/"+current.accessionNumber.replaceAll("-","")+"/",
      componentCfoYtdUsd:current.operatingCashFlowYtdUsd,componentCashPpeYtdUsd:current.cashPpeYtdUsd,
      predecessorCfoYtdUsd:prior?.operatingCashFlowYtdUsd??0,predecessorCashPpeYtdUsd:prior?.cashPpeYtdUsd??0,
      contentHash,observationIdentity:id,
    });
  }
  return { items:items.sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)).slice(0,8),gaps };
}


/** D1a public import kept stable for the existing Alphabet tests and bridge. */
export function extractAlphabetSecQuarterCashFlows(
  payload: unknown,
  asOf: string,
): { items: SecQuarterCashFlow[]; gaps: string[] } {
  return extractSecQuarterCashFlows(payload, asOf, "GOOGL");
}
