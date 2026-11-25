import type {PegResearchObservation} from "./power-stack-peg-research.ts";
/** Compare archived retrievals only; not a reconstructed analyst publication history.
 * Exact matching fiscal periods, provider identity and currency are required.
 * Price change and multiple change use the original quote in each snapshot.
 */
const day=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s?Date.parse(s+"T00:00:00Z"):NaN;
const time=(s:string)=>/T| /.test(s)&&/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(s)?Date.parse(s):NaN;
const n=(v:unknown)=>typeof v==="number"||typeof v==="string"&&v.trim()?Number(v):NaN;
const url=(s:string)=>{try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&u.hostname.includes(".")}catch{return false}};
const provider=(r:PegResearchObservation)=>r.forecast_source.trim().toLowerCase()+"|"+r.forecast_source_url.trim();
export type EstimateHistoryRow={ticker:string;latest:PegResearchObservation;prior:PegResearchObservation|null;state:"RETRIEVAL_COMPARISON"|"NO_COMPARABLE_PRIOR";firstChangePct:number|null;secondChangePct:number|null;priceChangePct:number|null;nextFYMultiple:number;priorNextFYMultiple:number|null;multipleChangePct:number|null;historyCount:number};
export function projectEstimateHistory(records:readonly PegResearchObservation[],now=new Date()):EstimateHistoryRow[]{
 const today=now.getTime();
 const valid=records.filter(r=>{
  const t=time(r.retrieved_at),q=day(r.quote_observed_on),a=day(r.forecast_first_fy_end),b=day(r.forecast_second_fy_end);
  return /^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(r.ticker)&&Number.isFinite(t)&&t<=today&&Number.isFinite(q)&&q<=t&&a>q&&b-a>=300*86400000&&b-a<=430*86400000&&r.quote_currency===r.estimate_currency&&/^[A-Z]{3}$/.test(r.quote_currency)&&[r.quote_price,r.eps_first_fy,r.eps_second_fy].every(v=>Number.isFinite(n(v))&&n(v)>0)&&!!r.forecast_source.trim()&&url(r.forecast_source_url)&&!!r.quote_source.trim()&&(r.estimate_native_updated_at===null||Number.isFinite(time(r.estimate_native_updated_at))&&time(r.estimate_native_updated_at)<=t);
 }).sort((a,b)=>time(b.retrieved_at)-time(a.retrieved_at));
 const tickers=[...new Set(valid.map(r=>r.ticker))];
 const pct=(a:number,b:number)=>100*(a/b-1);
 return tickers.map(ticker=>{
  const all=valid.filter(r=>r.ticker===ticker),latest=all[0];
  const prior=all.find(r=>time(r.retrieved_at)<time(latest.retrieved_at)&&provider(r)===provider(latest)&&r.forecast_first_fy_end===latest.forecast_first_fy_end&&r.forecast_second_fy_end===latest.forecast_second_fy_end&&r.estimate_currency===latest.estimate_currency)??null;
  const multiple=n(latest.quote_price)/n(latest.eps_second_fy),priorMultiple=prior?n(prior.quote_price)/n(prior.eps_second_fy):null;
  const matchedPrice=prior!==null&&prior.quote_source===latest.quote_source&&day(prior.quote_observed_on)<=day(latest.quote_observed_on)&&n(latest.quote_price)/n(prior.quote_price)>=.4&&n(latest.quote_price)/n(prior.quote_price)<=2.5;
  return {ticker,latest,prior,state:prior?"RETRIEVAL_COMPARISON":"NO_COMPARABLE_PRIOR",firstChangePct:prior?pct(n(latest.eps_first_fy),n(prior.eps_first_fy)):null,secondChangePct:prior?pct(n(latest.eps_second_fy),n(prior.eps_second_fy)):null,priceChangePct:matchedPrice?pct(n(latest.quote_price),n(prior!.quote_price)):null,nextFYMultiple:multiple,priorNextFYMultiple:priorMultiple,multipleChangePct:matchedPrice&&priorMultiple!==null?pct(multiple,priorMultiple):null,historyCount:all.length};
 }).sort((a,b)=>a.ticker.localeCompare(b.ticker));
}
