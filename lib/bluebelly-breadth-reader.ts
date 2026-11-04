import "server-only";
import {
  REVIEWED_BREADTH_SEED, parsePublishedSp500Breadth, type BreadthSeries,
} from "./bluebelly-breadth-dated";

// Small, attributed read of published computed observations. No history is
// fabricated from a quote page and no private data or new scheduler is used.
const SOURCE_URL="https://www.thetrading.tools/stocks-above-moving-average";

export async function getSourceDatedBreadth():Promise<{
  series:BreadthSeries[];
  retrievalStatus:"refreshed"|"fallback"|"mixed";
}> {
  try {
    const response=await fetch(SOURCE_URL,{
      headers:{"accept":"text/html","user-agent":"Bluebelly-Market-Research/1.0"},
      next:{revalidate:7200},signal:AbortSignal.timeout(7500),
    });
    if(response.ok){
      const parsed=parsePublishedSp500Breadth(await response.text());
      if(parsed?.length===2)return {series:parsed,retrievalStatus:"refreshed"};
    }
  } catch {
    // Fail closed on blocked, timed-out or changed upstream pages.
  }
  return {series:REVIEWED_BREADTH_SEED,retrievalStatus:"fallback"};
}
