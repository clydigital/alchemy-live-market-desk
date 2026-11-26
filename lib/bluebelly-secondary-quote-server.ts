import "server-only";
import {unstable_cache} from "next/cache";
import {SECONDARY_QUOTE_SPECS,missingSecondary,parseSecondary,recheckSecondary,type SecondaryQuote} from "./bluebelly-secondary-quote-core";
// Existing secondary Yahoo chart source family; owner-only, no live entitlement asserted.
// A single bounded request-driven batch, no retries or new scheduler.
const read=unstable_cache(async()=>{
 const result:SecondaryQuote[]=[];
 const budget=AbortSignal.timeout(10000);
 for(let i=0;i<SECONDARY_QUOTE_SPECS.length;i+=4){
  const chunk=SECONDARY_QUOTE_SPECS.slice(i,i+4);
  result.push(...await Promise.all(chunk.map(async spec=>{
   try{
    const r=await fetch("https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(spec.symbol)+"?range=1d&interval=5m",{
     headers:{accept:"application/json","user-agent":"Mozilla/5.0 Bluebelly Markets Monitor"},cache:"no-store",signal:budget
    });
    return r.ok?parseSecondary(spec,await r.json(),new Date()):missingSecondary(spec);
   }catch{return missingSecondary(spec)}
  })));
 }
 return result;
},["bb-owner-secondary-quotes-v1"],{revalidate:300});
export async function getOwnerSecondaryQuotes(){
 const rows=await read(),now=new Date();
 return rows.map(q=>recheckSecondary(q,now));
}
