/**
 * Exact official EIA Weekly Petroleum Status Report (WPSR) CSV fallback.
 * Table 1 stocks are MILLION barrels; the existing API contract uses
 * THOUSAND barrels (MBBL). Flow rates in Table 1 and Table 9 are already
 * thousand barrels/day, and utilisation is percentage points.
 *
 * Files are fetched from official, stable, keyless URLs. No screen scraping,
 * third-party mirror, cron, persistence or guessed metric/period joins.
 */
import {EIA_WEEKLY_SERIES, type EiaWeeklyMetricKey,
 type EiaWeeklyMetric, type EiaWeeklyPetroleumSnapshot} from "./eia-v2";

export const WPSR_CSV_TABLE1="https://ir.eia.gov/wpsr/table1.csv";
export const WPSR_CSV_TABLE9="https://ir.eia.gov/wpsr/table9.csv";

type CsvRow=string[];
function csvRows(csv:string):CsvRow[]{
 const rows:CsvRow[]=[];
 let fields:string[]=[],value="",quoted=false;
 for(let i=0;i<csv.length;i++){
  const char=csv[i];
  if(char==='"'){
   if(quoted&&csv[i+1]==='"'){value+='"';i++;}
   else quoted=!quoted;
  }else if(char===","&&!quoted){fields.push(value);value="";}
  else if((char==="\n"||char==="\r")&&!quoted){
   if(char==="\r"&&csv[i+1]==="\n")i++;
   fields.push(value);value="";
   if(fields.some(x=>x.trim()))rows.push(fields);
   fields=[];
  }else value+=char;
 }
 if(quoted)throw new Error("WPSR_CSV_INVALID_QUOTES");
 fields.push(value);
 if(fields.some(x=>x.trim()))rows.push(fields);
 return rows;
}
function isoWeekEnd(raw:string):string|null{
 const match=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
 if(!match)return null;
 const year=2000+Number(match[3]),month=Number(match[1]),day=Number(match[2]);
 const d=new Date(Date.UTC(year,month-1,day));
 if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day||
    d.getUTCDay()!==5)return null;
 return d.toISOString().slice(0,10);
}
function num(raw:string):number|null{
 if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw.trim()))return null;
 const n=Number(raw.trim().replaceAll(",",""));
 return Number.isFinite(n)&&n>=0?n:null;
}
type RecordRow={group:string;label:string;current:string;previous:string};
type ParsedTable={period:string;previousPeriod:string;rows:RecordRow[]};
function parseTable(csv:string,table:1|9):ParsedTable|null{
 if(csv.length>110000||csv.length<100||/<!doctype|<html|<script/i.test(csv))return null;
 let rows:CsvRow[];
 try{rows=csvRows(csv.replace(/^\uFEFF/,"").replace(/\u001a\s*$/,""));}
 catch{return null;}
 let dated:{period:string;previousPeriod:string}|null=null;
 const result:RecordRow[]=[];
 let currentGroup="";
 for(const fields of rows){
  if(fields[0]?.trim()==="STUB_1" &&
     (table===1?fields[1]?.trim()==="STUB_2":fields[1]?.trim()==="STUB_2")){
   const period=isoWeekEnd(fields[2]?.trim()||"");
   const previousPeriod=isoWeekEnd(fields[3]?.trim()||"");
   if(!period||!previousPeriod||previousPeriod>=period)return null;
   if(dated&&(dated.period!==period||dated.previousPeriod!==previousPeriod))return null;
   dated={period,previousPeriod};
   currentGroup="";continue;
  }
  if(table===1&&fields[0]?.trim()==="STUB_1"){
   const period=isoWeekEnd(fields[1]?.trim()||"");
   const previousPeriod=isoWeekEnd(fields[2]?.trim()||"");
   if(!period||!previousPeriod||previousPeriod>=period)return null;
   if(dated&&(dated.period!==period||dated.previousPeriod!==previousPeriod))return null;
   dated={period,previousPeriod};
   currentGroup="stocks";continue;
  }
  if(!dated)continue;
  if(table===1&&currentGroup==="stocks"){
   result.push({group:"stocks",label:fields[0]?.trim()||"",
    current:fields[1]||"",previous:fields[2]||""});
  }else{
   const group=fields[0]?.trim()||"";
   const label=(fields[1]||"").replace(/^\(\d+\)\s*/,"").trim();
   result.push({group,label,current:fields[2]||"",previous:fields[3]||""});
  }
 }
 if(!dated)return null;
 return {...dated,rows:result};
}
const mapping:Array<{
 key:EiaWeeklyMetricKey;table:1|9;group:string;label:string;multiplier:number;rawUnits:string;
}>=[
 {key:"crudeStocksExSpr",table:1,group:"stocks",label:"Commercial (Excluding SPR)",multiplier:1000,rawUnits:"Million Barrels"},
 {key:"gasolineStocks",table:1,group:"stocks",label:"Total Motor Gasoline",multiplier:1000,rawUnits:"Million Barrels"},
 {key:"distillateStocks",table:1,group:"stocks",label:"Distillate Fuel Oil",multiplier:1000,rawUnits:"Million Barrels"},
 {key:"sprStocks",table:1,group:"stocks",label:"Strategic Petroleum Reserve (SPR)",multiplier:1000,rawUnits:"Million Barrels"},
 {key:"crudeProduction",table:1,group:"Crude Oil Supply",label:"Domestic Production",multiplier:1,rawUnits:"Thousand Barrels per Day"},
 {key:"gasolineProductSupplied",table:1,group:"Products Supplied",label:"Finished Motor Gasoline",multiplier:1,rawUnits:"Thousand Barrels per Day"},
 {key:"refineryCrudeInputs",table:9,group:"Refiner Inputs and Utilization",label:"Crude Oil Inputs",multiplier:1,rawUnits:"Thousand Barrels per Day"},
 {key:"refineryUtilisation",table:9,group:"Refiner Inputs and Utilization",label:"Percent Utilization",multiplier:1,rawUnits:"Percent"},
];
/** A table is never partially trusted across differing weeks or duplicate IDs. */
export function parseOfficialWpsrCsv(table1:string,table9:string,retrievedAt:string):EiaWeeklyPetroleumSnapshot{
 const a=parseTable(table1,1),b=parseTable(table9,9);
 const matched=a&&b&&a.period===b.period&&a.previousPeriod===b.previousPeriod;
 const metrics:EiaWeeklyPetroleumSnapshot["metrics"]={};
 const tableFor=(table:1|9)=>table===1?a:(matched?b:null);
 for(const item of mapping){
  const table=tableFor(item.table);
  if(!table)continue;
  const hits=table.rows.filter(row=>row.group===item.group&&row.label===item.label);
  if(hits.length!==1)continue;
  const current=num(hits[0].current),previous=num(hits[0].previous);
  if(current===null||previous===null)continue;
  if(item.key==="refineryUtilisation"&&(current>110||previous>110))continue;
  const definition=EIA_WEEKLY_SERIES[item.key];
  const metric:EiaWeeklyMetric={
   key:item.key,seriesId:definition.id,label:definition.label,canonicalUnit:definition.canonicalUnit,
   latest:{period:table.period,value:current*item.multiplier,
     units:definition.canonicalUnit,rawUnits:item.rawUnits},
   previous:{period:table.previousPeriod,value:previous*item.multiplier,
     units:definition.canonicalUnit,rawUnits:item.rawUnits},
  };
  metrics[item.key]=metric;
 }
 const count=Object.keys(metrics).length;
 return {
  state:count?"ready":"unavailable",
  asOf:count?a!.period:null,retrievedAt:count?retrievedAt:null,metrics,
  sourceName:"U.S. Energy Information Administration",
  sourceUrl:WPSR_CSV_TABLE1,
  note:count?("OFFICIAL_WPSR_CSV: "+count+"/8 metrics"+
    (!matched?"; refinery table missing or week mismatch":"")):
    "OFFICIAL_WPSR_CSV_NO_VALID_ROWS",
 };
}
/** Always require exact official paths; bounded, no key, no redirect target use. */
export async function fetchOfficialWpsrCsv(options:{fetchImpl?:typeof fetch}={}):Promise<EiaWeeklyPetroleumSnapshot>{
 const doFetch=options.fetchImpl??fetch;
 const read=async(url:string):Promise<string>=>{
  try{
   const response=await doFetch(url,{
    headers:{accept:"text/csv,text/plain;q=0.9","user-agent":"Bluebelly EIA WPSR official CSV fallback"},
    signal:AbortSignal.timeout(8_000),next:{revalidate:15*60},
   });
   if(!response.ok)return "";
   const value=await response.text();
   return value.length<=110000?value:"";
  }catch{return "";}
 };
 const [a,b]=await Promise.all([read(WPSR_CSV_TABLE1),read(WPSR_CSV_TABLE9)]);
 return parseOfficialWpsrCsv(a,b,new Date().toISOString());
}
