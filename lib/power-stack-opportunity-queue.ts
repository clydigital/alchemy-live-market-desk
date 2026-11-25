import type {PublicEquityCoverageRow} from "./bluebelly-equity-coverage.ts";
import type {FundamentalRow} from "./bluebelly-fundamental-comparison.ts";
import type {IssuerReviewResult} from "./power-stack-issuer-valuation.ts";
import {entryCeilings} from "./power-stack-accumulation-gate.ts";
/** Owner-only read projection. Never changes the public universe, owner holdings,
 * scenario reviews or price stores. A range is not a base/bear model. */
const drivers:Record<string,string[]>={
 NVDA:["AI compute capex"],AMD:["AI compute capex"],AVGO:["AI compute capex","Enterprise software"],MU:["Memory cycle","AI compute capex"],
 DELL:["AI compute capex","Enterprise hardware"],CRWV:["AI compute capex","Refinancing"],ORCL:["AI compute capex","Enterprise software","Refinancing"],SPCX:["Space / connectivity","AI compute capex"],
 ETN:["Electrical infrastructure","AI compute capex"],PWR:["Electrical infrastructure","AI compute capex"],CI:["Healthcare utilisation / insurance"],CVS:["Healthcare utilisation / insurance","Pharmacy"],
 MAA:["Apartment rents","Property financing"],ESS:["Apartment rents","Property financing"],CPT:["Apartment rents","Property financing"],
 INVH:["Single-family rents","Property financing"],AMH:["Single-family rents","Property financing"],
 PHM:["Homebuyer affordability","Housing construction"],TOL:["Homebuyer affordability","Housing construction"],NVR:["Homebuyer affordability","Housing construction"],
 JLL:["Property transactions","Property financing"],CBRE:["Property transactions","Property financing"],RKT:["Mortgage origination","Property financing"],
 XOM:["Oil / gas prices","Refining"],CVX:["Oil / gas prices","Refining"],CF:["Fertiliser / gas costs"],BWXT:["Nuclear / defence procurement"],TTWO:["Game bookings / recurring content"]
};
const d=(v:string|null)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v?Date.parse(v+"T00:00:00Z"):NaN;
const url=(s:string|null)=>{try{const u=new URL(s??"");return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&u.hostname.includes(".")}catch{return false}};
const pos=(v:number|null):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>0;
export type OpportunityRow={
 ticker:string;company:string;theme:string;currency:string;drivers:string[];scope:"BB_UNIVERSE"|"OWNER_ONLY_GAP";
 price:number|null;priceDay:string|null;priceSource:string|null;fundamental:FundamentalRow|null;
 model:IssuerReviewResult|null;rangeUpsidePct:number|null;upsideCeiling:number|null;discountCeiling:number|null;
 state:"RANGE_RESEARCH"|"RISK_REVIEW"|"EVIDENCE_GAP"|"MISSING_MODEL"|"MISSING_PRICE"|"OUTSIDE_BB";
 gaps:string[];
};
export function projectOpportunityQueue(quotes:readonly PublicEquityCoverageRow[],fundamentals:readonly FundamentalRow[],reviews:readonly IssuerReviewResult[],ownerAssets:readonly {ticker:string;name:string}[],now=new Date()){
 const current=now.getTime(),day=d(now.toISOString().slice(0,10)),fmap=new Map(fundamentals.map(f=>[f.ticker,f])),rmap=new Map(reviews.map(r=>[r.ticker,r]));
 const rows:OpportunityRow[]=quotes.map(q=>{
  const time=d(q.asOf),priceOK=q.status==="SOURCE_DATED"&&pos(q.price)&&Number.isFinite(time)&&time<=day&&day-time<=6*86400000&&url(q.sourceUrl);
  const f=fmap.get(q.ticker)??null,raw=rmap.get(q.ticker)??null;
  // Existing accepted owner review is reused only with a compatible, non-older BB price.
  const model=raw&&priceOK&&raw.currency===q.currency&&d(raw.priceObservedOn)<=time&&
   (raw.priceObservedOn!==q.asOf||Math.abs(raw.marketPrice/q.price!-1)<=.01)&&
   pos(raw.valuationLow)&&pos(raw.valuationHigh)&&raw.valuationLow<=raw.valuationHigh&&
   Number.isFinite(Date.parse(raw.reviewedAt))&&Date.parse(raw.reviewedAt)<=current&&current-Date.parse(raw.reviewedAt)<=45*86400000?raw:null;
  const gaps:string[]=[];
  if(!priceOK)gaps.push("Eligible Bluebelly daily quote unavailable");
  if(!f||f.status!=="CURRENT"||!f.facts.length)gaps.push("Recent verified issuer facts unavailable");
  if(!model)gaps.push("Compatible reviewed valuation range unavailable");
  gaps.push("Separate numerical base/bear and full cash/debt/earnings evidence required");
  const rangeUpsidePct=model&&priceOK?100*(model.valuationLow/q.price!-1):null;
  const ceilings=model?entryCeilings(model.valuationLow):null;
  return {ticker:q.ticker,company:q.company,theme:q.theme,currency:q.currency,drivers:drivers[q.ticker]??["Unclassified cash-flow drivers"],scope:"BB_UNIVERSE",price:priceOK?q.price:null,priceDay:priceOK?q.asOf:null,priceSource:priceOK?q.sourceUrl:null,fundamental:f,model,rangeUpsidePct,upsideCeiling:ceilings?.upsideCeiling??null,discountCeiling:ceilings?.discountCeiling??null,state:!priceOK?"MISSING_PRICE":!model?"MISSING_MODEL":model.riskFlags.length?"RISK_REVIEW":!f||f.status!=="CURRENT"||!f.facts.length?"EVIDENCE_GAP":"RANGE_RESEARCH",gaps};
 });
 const seen=new Set(rows.map(r=>r.ticker));
 for(const a of ownerAssets){if(seen.has(a.ticker))continue;seen.add(a.ticker);rows.push({ticker:a.ticker,company:a.name,theme:"UNMAPPED",currency:"",drivers:drivers[a.ticker]??["Unclassified cash-flow drivers"],scope:"OWNER_ONLY_GAP",price:null,priceDay:null,priceSource:null,fundamental:null,model:null,rangeUpsidePct:null,upsideCeiling:null,discountCeiling:null,state:"OUTSIDE_BB",gaps:["Not in shared Bluebelly equity universe; no private quote substitution"]});}
 // Order a research queue, never an expected-return ranking. Missing and flagged
 // models are not promoted; cross-industry upside is scenario arithmetic only.
 const order={RANGE_RESEARCH:0,RISK_REVIEW:1,EVIDENCE_GAP:2,MISSING_MODEL:3,MISSING_PRICE:4,OUTSIDE_BB:5};
 return rows.sort((a,b)=>order[a.state]-order[b.state]||(a.state==="RANGE_RESEARCH"&&b.state==="RANGE_RESEARCH"?(b.rangeUpsidePct??-Infinity)-(a.rangeUpsidePct??-Infinity):0)||a.ticker.localeCompare(b.ticker));
}
