import "server-only";
import {unstable_cache} from "next/cache";
import {readFredSeries} from "./providers/fred-api-v1";
import {ACTIVE_RECESSION_SERIES,projectRecessionWatch} from "./bluebelly-recession-watch";
/** Fixed, bounded read of the existing optional FRED adapter. Shared one-hour
 * cache, no new scheduler, persistence, credentials, private data or writes.
 * No request-time arbitrary series input. Failure stays unavailable.
 */
const readFixedSeries=unstable_cache(async()=>Promise.all(
 ACTIVE_RECESSION_SERIES.map(id=>readFredSeries(id,{limit:16}))
),["bluebelly-recession-fixed-series-v1"],{revalidate:3600});
export async function getRecessionWatch(){
 const reads=await readFixedSeries().catch(()=>[]);
 return projectRecessionWatch(reads,new Date());
}
