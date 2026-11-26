import "server-only";
import {unstable_cache} from "next/cache";
import {parseSpotQuote,unavailableSpot,type SpotSymbol} from "./bluebelly-spot-quote-core";
const sources:ReadonlyArray<{symbol:SpotSymbol;url:string}>=[
 {symbol:"XAU/USD",url:"https://xaus.com/api/v1/spot?compact=1"},
 {symbol:"BTC/USD",url:"https://api.exchange.coinbase.com/products/BTC-USD/ticker"},
 {symbol:"ETH/USD",url:"https://api.exchange.coinbase.com/products/ETH-USD/ticker"}
];
// Request-driven, bounded, no paid API calls or new scheduler. No history mutation.
const read=unstable_cache(async()=>Promise.all(sources.map(async({symbol,url})=>{
 try{
  const response=await fetch(url,{headers:{accept:"application/json","user-agent":"Alchemy Live Desk"},cache:"no-store",signal:AbortSignal.timeout(5000)});
  return response.ok?parseSpotQuote(symbol,await response.json(),new Date()):unavailableSpot(symbol);
 }catch{return unavailableSpot(symbol)}
})),["bb-owner-spot-pilot-v1"],{revalidate:60});
export async function getOwnerSpotPilot(){
 const quotes=await read();
 const now=new Date();
 return quotes.map(q=>{
  if(q.state!=="fresh"||!q.asOf)return q;
  const age=+now-Date.parse(q.asOf);
  return age<0?unavailableSpot(q.symbol):age>(q.symbol==="XAU/USD"?30:5)*60000?{...q,state:"stale" as const}:q;
 });
}
