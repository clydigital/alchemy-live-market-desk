import "server-only";
import {unstable_cache} from "next/cache";
import {decodeNasdaqQqqShortInterest,type ShortPosition} from "./bluebelly-qqq-positioning-core";
export const QQQ_SI_SOURCE="https://www.nasdaq.com/market-activity/etf/qqq/short-interest";
const endpoint="https://api.nasdaq.com/api/quote/QQQ/short-interest?assetclass=etf";
const read=unstable_cache(async():Promise<{rows:ShortPosition[];checkedAt:string}>=>{
 const checkedAt=new Date().toISOString();
 try{
  const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(5000),cache:"no-store"});
  if(!response.ok)throw new Error("QQQ short-interest source unavailable");
  const rows=decodeNasdaqQqqShortInterest(await response.json(),new Date(checkedAt));
  if(!rows.length)throw new Error("QQQ short-interest source returned no valid rows");
  return {rows,checkedAt};
 }catch{throw new Error("QQQ short-interest refresh failed");}
},["bluebelly-qqq-short-interest-v1"],{revalidate:21600});
export async function readQqqPositioning(){
 try{return await read();}catch{return {rows:[],checkedAt:new Date().toISOString()};}
}
