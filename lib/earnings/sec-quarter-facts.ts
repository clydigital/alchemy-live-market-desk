/** Conservative SEC XBRL earnings extraction. Financial facts only; no
 * analyst consensus, issuer guidance, inferred quarterly CFO or stock moves.
 * Data must belong to one issuer, fiscal quarter and SEC filing accession.
 */
export type SecEarningsMetric = {
  key:"revenue"|"diluted_eps"|"operating_income";
  value:number;unit:"USD"|"USD/shares";tag:string;
  accession:string;filed:string;start:string;end:string;
};
export type SecEarningsQuarter = {
  ticker:string;company:string;fiscalPeriod:string;cik:string;
  accession:string;filed:string;periodEnd:string;filingUrl:string;
  metrics:SecEarningsMetric[];
};
type Obj=Record<string,unknown>;
const obj=(x:unknown):Obj|null=>x!==null&&typeof x==="object"&&!Array.isArray(x)?x as Obj:null;
export function parseFiscalQuarter(value:string):{quarter:number;year:number}|null{
 const q=/(?:^|\s)Q([1-4])(?:\s+(?:FY)?(20\d\d|\d\d))|(?:^|\s)FY(20\d\d|\d\d)\s+Q([1-4])/i.exec(value);
 if(!q)return null;
 const quarter=Number(q[1]||q[4]),raw=q[2]||q[3];
 const year=Number(raw.length===2?"20"+raw:raw);
 return year>=2000&&year<=2100?{quarter,year}:null;
}
function civilDay(s:unknown):number|null{
 if(typeof s!=="string"||!/^\d{4}-\d\d-\d\d$/.test(s))return null;
 const n=Date.parse(s+"T00:00:00Z");
 return Number.isFinite(n)&&new Date(n).toISOString().startsWith(s)?n:null;
}
const TAGS:Record<SecEarningsMetric["key"],readonly string[]>={
 revenue:["RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet"],
 diluted_eps:["EarningsPerShareDiluted"],
 operating_income:["OperatingIncomeLoss"],
};
const UNIT:Record<SecEarningsMetric["key"],SecEarningsMetric["unit"]>={
 revenue:"USD",diluted_eps:"USD/shares",operating_income:"USD",
};
type RawFact={tag:string;val:number;start:string;end:string;filed:string;accn:string};
function allCandidates(
 usgaap:Obj,key:SecEarningsMetric["key"],
 quarter:{year:number;quarter:number},due:string,now:string,
):RawFact[]{
 if(quarter.quarter===4)return []; // 10-K fiscal-year totals are NOT a Q4 result.
 const dueMs=civilDay(due),nowMs=civilDay(now);
 if(dueMs===null||nowMs===null)return [];
 const out:RawFact[]=[];
 for(const tag of TAGS[key]){
  const entry=obj(usgaap[tag]),units=obj(entry?.units);
  const list=units?.[UNIT[key]];
  if(!Array.isArray(list))continue;
  for(const raw of list){
   const r=obj(raw);if(!r)continue;
   if(r.form!=="10-Q"||r.fp!=="Q"+quarter.quarter||r.fy!==quarter.year)continue;
   if(typeof r.accn!=="string"||!/^\d{10}-\d\d-\d{6}$/.test(r.accn))continue;
   const start=civilDay(r.start),end=civilDay(r.end),filed=civilDay(r.filed);
   if(start===null||end===null||filed===null)continue;
   const duration=(end-start)/86400000+1;
   if(duration<70||duration>112||end>dueMs+7*86400000||dueMs-end>210*86400000)continue;
   // Require contemporary filing, rather than an old comparative XBRL row.
   if(filed<dueMs-14*86400000||filed>nowMs||typeof r.val!=="number"||!Number.isFinite(r.val))continue;
   if(key==="revenue"&&r.val<0)continue;
   out.push({tag,val:r.val,start:r.start as string,end:r.end as string,filed:r.filed as string,accn:r.accn});
  }
  // One preferred taxonomy concept per metric; never add alternate revenue tags.
  if(out.length)break;
 }
 return out;
}
/** Does not trust the candidate ticker from an issuer's HTML or an LLM.
 * The SEC CIK comes from an independently fetched SEC ticker registry.
 */
export function extractSecEarningsQuarter(input:{
 payload:unknown;ticker:string;cik:number|string;
 fiscalPeriod:string;dueDay:string;asOfDay:string;
}):SecEarningsQuarter|null{
 const root=obj(input.payload),expect=parseFiscalQuarter(input.fiscalPeriod);
 if(!root||!expect||expect.quarter===4)return null;
 const normalizedCik=String(input.cik).replace(/\D/g,"").padStart(10,"0");
 if(!normalizedCik||Number(root.cik)!==Number(normalizedCik))return null;
 const gaap=obj(obj(root.facts)?.["us-gaap"]);
 if(!gaap)return null;
 const candidates={
  revenue:allCandidates(gaap,"revenue",expect,input.dueDay,input.asOfDay),
  diluted_eps:allCandidates(gaap,"diluted_eps",expect,input.dueDay,input.asOfDay),
  operating_income:allCandidates(gaap,"operating_income",expect,input.dueDay,input.asOfDay),
 };
 const anchors=[...candidates.revenue,...candidates.diluted_eps].sort((a,b)=>
  b.filed.localeCompare(a.filed)||b.accn.localeCompare(a.accn));
 for(const anchor of anchors){
  const metrics:SecEarningsMetric[]=[];
  let conflict=false;
  for(const key of ["revenue","diluted_eps","operating_income"] as const){
   const matches=candidates[key].filter(r=>r.accn===anchor.accn
     &&r.start===anchor.start&&r.end===anchor.end&&r.filed===anchor.filed);
   const values=new Set(matches.map(r=>r.val));
   if(values.size>1){conflict=true;break;}
   if(matches[0])metrics.push({
    key,value:matches[0].val,unit:UNIT[key],tag:matches[0].tag,
    accession:anchor.accn,filed:anchor.filed,start:anchor.start,end:anchor.end,
   });
  }
  if(conflict||!metrics.some(m=>m.key==="revenue"||m.key==="diluted_eps"))continue;
  const ticker=input.ticker.trim().toUpperCase();
  if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(ticker))return null;
  return {
   ticker,company:typeof root.entityName==="string"?root.entityName:ticker,
   fiscalPeriod:input.fiscalPeriod,cik:normalizedCik,
   accession:anchor.accn,filed:anchor.filed,periodEnd:anchor.end,
   filingUrl:"https://www.sec.gov/Archives/edgar/data/"+Number(normalizedCik)+"/"+anchor.accn.replaceAll("-","")+"/",
   metrics,
  };
 }
 return null;
}
