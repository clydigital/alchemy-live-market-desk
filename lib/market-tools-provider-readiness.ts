import "server-only";
import { unstable_cache } from "next/cache";
import { readFredSeries } from "@/lib/providers/fred-api-v1";
import { fetchEiaWeeklyPetroleumSnapshot } from "@/lib/providers/eia-v2";
import { readAlphaVantageDailyPilot } from "@/lib/providers/alpha-vantage-daily-pilot";
import { readFmpRecords } from "@/lib/providers/fmp-rest";
import { fetchBeaSnapshot } from "@/lib/providers/bea";

export type ProviderReadiness = {
 provider:"FRED/ALFRED"|"EIA Open Data"|"Alpha Vantage"|"Financial Modeling Prep"|"BEA";
 state:"ready"|"partial"|"unconfigured"|"unavailable"|"limited";
 asOf:string|null;
 observationCount:number;
 retrievedAt:string|null;
 note:string;
 sourceUrl:string;
 // This is process.env visibility in the running server, NOT a read of team Shared Variables.
 runtimeCredential:"visible_at_runtime"|"not_visible_at_runtime";
 sharedScope:"not_inspected";
};

async function fetchProviderReadiness():Promise<{checkedAt:string;providers:ProviderReadiness[]}>{
 const now=new Date();
 const from=now.toISOString().slice(0,10);
 const to=new Date(now.getTime()+7*86400000).toISOString().slice(0,10);
 const [fred,eia,alpha,fmp,bea]=await Promise.allSettled([
  readFredSeries("DGS10",{limit:3}),
  fetchEiaWeeklyPetroleumSnapshot(),
  readAlphaVantageDailyPilot(),
  readFmpRecords({endpoint:"earnings-calendar",from,to,limit:2}),
  fetchBeaSnapshot(process.env.BEA_API_KEY),
 ]);
 const f=fred.status==="fulfilled"?fred.value:null;
 const e=eia.status==="fulfilled"?eia.value:null;
 const a=alpha.status==="fulfilled"?alpha.value:null;
 const m=fmp.status==="fulfilled"?fmp.value:null;
 const b=bea.status==="fulfilled"?bea.value:null;
 const runtime=(...names:string[])=>names.some(name=>Boolean(process.env[name]?.trim()))
   ?"visible_at_runtime" as const:"not_visible_at_runtime" as const;
 const safeCode=(note:string|null|undefined)=>note && /^[A-Z0-9_]{3,90}$/.test(note)?note:"REQUEST_OR_PAYLOAD_UNAVAILABLE";
 const eventDates=(m?.records??[]).map(row=>row.date).filter((date):date is string=>
   typeof date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(date));
 const beaPeriods=(b?.observations??[]).map(row=>row.period).sort();

 return {
  checkedAt:now.toISOString(),
  providers:[
   {provider:"FRED/ALFRED",
    state:f?.state??"unavailable",
    asOf:f?.observations[0]?.date??null,
    observationCount:f?.observations.length??0,
    retrievedAt:f?.retrievedAt??null,
    note:f?.state==="ready"?"Verified official DGS10 observation":f?.state==="unconfigured"?"Credential not visible to this server; team Shared Variables not inspected":"FRED request: "+safeCode(f?.note),
    sourceUrl:"https://fred.stlouisfed.org/series/DGS10",
    runtimeCredential:runtime("FRED_API","FRED_API_KEY"),sharedScope:"not_inspected"},
   {provider:"EIA Open Data",
    state:e?.state==="ready" && Object.keys(e.metrics).length<8?"partial":(e?.state??"unavailable"),
    asOf:e?.asOf??null,
    observationCount:Object.keys(e?.metrics??{}).length,
    retrievedAt:e?.retrievedAt??null,
    note:e?.state==="ready" && Object.keys(e.metrics).length<8?"Partial official EIA petroleum coverage: "+Object.keys(e.metrics).length+"/8 metrics; "+(e.note??"one or more series missing"):e?.state==="ready"?"Official EIA weekly petroleum observations: "+(e.note??"API v2"):e?.state==="unconfigured"?"Neither EIA API nor official WPSR CSV available":"EIA petroleum sources unavailable: "+(e?.note??"unknown server response"),
    sourceUrl:e?.sourceUrl??"https://www.eia.gov/petroleum/supply/weekly/",
    runtimeCredential:runtime("EIA_API_KEY"),sharedScope:"not_inspected"},
   {provider:"Alpha Vantage",
    state:a?.state??"unavailable",
    asOf:a?.asOf??null,
    observationCount:a?.sampleCount??0,
    retrievedAt:a?.retrievedAt??null,
    note:a?.state==="ready"?"Verified compact SPY daily history; secondary pilot only":a?.state==="unconfigured"?"ALPHA_VANTAGE_API_KEY not available to this deployment":a?.state==="limited"?"Free-tier limit or endpoint entitlement":"Alpha Vantage response unavailable or invalid",
    sourceUrl:"https://www.alphavantage.co/documentation/#daily",
    runtimeCredential:runtime("ALPHA_VANTAGE_API_KEY"),sharedScope:"not_inspected"},
   {provider:"Financial Modeling Prep",
    state:m?.state==="restricted"?"limited":m?.state??"unavailable",
    asOf:eventDates.sort().at(-1)??null,
    observationCount:m?.records.length??0,
    retrievedAt:m?.retrievedAt??null,
    note:m?.state==="ready"?"Dated earnings-calendar events received (not SEC-verified earnings data)":
      m?.state==="unconfigured"?"Credential not visible to this server; team Shared Variables not inspected":
      m?.state==="restricted"?"Provider plan or endpoint access restricted: "+safeCode(m.note):
      "FMP request: "+safeCode(m?.note),
    sourceUrl:"https://site.financialmodelingprep.com/developer/docs/stable/earnings-calendar",
    runtimeCredential:runtime("FMP_API","FMP_API_KEY"),sharedScope:"not_inspected"},
   {provider:"BEA",
    state:b?.state??"unavailable",
    asOf:beaPeriods.at(-1)??null,
    observationCount:b?.observations.length??0,
    retrievedAt:b?.retrievedAt??null,
    note:b?.state==="ready"?"Dated original BEA NIPA GDP/PCE observations received":
      b?.state==="partial"?"BEA partial: one NIPA table unavailable; not accepted as complete evidence":
      b?.state==="unconfigured"?"Credential not visible to this server; team Shared Variables not inspected":
      "BEA response unavailable or missing usable original-series rows",
    sourceUrl:"https://apps.bea.gov/api/data/",
    runtimeCredential:runtime("BEA_API_KEY"),sharedScope:"not_inspected"},
  ],
 };
}
/** Only called after owner opens the explicit manual check.
 * Cached for an hour to avoid burning Alpha Vantage's small free daily quota.
 * Not part of automated Cron, canonical research, Story or Regime ingestion.
 */
export const getMarketToolsProviderReadiness=unstable_cache(fetchProviderReadiness,["market-tools-provider-readiness-v6"],{revalidate:3600});
