import "server-only";
import {unstable_cache} from "next/cache";
import {decodeHormuzIncidents,type HormuzIncidentRead} from "./bluebelly-hormuz-incidents-core";

/** Read-only, 30-minute cached upstream; no new cron, canonical writes or auth exposure. */
export const HORMUZ_INCIDENTS_SOURCE="https://hormuz.data-tracking.net/api/incidents";
async function readSource():Promise<unknown>{
 const response=await fetch(HORMUZ_INCIDENTS_SOURCE,{
  redirect:"error",headers:{Accept:"application/json"},
  next:{revalidate:1800},signal:AbortSignal.timeout(12000),
 });
 if(!response.ok||!(response.headers.get("content-type")||"").toLowerCase().includes("json"))
  throw new Error("Incident feed unavailable");
 const length=Number(response.headers.get("content-length"));
 if(Number.isFinite(length)&&length>180000)throw new Error("Incident payload too large");
 const body=await response.text();
 if(body.length>180000)throw new Error("Incident payload too large");
 return JSON.parse(body) as unknown;
}
const cached=unstable_cache(readSource,["hormuz-ukmto-reports-30m-v1"],{revalidate:1800});
export async function getHormuzIncidents(now=new Date()):Promise<HormuzIncidentRead>{
 try{
  return decodeHormuzIncidents(await cached(),now);
 }catch{
  return {checkedAt:now.toISOString(),builtAt:null,freshness:"unavailable",
   reports:[],totalWindow:0,reason:"Original incident feed unavailable. Do not infer no attacks."};
 }
}
