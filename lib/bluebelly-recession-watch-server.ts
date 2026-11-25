import "server-only";
import {unstable_cache} from "next/cache";
import {readFredSeries} from "./providers/fred-api-v1";
import {ACTIVE_RECESSION_SERIES,projectRecessionWatch} from "./bluebelly-recession-watch";
/** Fixed, bounded read of the existing optional FRED adapter. Shared one-hour
 * cache, no new scheduler, persistence, credentials, private data or writes.
 * No request-time arbitrary series input. Failure stays unavailable.
 */
const readFixedSeries=unstable_cache(async()=>{
 // Bound cold-cache fan-out and retain successful independent observations.
 const reads:Awaited<ReturnType<typeof readFredSeries>>[]=[];
 for(let i=0;i<ACTIVE_RECESSION_SERIES.length;i+=4){
  const batch=await Promise.allSettled(ACTIVE_RECESSION_SERIES.slice(i,i+4).map(id=>readFredSeries(id,{limit:16})));
  for(const result of batch)if(result.status==="fulfilled")reads.push(result.value);
 }
 return reads;
},["bluebelly-recession-fixed-series-v1"],{revalidate:3600});
export async function getRecessionWatch(){
 const reads=await readFixedSeries().catch(()=>[]);
 return projectRecessionWatch(reads,new Date());
}
