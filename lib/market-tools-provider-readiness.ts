import "server-only";
import { unstable_cache } from "next/cache";
import { readFredSeries } from "@/lib/providers/fred-api-v1";
import { fetchEiaWeeklyPetroleumSnapshot } from "@/lib/providers/eia-v2";
import { readAlphaVantageDailyPilot } from "@/lib/providers/alpha-vantage-daily-pilot";

export type ProviderReadiness = {
 provider:"FRED/ALFRED"|"EIA Open Data"|"Alpha Vantage";
 state:"ready"|"unconfigured"|"unavailable"|"limited";
 asOf:string|null;
 observationCount:number;
 retrievedAt:string|null;
 note:string;
 sourceUrl:string;
};

async function fetchProviderReadiness():Promise<{checkedAt:string;providers:ProviderReadiness[]}>{
 const [fred,eia,alpha]=await Promise.allSettled([
  readFredSeries("DGS10",{limit:3}),
  fetchEiaWeeklyPetroleumSnapshot(),
  readAlphaVantageDailyPilot(),
 ]);
 const f=fred.status==="fulfilled"?fred.value:null;
 const e=eia.status==="fulfilled"?eia.value:null;
 const a=alpha.status==="fulfilled"?alpha.value:null;
 return {
  checkedAt:new Date().toISOString(),
  providers:[
   {provider:"FRED/ALFRED",
    state:f?.state??"unavailable",
    asOf:f?.observations[0]?.date??null,
    observationCount:f?.observations.length??0,
    retrievedAt:f?.retrievedAt??null,
    note:f?.state==="ready"?"Verified official DGS10 observation":f?.state==="unconfigured"?"FRED_API/FRED_API_KEY not available to this deployment":"FRED authenticated request unavailable",
    sourceUrl:"https://fred.stlouisfed.org/series/DGS10"},
   {provider:"EIA Open Data",
    state:e?.state??"unavailable",
    asOf:e?.asOf??null,
    observationCount:Object.keys(e?.metrics??{}).length,
    retrievedAt:e?.retrievedAt??null,
    note:e?.state==="ready"?"Verified EIA weekly petroleum API observation":e?.state==="unconfigured"?"EIA_API_KEY not available to this deployment":"EIA v2 API response unavailable or invalid",
    sourceUrl:"https://www.eia.gov/opendata/"},
   {provider:"Alpha Vantage",
    state:a?.state??"unavailable",
    asOf:a?.asOf??null,
    observationCount:a?.sampleCount??0,
    retrievedAt:a?.retrievedAt??null,
    note:a?.state==="ready"?"Verified compact SPY daily history; secondary pilot only":a?.state==="unconfigured"?"ALPHA_VANTAGE_API_KEY not available to this deployment":a?.state==="limited"?"Free-tier limit or endpoint entitlement":"Alpha Vantage response unavailable or invalid",
    sourceUrl:"https://www.alphavantage.co/documentation/#daily"},
  ],
 };
}
/** Only called after owner opens the explicit manual check.
 * Cached for an hour to avoid burning Alpha Vantage's small free daily quota.
 * Not part of automated Cron, canonical research, Story or Regime ingestion.
 */
export const getMarketToolsProviderReadiness=unstable_cache(fetchProviderReadiness,["market-tools-provider-readiness-v1"],{revalidate:3600});
