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
  kind:"SEC_XBRL"|"TEXT";
  title:string;
  summary:string;
  facts:PublicFilingMetric[];
  totalFacts:number;
  needsReview:boolean;
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
export function describePublicEvidenceClaim(value:string):PublicObservationPreview{
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
