import { META_FY26_Q3_IR } from "./dossier-v2/sec-cashflow-disclosure.ts";

/**
 * Reader-only interpretation of an existing SEC XBRL observation claim.
 * No metric is recomputed, joined to another period or admitted as new evidence.
 * Failed parsing retains the original raw claim behind an explicit audit toggle.
 */
export type PublicFilingMetric = {
  concept:string; label:string; value:string; valueLabel:string;
  period:string; filed:string; form:string; accession:string;
};
export type PublicObservationPreview = {
  kind:"SEC_XBRL"|"SEC_CASHFLOW"|"TEXT";
  title:string;
  summary:string;
  facts:PublicFilingMetric[];
  totalFacts:number;
  needsReview:boolean;
  /** Additional issuer IR source, NOT part of the original SEC Evidence UUID. */
  issuerComparison?: { title:string; detail:string; sourceName:string; sourceUrl:string };
};
const CONCEPT_LABELS:Record<string,string>={
  RevenueFromContractWithCustomerExcludingAssessedTax:"Revenue",
  Revenues:"Revenue",
  SalesRevenueNet:"Net sales",
  OperatingIncomeLoss:"Operating income (loss)",
  NetIncomeLoss:"Net income (loss)",
  ProfitLoss:"Profit (loss)",
  NetCashProvidedByUsedInOperatingActivities:"Operating cash flow",
  PaymentsToAcquirePropertyPlantAndEquipment:"Purchases of property and equipment",
  CashAndCashEquivalentsAtCarryingValue:"Cash and cash equivalents",
  Assets:"Total assets",
  Liabilities:"Total liabilities",
  LongTermDebt:"Long-term debt",
  LongTermDebtCurrent:"Current portion of long-term debt",
  StockholdersEquity:"Shareholders' equity",
};
const PRIORITIES=[
  "RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet",
  "OperatingIncomeLoss","NetIncomeLoss","ProfitLoss",
  "NetCashProvidedByUsedInOperatingActivities",
  "PaymentsToAcquirePropertyPlantAndEquipment","CashAndCashEquivalentsAtCarryingValue",
  "LongTermDebtCurrent","LongTermDebt","Assets","Liabilities","StockholdersEquity",
];
const FACT=/([A-Za-z][A-Za-z0-9]+):\s*(-?\d+(?:\.\d+)?)\s+USD;\s*period\s+((?:instant\s+to\s+)?\d{4}-\d{2}-\d{2}(?:\s+to\s+\d{4}-\d{2}-\d{2})?);\s*filed\s+(\d{4}-\d{2}-\d{2});\s*form\s+(10-[KQ]);\s*accession\s+(\d{10}-\d{2}-\d{6})\./g;
function numberAsReported(value:string):string{
  const amount=Number(value);
  if(!Number.isFinite(amount)||!Number.isSafeInteger(amount)||!/^[-]?\d+$/.test(value)) return value+" USD";
  if(Math.abs(amount)>=1e9) return "US$"+new Intl.NumberFormat("en-GB",{maximumFractionDigits:2}).format(amount/1e9)+"bn";
  if(Math.abs(amount)>=1e6) return "US$"+new Intl.NumberFormat("en-GB",{maximumFractionDigits:2}).format(amount/1e6)+"m";
  return "US$"+new Intl.NumberFormat("en-GB",{maximumFractionDigits:0}).format(amount);
}
function humanDate(s:string):string{
  const ts=Date.parse(s+"T00:00:00Z");
  if(!Number.isFinite(ts)||new Date(ts).toISOString().slice(0,10)!==s) return s;
  return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(ts));
}
function periodDisplay(raw:string):string{
  const match=/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/.exec(raw);
  return match?"From "+humanDate(match[1])+" to "+humanDate(match[2]):
    "As at "+humanDate(raw.replace(/^instant\s+to\s+/,""));
}
function previewRawText(value:string):PublicObservationPreview{
  const text=value.trim().replace(/\s+/g," ");
  // No invented abstraction for free-form claims: shorten the visual excerpt
  // and expose the entire exact claim separately in a native <details>.
  return {kind:"TEXT",title:"Original-source observation",
    summary:text.length>230?text.slice(0,227).trimEnd()+"…":text,
    facts:[],totalFacts:0,needsReview:false};
}

export type PublicEvidenceClock = {
  sourceName?:string; sourceUrl?:string; availableAt?:string|null; editionAsOf?:string|null;
};
const QUARTERIZED_SEC = /^(.{3,80}?) consolidated FY(20\d{2}) Q([1-4]) CFO \$(-?\d+); cash PP&E \$(-?\d+); simple FCF \(CFO minus cash PP&E\) \$(-?\d+) \(USD; quarter ended (\d{4}-\d{2}-\d{2})\)\. SEC XBRL values use filed (\d{4}-\d{2}-\d{2}) and (prior-quarter fiscal-YTD subtraction|direct Q1 quarter)\. Excludes separately disclosed finance-lease principal; NOT AI-only cash flow or Story causality\.$/;
function billion(value:number):string {
  return (value<0?"−":"")+"US$"+(Math.abs(value)/1e9).toFixed(3)+"bn";
}
function previewSecQuarterCashflow(value:string,context:PublicEvidenceClock):PublicObservationPreview|null{
  const m=QUARTERIZED_SEC.exec(value.trim());
  if(!m)return null;
  const [cfo,cashPpe,fcf]=[Number(m[4]),Number(m[5]),Number(m[6])];
  if(![cfo,cashPpe,fcf].every(Number.isSafeInteger)||cfo-cashPpe!==fcf||cashPpe<0) return null;
  const period="Quarter ended "+humanDate(m[7]),filed=humanDate(m[8]);
  const fact=(concept:string,label:string,n:number):PublicFilingMetric=>({
    concept,label,value:String(n),valueLabel:billion(n),period,filed,
    form:m[9]==="direct Q1 quarter"?"10-Q":"10-Q",accession:"See original SEC evidence",
  });
  const originalSecIsMetaQ3=m[1]==="Meta Platforms, Inc."&&m[2]==="2026"&&m[3]==="3"
    &&m[7]==="2026-09-30"&&m[8]==="2026-10-22"
    &&m[9]==="prior-quarter fiscal-YTD subtraction"
    &&cfo===32_785_000_000&&cashPpe===33_942_000_000&&fcf===-1_157_000_000;
  // Source identity AND publication time gates prevent an anonymous pasted
  // lookalike claim or a post-dated source from enriching a frozen edition.
  const verifiedSecSource=context.sourceName==="U.S. Securities and Exchange Commission"
    &&context.sourceUrl==="https://data.sec.gov/api/xbrl/companyfacts/CIK0001326801.json";
  const editionMs=Date.parse(context.editionAsOf||"");
  const evidenceMs=Date.parse(context.availableAt||"");
  const comparedAt=Date.parse("2026-10-22T00:00:00Z");
  const comparisonEligible=originalSecIsMetaQ3&&verifiedSecSource
    &&Number.isFinite(editionMs)&&Number.isFinite(evidenceMs)
    &&editionMs>=evidenceMs&&evidenceMs>=comparedAt
    &&META_FY26_Q3_IR.operatingCashFlowUsd-META_FY26_Q3_IR.cashPpeUsd
      -META_FY26_Q3_IR.financeLeasePrincipalUsd===META_FY26_Q3_IR.reportedFcfUsd;
  return {
    kind:"SEC_CASHFLOW",
    title:m[1]+" — consolidated cash flow (SEC-derived)",
    summary:"Quarterly SEC fiscal-YTD subtraction. Simple FCF excludes finance-lease principal and must not be described as the issuer's reported FCF. Neither value isolates AI spending or proves a market reaction.",
    facts:[
      fact("sec_quarter_cfo","Operating cash flow — SEC-derived",cfo),
      fact("sec_cash_ppe","Cash purchases of PP&E",cashPpe),
      fact("sec_simple_fcf","Simple FCF — excludes finance-lease principal",fcf),
    ],
    totalFacts:3,needsReview:false,
    ...(comparisonEligible?{issuerComparison:{
      title:"Meta's separately reported Q3 free cash flow",
      detail:"Issuer-defined non-GAAP FCF "+billion(META_FY26_Q3_IR.reportedFcfUsd)
        +" = direct-quarter CFO "+billion(META_FY26_Q3_IR.operatingCashFlowUsd)
        +" − cash PP&E "+billion(META_FY26_Q3_IR.cashPpeUsd)
        +" − finance-lease principal "+billion(META_FY26_Q3_IR.financeLeasePrincipalUsd)
        +". Direct-quarter CFO is US$0.001bn above the SEC fiscal-YTD difference. The cause of this discrepancy is not established. This separate issuer disclosure is contextual, not additional evidence in the frozen Story.",
      sourceName:"Meta Platforms — Q3 2026 earnings release",
      sourceUrl:META_FY26_Q3_IR.sourceUrl,
    }}:{}),
  };
}

export function describePublicEvidenceClaim(value:string, context:PublicEvidenceClock = {}):PublicObservationPreview{
  const quarter=previewSecQuarterCashflow(value,context);
  if(quarter)return quarter;
  if(!/\. SEC XBRL observations;/.test(value))return previewRawText(value);
  const prefix=value.slice(0,value.indexOf(". SEC XBRL observations;")).trim();
  if(!prefix||prefix.length>100)return previewRawText(value);
  const matches=[...value.matchAll(FACT)].slice(0,45);
  const parsed:PublicFilingMetric[]=matches.map(m=>({
    concept:m[1],label:CONCEPT_LABELS[m[1]]||"Other reported metric ("+m[1]+")",
    value:m[2],valueLabel:numberAsReported(m[2]),period:periodDisplay(m[3]),
    filed:humanDate(m[4]),form:m[5],accession:m[6],
  }));
  const facts=parsed
    .filter(m=>Object.prototype.hasOwnProperty.call(CONCEPT_LABELS,m.concept))
    .sort((a,b)=>PRIORITIES.indexOf(a.concept)-PRIORITIES.indexOf(b.concept))
    .slice(0,6);
  if(!facts.length)return {
    kind:"SEC_XBRL",title:prefix+" — SEC filing",
    summary:"Structured observations available. No recognised metric could be safely displayed; check the original filing.",
    facts:[],totalFacts:parsed.length,needsReview:true,
  };
  const clocks=new Set(parsed.map(m=>m.period+"|"+m.filed+"|"+m.accession));
  return {
    kind:"SEC_XBRL",title:prefix+" — SEC filing",
    summary:parsed.length+" reported financial observations · "+facts.length+" shown. "+
      (clocks.size>1?"Different reporting dates or filings appear. Do not combine them.":"Each metric retains its reporting period."),
    facts,totalFacts:parsed.length,needsReview:clocks.size>1,
  };
}
