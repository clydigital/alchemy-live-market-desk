import { createSupabaseAdminClient } from "./supabase/admin.ts";

/** Read-only source acquisition + additive historic projection. Runs in the existing
 * Live research slots; never treats trend rows as canonical Story evidence. */
export const BLS_TREND_SERIES = [
  { key:"cpi_all",id:"CUSR0000SA0",label:"CPI-U: All items, seasonally adjusted",unit:"Index 1982-84=100",kind:"index" },
  { key:"cpi_core",id:"CUSR0000SA0L1E",label:"CPI-U: All items less food and energy, seasonally adjusted",unit:"Index 1982-84=100",kind:"index" },
  { key:"ppi_final_demand",id:"WPSFD4",label:"PPI: Final demand, seasonally adjusted",unit:"Index Nov 2009=100",kind:"index" },
  { key:"nfp",id:"CES0000000001",label:"Change in total nonfarm payroll employment, seasonally adjusted",unit:"Thousands of jobs, m/m change",kind:"payroll" },
  { key:"_cpi_all_nsa",id:"CUUR0000SA0",label:"",unit:"",kind:"comparison" },
  { key:"_cpi_core_nsa",id:"CUUR0000SA0L1E",label:"",unit:"",kind:"comparison" },
  { key:"_ppi_nsa",id:"WPUFD4",label:"",unit:"",kind:"comparison" },
] as const;
type BlsPoint={year:string;period:string;value:string;footnotes?:Array<{code?:string;text?:string|null}>};
type BlsPayload={status?:string;Results?:{series?:Array<{seriesID:string;data?:BlsPoint[]}>}};
export type MacroTrendRecord={
  id:string;series_key:string;series_id:string;series_name:string;
  agency:string;observation_date:string;value:number;mom_change:number|null;
  yoy_change:number|null;unit:string;frequency:"Monthly";source_url:string;
  is_preliminary:boolean;notes:string;
};
export type MacroTrendRefresh={
  status:"READY"|"DEGRADED";checkedAt:string;source:"BLS_PUBLIC_DATA_API";
  receivedSeries:number;eligibleRecords:number;insertedRecords:number;
  coveredSeries:string[];latestBySeries:Record<string,string>;warnings:string[];
};
type TrendStore={
  existingIds(ids:string[]):Promise<Set<string>>;
  insertMissing(rows:MacroTrendRecord[]):Promise<number>;
};

function monthlyValues(rows:BlsPoint[]|undefined,now:Date) {
  const found=new Map<string,number>();
  const latestAllowed=now.getUTCFullYear()*12+now.getUTCMonth()+1;
  for(const row of rows??[]) {
    const year=Number(row.year),month=/^M(0[1-9]|1[0-2])$/.test(row.period)?Number(row.period.slice(1)):NaN;
    const value=Number(row.value);
    if(!Number.isInteger(year)||year<2000||!Number.isInteger(month)
      ||year*12+month>latestAllowed||!Number.isFinite(value)||value<=0)continue;
    found.set(year+"-"+String(month).padStart(2,"0"),value);
  }
  return found;
}
function prior(key:string) {
  const y=Number(key.slice(0,4)),m=Number(key.slice(5));
  return m===1?(y-1)+"-12":y+"-"+String(m-1).padStart(2,"0");
}
function yearAgo(key:string){return (Number(key.slice(0,4))-1)+key.slice(4);}
function percent(current:number,base:number|undefined):number|null{
  return typeof base==="number"&&base>0&&Number.isFinite(current)
    ?Math.round(((current/base)-1)*100000)/1000:null;
}
/** SA current / SA prior for m/m; NSA current / NSA year ago for y/y.
 * Payroll reports the CHANGE in employment, never the stock's index level. */
export function officialBlsTrendRecords(payload:BlsPayload,now:Date):MacroTrendRecord[]{
  if(payload.status!=="REQUEST_SUCCEEDED"||!payload.Results?.series?.length)return [];
  const maps=new Map(payload.Results.series.map(x=>[x.seriesID,monthlyValues(x.data,now)]));
  const output:MacroTrendRecord[]=[];
  for(const spec of BLS_TREND_SERIES) {
    if(spec.kind==="comparison")continue;
    const current=maps.get(spec.id);
    if(!current?.size)continue;
    const nsaKey=spec.key==="cpi_all"?"CUUR0000SA0":
      spec.key==="cpi_core"?"CUUR0000SA0L1E":
      spec.key==="ppi_final_demand"?"WPUFD4":null;
    const nsa=nsaKey?maps.get(nsaKey):null;
    for(const [period,value] of current){
      const preceding=current.get(prior(period));
      if(spec.kind==="payroll"&&preceding===undefined)continue;
      const level=spec.kind==="payroll"?Math.round(value-preceding!):value;
      const change=spec.kind==="payroll"?null:percent(value,preceding);
      const yOy=nsa&&nsa.has(period)?percent(nsa.get(period)!,nsa.get(yearAgo(period))):null;
      if(!Number.isFinite(level)||(spec.kind==="index"&&level<=0))continue;
      const seriesId=spec.kind==="payroll"?spec.id+"_CHANGE":spec.id;
      output.push({
        id:spec.key+"-"+period,series_key:spec.key,series_id:seriesId,
        series_name:spec.label,agency:"U.S. Bureau of Labor Statistics",
        observation_date:period+"-01",value:level,mom_change:change,
        yoy_change:yOy,unit:spec.unit,frequency:"Monthly",
        source_url:"https://data.bls.gov/timeseries/"+spec.id,
        // Preserve the actual BLS period footnote; an old PPI month is
        // not "preliminary" merely because the series can be revised.
        is_preliminary:Boolean(payload.Results.series
          .find(x=>x.seriesID===spec.id)?.data?.find(x=>
            x.year===period.slice(0,4)&&x.period==="M"+period.slice(5))
          ?.footnotes?.some(x=>x.code==="P"||/preliminary/i.test(x.text??""))),
        notes:"Official BLS Public Data API v2, checked "+now.toISOString().slice(0,10)+
          ". Historic vintages and subsequent revisions are not reconstructed.",
      });
    }
  }
  return output.sort((a,b)=>a.observation_date.localeCompare(b.observation_date)||a.series_key.localeCompare(b.series_key));
}
function productionStore():TrendStore{
  const db=createSupabaseAdminClient();
  return {
    async existingIds(ids){
      const known=new Set<string>();
      for(let i=0;i<ids.length;i+=120){
        const {data,error}=await db.from("macro_series_observations").select("id").in("id",ids.slice(i,i+120));
        if(error)throw new Error("Trend preflight read failed: "+error.message);
        for(const row of data??[])known.add(row.id);
      }
      return known;
    },
    async insertMissing(rows){
      if(!rows.length)return 0;
      const {data,error}=await db.from("macro_series_observations")
        .upsert(rows,{onConflict:"id",ignoreDuplicates:true}).select("id");
      if(error)throw new Error("Trend additive insert failed: "+error.message);
      return data?.length??0;
    },
  };
}
export async function collectOfficialMacroTrendHistory(
  now=new Date(),deps:{fetcher?:typeof fetch;store?:TrendStore}={},
):Promise<MacroTrendRefresh>{
  const warnings:string[]=[];
  const complete=(receivedSeries:number,records:MacroTrendRecord[],insertedRecords:number):MacroTrendRefresh=>{
    const latestBySeries:Record<string,string>={};
    for(const row of records)if(!latestBySeries[row.series_key]||row.observation_date>latestBySeries[row.series_key])
      latestBySeries[row.series_key]=row.observation_date;
    const coveredSeries=Object.keys(latestBySeries).sort();
    if(coveredSeries.length<4)warnings.push("BLS_TREND_REQUIRED_SERIES_MISSING");
    for(const [seriesKey,latestDate] of Object.entries(latestBySeries)){
      const lastMonth=Date.parse(latestDate+"T00:00:00Z");
      if(!Number.isFinite(lastMonth)||now.getTime()-lastMonth>75*86400000)
        warnings.push("BLS_TREND_STALE:"+seriesKey);
    }
    return {status:warnings.length?"DEGRADED":"READY",checkedAt:now.toISOString(),
      source:"BLS_PUBLIC_DATA_API",receivedSeries,eligibleRecords:records.length,
      insertedRecords,coveredSeries,latestBySeries,warnings};
  };
  try {
    const response=await (deps.fetcher??fetch)("https://api.bls.gov/publicAPI/v2/timeseries/data/",{
      method:"POST",headers:{accept:"application/json","content-type":"application/json"},
      body:JSON.stringify({seriesid:BLS_TREND_SERIES.map(s=>s.id),
        startyear:String(now.getUTCFullYear()-2),endyear:String(now.getUTCFullYear())}),
      cache:"no-store",signal:AbortSignal.timeout(12000),
    });
    if(!response.ok){warnings.push("BLS_API_HTTP_"+response.status);return complete(0,[],0);}
    const payload=await response.json() as BlsPayload;
    if(payload.status!=="REQUEST_SUCCEEDED"){
      warnings.push("BLS_API_NON_SUCCESS");return complete(payload.Results?.series?.length??0,[],0);
    }
    const records=officialBlsTrendRecords(payload,now);
    if(!records.length)warnings.push("BLS_TREND_NO_USABLE_MONTHLY_DATA");
    const store=deps.store??productionStore();
    const existing=await store.existingIds(records.map(row=>row.id));
    const fresh=records.filter(row=>!existing.has(row.id));
    let count=0;
    for(let i=0;i<fresh.length;i+=80)count+=await store.insertMissing(fresh.slice(i,i+80));
    return complete(payload.Results?.series?.length??0,records,count);
  }catch{
    warnings.push("BLS_TREND_ACQUISITION_OR_STORAGE_FAILED");
    return complete(0,[],0);
  }
}
