import type { VerifiedEarningsScorecard } from "./blue-desk-earnings-results.ts";
import {parseFiscalQuarter} from "./earnings/sec-quarter-facts.ts";

/** No arithmetic on editorial strings, cross-currency amounts, mismatched
 * fiscal periods, non-GAAP measures or unknown values. No owner data.
 */
export const COMPARISON_METRICS = [
 {key:"revenue",label:"Revenue",unit:"USD"},
 {key:"net_income",label:"Net income",unit:"USD"},
 {key:"diluted_eps",label:"Diluted EPS",unit:"USD/shares"},
 {key:"operating_income",label:"Operating profit / margin",unit:"USD"},
 {key:"operating_margin",label:"Operating margin",unit:"%"},
 {key:"operating_cash_flow",label:"Operating cash flow",unit:"USD"},
 {key:"capital_expenditure",label:"Capital expenditure",unit:"USD"},
 {key:"free_cash_flow",label:"Free cash flow",unit:"USD"},
 {key:"valuation",label:"Valuation / AFFO or P/E",unit:null}
] as const;
export type ComparisonKey=typeof COMPARISON_METRICS[number]["key"];
export type IssuerResultRow={id:string;ticker:string;company_name:string;fiscal_period:string;filing_day:string|null;published_at:string|null;source_retrieved_at?:string|null;source_url:string;verification_status:string};
export type IssuerFactRow={result_id:string;metric_key:string;value_numeric:number|string|null;unit:string;accounting_basis:string;period_basis:string;source_url:string;verification_status:string;captured_at:string|null};
export type ComparisonCell={state:"VERIFIED_NUMERIC"|"REVIEWED_NUMERIC"|"REVIEWED_TEXT"|"MISSING";value:number|null;unit:string|null;display:string|null;basis:string|null;sourceUrl:string|null;note:string|null};
export type ComparisonColumn={ticker:string;company:string;fiscalPeriod:string|null;releaseDay:string|null;sourceUrl:string|null;basis:string|null;state:"VERIFIED_FILING"|"REVIEWED_SCORECARD"|"UNAVAILABLE";cells:Record<ComparisonKey,ComparisonCell>;guidance:string|null;nextTest:string|null;availabilityNote?:string};
const day=(s:string|null|undefined)=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))?Date.parse(s+"T00:00:00Z"):NaN;
const sec=(s:string)=>/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/\d+\/[^?#]+$/i.test(s);
const https=(s:string)=>{try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&u.pathname!=="/";}catch{return false;}};
/** A date-only original filing may be shown after the recorded retrieval, never
 * as a publication timestamp or a same-day/backdated event. */
function receiptAvailable(r:IssuerResultRow,time:number):boolean{
 if(r.published_at!==null){
  const published=Date.parse(r.published_at);
  return Number.isFinite(published)&&published<=time;
 }
 const retrieved=Date.parse(r.source_retrieved_at??"");
 const filing=day(r.filing_day);
 return sec(r.source_url)&&Number.isFinite(retrieved)&&retrieved>=filing&&retrieved<=time&&time>=filing+86400000;
}
const missing=():ComparisonCell=>({state:"MISSING",value:null,unit:null,display:null,basis:null,sourceUrl:null,note:null});
function emptyCells():Record<ComparisonKey,ComparisonCell>{
 return Object.fromEntries(COMPARISON_METRICS.map(m=>[m.key,missing()])) as Record<ComparisonKey,ComparisonCell>;
}
export function selectIndustryPeers(allowed:readonly string[],requested?:string|string[],max=6):string[]{
 const cap=Math.max(1,Math.min(8,Math.floor(max)));
 const values=(Array.isArray(requested)?requested:[requested??""]).flatMap(s=>s.split(",")).map(s=>s.trim().toUpperCase());
 const exact=allowed.filter(t=>values.includes(t.toUpperCase()));
 return [...new Set(exact.length?exact:allowed.slice(0,cap))].slice(0,cap);
}
function display(v:number,unit:string){
 if(unit==="%")return v.toFixed(1)+"%";
 if(unit==="USD/shares")return "$"+v.toFixed(2)+"/share";
 const a=Math.abs(v);
 return a>=1e9?"$"+(v/1e9).toFixed(3)+"bn":a>=1e6?"$"+(v/1e6).toFixed(2)+"m":"$"+v.toLocaleString("en-US",{maximumFractionDigits:2});
}
const textKeys:Partial<Record<VerifiedEarningsScorecard["metrics"][number]["name"],ComparisonKey>>={
 "Revenue":"revenue","Operating profit / margin":"operating_income","Free cash flow":"free_cash_flow","Capital expenditure":"capital_expenditure",
};
export function buildIndustryComparison(tickers:readonly string[],results:readonly IssuerResultRow[],facts:readonly IssuerFactRow[],reviewed:readonly VerifiedEarningsScorecard[],now=new Date()):ComparisonColumn[]{
 const time=now.getTime(),cutoff=time-90*86400000;
 return tickers.map((ticker):ComparisonColumn=>{
  const id=ticker.toUpperCase(), cells=emptyCells();
  const rows=results.filter(r=>r.ticker.toUpperCase()===id&&["partial","verified"].includes(r.verification_status)&&
   parseFiscalQuarter(r.fiscal_period)&&day(r.filing_day)>=cutoff&&day(r.filing_day)<=time&&
   receiptAvailable(r,time))
   .sort((a,b)=>String(b.filing_day).localeCompare(String(a.filing_day))||Number(Boolean(b.published_at))-Number(Boolean(a.published_at))||String(b.published_at??b.source_retrieved_at).localeCompare(String(a.published_at??a.source_retrieved_at)));
  const score=reviewed.filter(r=>r.ticker.toUpperCase()===id&&https(r.sourceUrl)&&day(r.releaseDay)>=cutoff&&day(r.releaseDay)<=time&&
   Date.parse(r.availableNotBefore??r.releaseDay+"T00:00:00Z")<=time).sort((a,b)=>b.releaseDay.localeCompare(a.releaseDay))[0];
  const row=rows[0];
  // Select one latest report. Never silently splice two quarterly periods.
  if(row&&(!score||String(row.filing_day)>score.releaseDay||
   (row.filing_day===score.releaseDay&&score.preliminary))){
   for(const m of COMPARISON_METRICS){
    if(m.key==="operating_margin"||m.key==="valuation")continue;
    const valid=facts.filter(f=>f.result_id===row.id&&f.metric_key===m.key&&f.verification_status==="verified"&&
     f.period_basis==="fiscal_quarter"&&f.unit===m.unit&&sec(f.source_url)&&
     (f.accounting_basis==="SEC_US_GAAP"||
      (["operating_cash_flow","capital_expenditure","free_cash_flow"].includes(m.key)&&f.accounting_basis==="SEC_US_GAAP_DERIVED"))&&
     f.value_numeric!==null&&String(f.value_numeric).trim()!==""&&Number.isFinite(Number(f.value_numeric))&&
     Number.isFinite(Date.parse(f.captured_at??""))&&Date.parse(f.captured_at??"")<=time);
    // A conflicting value or source cannot become a selected observation.
    if(!valid.length||valid.some(f=>Number(f.value_numeric)!==Number(valid[0].value_numeric)||f.accounting_basis!==valid[0].accounting_basis||f.source_url!==valid[0].source_url))continue;
    const f=valid[0],value=Number(f.value_numeric);
    if(m.key==="revenue"&&value<0)continue;
    cells[m.key]={state:"VERIFIED_NUMERIC",value,unit:f.unit,display:display(value,f.unit),basis:f.accounting_basis,sourceUrl:f.source_url,note:"Quarter-specific verified filing fact"};
   }
   const a=cells.revenue,b=cells.operating_income;
   if(a.state==="VERIFIED_NUMERIC"&&b.state==="VERIFIED_NUMERIC"&&a.value!==null&&a.value>0&&b.value!==null&&a.sourceUrl===b.sourceUrl){
    const value=100*b.value/a.value;
    cells.operating_margin={state:"VERIFIED_NUMERIC",value,unit:"%",display:display(value,"%"),basis:"Derived from matched GAAP revenue and operating income",sourceUrl:a.sourceUrl,note:"Same result and filing; not gross margin"};
   }
   const source=Object.values(cells).find(c=>c.sourceUrl)?.sourceUrl??null;
   return {ticker,company:row.company_name,fiscalPeriod:row.fiscal_period,releaseDay:row.filing_day,sourceUrl:source,basis:"Quarter-specific SEC US-GAAP facts; missing metrics are not zero",availabilityNote:row.published_at===null?"Filing date only; evidence retrieved "+new Date(row.source_retrieved_at!).toISOString()+". Exact publication time unknown.":undefined,state:source?"VERIFIED_FILING":"UNAVAILABLE",cells,guidance:null,nextTest:"Verify missing fields in the same original filing; reconcile current price and valuation separately."};
  }
  if(score){
   for(const metric of score.metrics){
    const key=textKeys[metric.name];
    if(!key||metric.state!=="measured"||!metric.value)continue;
    cells[key]={state:"REVIEWED_TEXT",value:null,unit:null,display:metric.value,basis:score.basis,sourceUrl:score.sourceUrl,note:[metric.comparison,metric.note].filter(Boolean).join(" · ")||null};
   }
   for(const f of score.numericQuarterFacts??[]){
    const m=COMPARISON_METRICS.find(k=>k.key===f.key);
    if(!m||m.unit!==f.unit||!Number.isFinite(f.value)||!f.basis.trim()||
     !Number.isFinite(day(f.periodEnd))||day(f.periodEnd)>day(score.releaseDay)||
     day(score.releaseDay)-day(f.periodEnd)>180*86400000)continue;
    cells[f.key]={state:"REVIEWED_NUMERIC",value:f.value,unit:f.unit,display:display(f.value,f.unit),basis:f.basis,sourceUrl:score.sourceUrl,note:"Quarter ended "+f.periodEnd+" · "+f.note};
   }
   return {ticker,company:score.company,fiscalPeriod:score.fiscalPeriod,releaseDay:score.releaseDay,sourceUrl:score.sourceUrl,basis:score.basis,state:"REVIEWED_SCORECARD",cells,guidance:score.outlook,nextTest:score.nextTest};
  }
  return {ticker,company:ticker,fiscalPeriod:null,releaseDay:null,sourceUrl:null,basis:null,state:"UNAVAILABLE",cells,guidance:null,nextTest:"Retrieve original issuer results, period and accounting basis."};
 });
}
