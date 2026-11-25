import type {OpportunityRow} from "./power-stack-opportunity-queue.ts";
type Holding={ticker:string;name:string;quantity:number|null;currency:string;quantityAsOf:string|null};
type Quote={price:number;currency:string;observed_on:string;source_url:string;timestamp_basis:string};
const drivers:Record<string,string[]>={
 XOM:["Oil / gas prices","Refining"],"3816.KL":["Oil / gas prices","Energy shipping"],"5199.KL":["Oil / gas prices"],"5141.KL":["Oil / gas prices","Offshore services"],"6742.KL":["Electrical infrastructure","AI compute capex","Utility regulation"],"5347.KL":["Electrical infrastructure","Utility regulation"],TSLA:["Vehicle demand","AI compute capex","Autonomy execution"],TTWO:["Game bookings / recurring content"],
 CI:["Healthcare utilisation / insurance"],CVS:["Healthcare utilisation / insurance","Pharmacy"],CF:["Fertiliser / gas costs"],BWXT:["Nuclear / defence procurement"],XYL:["Water infrastructure","Industrial demand"],CVX:["Oil / gas prices","Refining"]
};
const day=(s:string|null)=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s?Date.parse(s+"T00:00:00Z"):NaN;
const source=(s:string)=>{try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&u.hostname.includes(".")}catch{return false}};
export function projectPortfolioOverlap(holdings:readonly Holding[],quotes:ReadonlyMap<string,Quote>,opportunities:readonly OpportunityRow[],canonical:(ticker:string)=>string,now=new Date()){
 const today=day(now.toISOString().slice(0,10));
 const excluded=holdings.filter(h=>h.ticker==="6742UW").map(h=>h.ticker);
 const holdingsRows=holdings.filter(h=>h.ticker!=="6742UW").map(h=>{
  const ticker=canonical(h.ticker),q=quotes.get(ticker),quantityDay=day(h.quantityAsOf),priceDay=day(q?.observed_on??null);
  const ok=!!q&&h.quantity!==null&&Number.isFinite(h.quantity)&&h.quantity>0&&Number.isFinite(q.price)&&q.price>0&&h.currency===q.currency&&/^[A-Z]{3}$/.test(q.currency)&&Number.isFinite(quantityDay)&&quantityDay<=priceDay&&priceDay<=today&&today-priceDay<=6*86400000&&q.timestamp_basis==="source_observation"&&source(q.source_url);
  const tags=drivers[ticker]??opportunities.find(o=>o.ticker===ticker)?.drivers.filter(x=>x!=="Unclassified cash-flow drivers")??[];
  return {ticker,name:h.name,quantity:h.quantity,quantityDay:h.quantityAsOf,currency:h.currency,price:ok?q!.price:null,priceDay:ok?q!.observed_on:null,sourceUrl:ok?q!.source_url:null,value:ok?h.quantity!*q!.price:null,drivers:tags};
 });
 const groups=new Map<string,typeof holdingsRows>();
 for(const r of holdingsRows){if(r.value===null)continue;const key=r.currency+"|"+r.priceDay;groups.set(key,[...(groups.get(key)??[]),r]);}
 const sleeves=[...groups.entries()].map(([key,rows])=>{const total=rows.reduce((s,r)=>s+r.value!,0);return {key,currency:rows[0].currency,priceDay:rows[0].priceDay,total,rows:rows.map(r=>({...r,weightPct:100*r.value!/total})),driverWeights:[...new Set(rows.flatMap(r=>r.drivers))].map(driver=>({driver,weightPct:100*rows.filter(r=>r.drivers.includes(driver)).reduce((s,r)=>s+r.value!,0)/total})).sort((a,b)=>b.weightPct-a.weightPct)};});
 const held=new Set(holdingsRows.map(r=>r.ticker)),heldDrivers=new Set(holdingsRows.flatMap(r=>r.drivers));
 const candidates=opportunities.map(o=>{const tags=drivers[o.ticker]??o.drivers.filter(x=>x!=="Unclassified cash-flow drivers");const overlap=tags.filter(x=>heldDrivers.has(x));return {ticker:o.ticker,company:o.company,held:held.has(o.ticker),drivers:tags,overlap,state:tags.length===0?"UNCLASSIFIED":held.has(o.ticker)?"EXISTING_EXPOSURE":overlap.length?"SHARED_DRIVERS":"DISTINCT_CLASSIFIED_DRIVERS",valuationState:o.state};});
 return {excluded,holdingsRows,sleeves,candidates,unvalued:holdingsRows.filter(r=>r.value===null).map(r=>r.ticker)};
}
