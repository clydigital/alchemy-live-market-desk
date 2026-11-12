import {getMarketMonitor} from "@/lib/market-monitor-public";
import {projectPublicEquityCoverage} from "@/lib/bluebelly-equity-coverage";

export const dynamic="force-dynamic";
export const revalidate=300;

/** Safe for cross-origin Power Stack research clients. No private account fields.
 * Only the curated identity universe can appear in responses, never arbitrary
 * client-supplied symbols or user watchlists.
 */
export async function GET(){
 let rows:Awaited<ReturnType<typeof getMarketMonitor>>["rows"]=[];
 try{rows=(await getMarketMonitor()).rows;}
 catch(error){console.warn(JSON.stringify({event:"equity_coverage_source_unavailable",
  reason:error instanceof Error?error.message.slice(0,110):"UNAVAILABLE"}));}
 const projection=projectPublicEquityCoverage(rows);
 return Response.json(projection,{headers:{
  "Cache-Control":"public, max-age=0, s-maxage=300, stale-while-revalidate=300",
  "Access-Control-Allow-Origin":"https://clydigital.github.io",
  "Vary":"Origin",
  "X-Content-Type-Options":"nosniff",
 }});
}
