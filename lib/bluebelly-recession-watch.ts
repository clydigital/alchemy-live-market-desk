import type {FredReadResult,FredObservation} from "./providers/fred-api-v1.ts";
/** Recession research, not a calibrated forecast or a new canonical Regime.
 * FRED dates are observation periods. Realtime bounds are vintage metadata,
 * not release timestamps. All current-vintage charts are revision-sensitive.
 */
export const PILLARS=["Labour","Real activity","Household","Credit","Leading","Corporate / industry"] as const;
type Pillar=typeof PILLARS[number];
type Indicator={id:string;name:string;pillar:Pillar;frequency:"Daily"|"Weekly"|"Monthly"|"Quarterly";unit:string;role:"Coincident"|"Leading"|"Context";core?:boolean;connected:boolean;sourceUrl:string;note:string};
const f=(id:string,name:string,pillar:Pillar,frequency:Indicator["frequency"],unit:string,role:Indicator["role"],connected:boolean,note:string,core=false):Indicator=>({id,name,pillar,frequency,unit,role,connected,core,note,sourceUrl:"https://fred.stlouisfed.org/series/"+id});
export const RECESSION_INDICATORS:readonly Indicator[]=[
 f("PAYEMS","Payroll employment","Labour","Monthly","thousand persons","Coincident",true,"NBER core; level, not monthly payroll change",true),
 f("CE16OV","Household employment","Labour","Monthly","thousand persons","Coincident",true,"NBER core",true),
 f("UNRATE","Unemployment rate","Labour","Monthly","%","Coincident",true,"Rising unemployment can signal weakness"),
 f("SAHMREALTIME","Real-time Sahm indicator","Labour","Monthly","pp","Coincident",true,"Published threshold 0.50 percentage points"),
 f("ICSA","Initial claims","Labour","Weekly","claims","Leading",true,"Weekly claims; holiday noise"),
 f("CCSA","Continuing claims","Labour","Weekly","claims","Leading",true,"Persistent unemployment"),
 f("AWHMAN","Manufacturing weekly hours","Labour","Monthly","hours","Leading",false,"Additional early labour signal"),
 f("JTSJOL","Job openings","Labour","Monthly","thousands","Leading",false,"JOLTS; hires and quits follow separately"),
 f("W875RX1","Real income less transfers","Real activity","Monthly","real USD billions","Coincident",true,"NBER core",true),
 f("PCEC96","Real personal consumption","Real activity","Monthly","real USD billions","Coincident",true,"NBER core; overlaps household spending",true),
 f("CMRMTSPL","Real manufacturing and trade sales","Real activity","Monthly","real USD millions","Coincident",true,"NBER core; lagging availability",true),
 f("INDPRO","Industrial production","Real activity","Monthly","index","Coincident",true,"NBER core",true),
 f("GDPC1","Real GDP","Real activity","Quarterly","real USD billions","Context",true,"GDP level, not annualised quarter growth"),
 {id:"REAL_GDI",name:"Real GDI",pillar:"Real activity",frequency:"Quarterly",unit:"real USD billions",role:"Context",connected:false,sourceUrl:"https://www.bea.gov/data/income-saving/gross-domestic-income",note:"Verify current GDI series and period before use"},
 f("DSPIC96","Real disposable personal income","Household","Monthly","real USD billions","Coincident",true,"Consumption capacity"),
 f("PSAVERT","Personal saving rate","Household","Monthly","%","Context",false,"Savings buffer"),
 f("DRCCLACBS","Credit-card delinquency rate","Household","Quarterly","%","Context",false,"Bank-reported loan delinquency"),
 f("BAMLH0A0HYM2","High-yield OAS","Credit","Daily","pp","Leading",true,"Broad ICE BofA spread; not individual CDS/yield"),
 f("BAMLC0A0CM","Investment-grade OAS","Credit","Daily","pp","Leading",false,"Broad corporate spread"),
 f("BAMLH0A3HYC","CCC and lower OAS","Credit","Daily","pp","Leading",false,"Lower-quality credit"),
 f("NFCI","Chicago Fed NFCI","Credit","Weekly","index","Context",true,"Above zero = tighter than historical average; not recession itself"),
 f("DRTSCILM","SLOOS C&I lending standards","Credit","Quarterly","% net tightening","Leading",false,"Survey, not actual loan volumes"),
 f("T10Y3M","10-year minus 3-month yield","Leading","Daily","pp","Leading",true,"Curve inversion/resteepening is not a probability"),
 f("PERMIT","Housing permits","Leading","Monthly","thousands SAAR","Leading",true,"Construction lead; not starts"),
 f("MORTGAGE30US","30-year mortgage rate","Leading","Weekly","%","Context",false,"Affordability; see Housing lens"),
 {id:"CORPORATE",name:"Orders, earnings revisions and margins",pillar:"Corporate / industry",frequency:"Quarterly",unit:"issuer-specific",role:"Context",connected:false,sourceUrl:"https://www.sec.gov/search-filings",note:"Industry Intel/issuer evidence; no synthetic aggregate"},
];
export const ACTIVE_RECESSION_SERIES=RECESSION_INDICATORS.filter(x=>x.connected).map(x=>x.id);
const AGE_DAYS:Record<Indicator["frequency"],number>={Daily:7,Weekly:21,Monthly:75,Quarterly:160};
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().startsWith(s)?Date.parse(s+"T00:00:00Z"):NaN;
const monthIndex=(s:string)=>Number(s.slice(0,4))*12+Number(s.slice(5,7));
export type RecessionRow=Indicator&{state:"OBSERVED"|"AGED"|"UNAVAILABLE"|"NOT_CONNECTED";latest:FredObservation|null;previous:FredObservation|null;threeMonthChange:number|null;history:FredObservation[];retrievedAt:string|null;ageDays:number|null;missingReason:string|null;threshold:string|null};
export function projectRecessionWatch(reads:readonly FredReadResult[],now=new Date()){
 const t=now.getTime(),asOf=now.toISOString(),day=asOf.slice(0,10);
 const rows:RecessionRow[]=RECESSION_INDICATORS.map(d=>{
  const r=reads.find(x=>x.seriesId===d.id);
  const missing=(reason:string,state:RecessionRow["state"]):RecessionRow=>({...d,state,latest:null,previous:null,threeMonthChange:null,history:[],retrievedAt:null,ageDays:null,missingReason:reason,threshold:null});
  if(!d.connected)return missing("Not connected to this initial reader","NOT_CONNECTED");
  if(!r||r.state!=="ready"||!r.retrievedAt||!Number.isFinite(Date.parse(r.retrievedAt))||Date.parse(r.retrievedAt)>t)return missing(r?.state==="unconfigured"?"FRED adapter not configured":"No validated observation","UNAVAILABLE");
  const map=new Map<string,FredObservation>(),conflict=new Set<string>();
  for(const o of r.observations){
   if(!Number.isFinite(date(o.date))||o.date>day||!Number.isFinite(o.value)||!Number.isFinite(date(o.realtimeStart))||!Number.isFinite(date(o.realtimeEnd))||o.realtimeStart>day||o.realtimeEnd<o.realtimeStart)continue;
   if(map.has(o.date)&&map.get(o.date)!.value!==o.value)conflict.add(o.date);else map.set(o.date,o);
  }
  const sorted=[...map.values()].sort((a,b)=>b.date.localeCompare(a.date));
  // Conflicting newest data is not silently replaced by an older observation.
  if(!sorted.length||conflict.has(sorted[0].date))return missing("No unambiguous latest observation","UNAVAILABLE");
  const valid=sorted.filter(x=>!conflict.has(x.date)),latest=valid[0],previous=valid[1]??null;
  const ageDays=Math.floor((date(day)-date(latest.date))/86400000);
  const state=ageDays<=AGE_DAYS[d.frequency]?"OBSERVED":"AGED";
  const base=d.core?valid.find(x=>monthIndex(latest.date)-monthIndex(x.date)===3):undefined;
  const threeMonthChange=base&&base.value>0?(latest.value/base.value-1)*100:null;
  const threshold=d.id==="SAHMREALTIME"&&state==="OBSERVED"?(latest.value>=0.5?"Published Sahm threshold reached":"Below published Sahm threshold"):null;
  return {...d,state,latest,previous,threeMonthChange,history:valid.slice(0,12).reverse(),retrievedAt:r.retrievedAt,ageDays,missingReason:state==="AGED"?"Outside provisional period-age window; latest release not established":null,threshold};
 });
 const core=rows.filter(r=>r.core);
 const eligible=core.filter(r=>r.state==="OBSERVED"&&r.threeMonthChange!==null);
 const negative=eligible.filter(r=>r.threeMonthChange!<0).length;
 return {asOf,rows,coverage:{configured:ACTIVE_RECESSION_SERIES.length,observed:rows.filter(r=>r.state==="OBSERVED").length,registered:rows.length},core:{eligible:eligible.length,total:core.length,negative,latestPeriods:[...new Set(eligible.map(r=>r.latest!.date))]},assessment:"NO_AUTOMATIC_RECESSION_VERDICT" as const};
}
