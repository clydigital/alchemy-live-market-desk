import type {MarketMonitorRow} from "./market-monitor.ts";

export type BondWindowLabel="1D"|"3D"|"5D";
export type BondTrend="better"|"mixed"|"worse"|"unknown";
export type BondMetric={
 id:string;label:string;kind:"yield"|"real"|"breakeven"|"credit"|"volatility"|"etf";
 last:number|null;asOf:string|null;sourceName:string|null;sourceUrl:string|null;
 changes:Record<BondWindowLabel,number|null>;
};
export type BondWindow={label:BondWindowLabel;trend:BondTrend;tenYearBp:number|null;thirtyYearBp:number|null;from:string|null;to:string|null};
export type BondSpread={label:string;bp:number|null;asOf:string|null};
export type BondPressureMonitor={
 state:"READY"|"LAST_REPORTED"|"PARTIAL"|"STALE"|"UNAVAILABLE";
 asOf:string|null;calendarLagDays:number|null;
 windows:BondWindow[];
 curve:BondMetric[];drivers:BondMetric[];etfs:BondMetric[];
 spreads:BondSpread[];tltConfirmation:"CONFIRMED"|"DIVERGENT"|"QUIET"|"NOT_COMPARABLE";
 headline:string;notice:string;
};
const WINDOWS=[["1D",1],["3D",3],["5D",5]] as const;
const DAY=86400000;
const TENORS=[
 ["us2y","2Y"],["us5y-fred","5Y"],["us10y-fred","10Y"],["us20y-fred","20Y"],["us30y-fred","30Y"]
] as const;
const DRIVERS=[
 ["us10y-real","10Y TIPS real yield","real"],
 ["us10y-breakeven","10Y inflation breakeven","breakeven"],
 ["hy-oas","High-yield credit OAS","credit"],
 ["ig-oas","Investment-grade OAS","credit"],
 ["move","MOVE bond volatility","volatility"]
] as const;
const ETFS=[
 ["tlt","TLT · long-duration Treasuries"],
 ["ief","IEF · 7–10Y Treasuries"],
 ["shy","SHY · 1–3Y Treasuries"],
 ["tip","TIP · inflation-protected bonds"]
] as const;
type Point={date:string;value:number};
const emptyChanges=():Record<BondWindowLabel,number|null>=>({"1D":null,"3D":null,"5D":null});
function day(value:string|null):string|null{
 if(!value||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value.slice(0,10)))return null;
 const d=value.slice(0,10),parsed=Date.parse(d+"T00:00:00Z");
 return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===d?d:null;
}
function secure(url:string):boolean{
 try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<2048;}
 catch{return false;}
}
function points(row:MarketMonitorRow|null,now:Date,kind:BondMetric["kind"]):Point[]{
 if(!row||row.frequency!=="daily")return [];
 const latest=day(row.asOf);
 if(!latest||latest>now.toISOString().slice(0,10)||!secure(row.sourceUrl))return [];
 const p=row.points.filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.close))
  .map(x=>({date:new Date(x.time*1000).toISOString().slice(0,10),value:x.close}))
  .filter(x=>x.date<=latest&&(kind==="yield"?(x.value>=0&&x.value<30):
    kind==="real"?(x.value>-10&&x.value<30):kind==="breakeven"?(x.value>-5&&x.value<20):
    kind==="credit"?(x.value>=0&&x.value<40):kind==="volatility"?(x.value>0&&x.value<1000):x.value>0))
  .sort((a,b)=>a.date.localeCompare(b.date));
 return [...new Map(p.map(x=>[x.date,x])).values()].slice(-64);
}
function metric(rows:readonly MarketMonitorRow[]|null,id:string,label:string,kind:BondMetric["kind"],now:Date):BondMetric{
 const row=rows?.find(r=>r.id===id)??null;
 const approved=kind==="yield"
  ?row!==null&&row.type==="Rates"&&(
    row.sourceName==="U.S. Department of the Treasury"&&row.sourceUrl.startsWith("https://home.treasury.gov/")
    ||row.sourceName==="Federal Reserve Economic Data"&&row.sourceUrl==="https://fred.stlouisfed.org/series/"+row.symbol
   )
  :row!==null;
 const clean=points(approved?row:null,now,kind);
 const last=clean.at(-1),lastDay=day(row?.asOf??null);
 const usable=Boolean(last&&lastDay===last.date);
 const changes=emptyChanges();
 if(usable){
  for(const [window,n] of WINDOWS){
   if(clean.length>n){
    const prior=clean.at(-(n+1))!;
    changes[window]=Number((kind==="etf"?(last!.value/prior.value-1)*100:
      kind==="volatility"?(last!.value-prior.value):
      (last!.value-prior.value)*100).toFixed(2));
   }
  }
 }
 return {id,label,kind,last:usable?last!.value:null,asOf:usable?lastDay:null,
  sourceName:usable?row!.sourceName:null,sourceUrl:usable?row!.sourceUrl:null,changes};
}
function moveWithDates(rows:readonly MarketMonitorRow[]|null,m:BondMetric,window:BondWindowLabel,now:Date){
 const n=window==="1D"?1:window==="3D"?3:5;
 const row=rows?.find(r=>r.id===m.id)??null;
 if(!row||!m.asOf)return null;
 const p=points(row,now,m.kind);
 if(p.length<=n||p.at(-1)?.date!==m.asOf)return null;
 return {from:p.at(-(n+1))!.date,to:p.at(-1)!.date,bp:m.changes[window]};
}
function boundedLag(asOf:string|null,now:Date):number|null{
 if(!asOf)return null;
 const clock=Date.parse(asOf+"T00:00:00Z");
 if(!Number.isFinite(clock))return null;
 const n=Math.round((Date.parse(now.toISOString().slice(0,10)+"T00:00:00Z")-clock)/DAY);
 return n>=0?n:null;
}
function oneSpread(a:BondMetric,b:BondMetric,label:string):BondSpread{
 const same=!!a.asOf&&a.asOf===b.asOf&&a.last!==null&&b.last!==null;
 return {label,bp:same?Number(((a.last!-b.last!)*100).toFixed(1)):null,asOf:same?a.asOf:null};
}
/** No event headlines or creator posts determine the duration meter:
 * 10Y and 30Y must have comparable official yield sessions, including the
 * window's starting date. A holiday retains prior session history.
 */
export function projectBondPressure(rows:readonly MarketMonitorRow[]|null,now=new Date()):BondPressureMonitor{
 const curve=TENORS.map(([id,label])=>metric(rows,id,label,"yield",now));
 const drivers=DRIVERS.map(([id,label,kind])=>metric(rows,id,label,kind,now));
 const etfs=ETFS.map(([id,label])=>metric(rows,id,label,"etf",now));
 const y2=curve[0],y10=curve[2],y30=curve[4];
 const asOf=y10.asOf===y30.asOf?y10.asOf:null;
 const lag=boundedLag(asOf,now);
 const state:BondPressureMonitor["state"]=rows===null?"UNAVAILABLE":
  !y10.asOf&&!y30.asOf?"UNAVAILABLE":!asOf?"PARTIAL":
  lag===null||lag>4?"STALE":lag===0?"READY":"LAST_REPORTED";
 const windows:BondWindow[]=WINDOWS.map(([label])=>{
  const a=moveWithDates(rows,y10,label,now),b=moveWithDates(rows,y30,label,now);
  const valid=state!=="UNAVAILABLE"&&state!=="STALE"&&state!=="PARTIAL"&&
    a?.bp!==null&&a?.bp!==undefined&&b?.bp!==null&&b?.bp!==undefined&&
    a.from===b.from&&a.to===b.to;
  const first=valid?a!.bp!:null,second=valid?b!.bp!:null;
  const trend:BondTrend=first===null||second===null?"unknown":
   first<=-1&&second<=-1?"better":first>=1&&second>=1?"worse":"mixed";
  return {label,trend,tenYearBp:first,thirtyYearBp:second,from:valid?a!.from:null,to:valid?a!.to:null};
 });
 const spreads=[oneSpread(y10,y2,"10Y − 2Y"),oneSpread(y30,y2,"30Y − 2Y"),oneSpread(y30,y10,"30Y − 10Y")];
 const tlt=etfs[0],longMove=windows[0];
 const comparable=asOf!==null&&tlt.asOf===asOf&&longMove.tenYearBp!==null&&longMove.thirtyYearBp!==null&&tlt.changes["1D"]!==null;
 const yieldMove=longMove.tenYearBp===null||longMove.thirtyYearBp===null?null:
  (longMove.tenYearBp+longMove.thirtyYearBp)/2;
 const tltMove=tlt.changes["1D"];
 const tltConfirmation:BondPressureMonitor["tltConfirmation"]=!comparable||yieldMove===null||tltMove===null?"NOT_COMPARABLE":
  Math.abs(yieldMove)<1||Math.abs(tltMove)<0.1?"QUIET":
  (yieldMove<0&&tltMove>0)||(yieldMove>0&&tltMove<0)?"CONFIRMED":"DIVERGENT";
 const stateMessage=state==="READY"?"Latest official yield session available.":
  state==="LAST_REPORTED"?"Showing the last official Treasury session, not a fabricated new close.":
  state==="STALE"?"Official yield observations are old; directions withheld.":
  state==="PARTIAL"?"10Y and 30Y observations do not share a latest source session.":"Comparable US Treasury observations unavailable.";
 const notice=(asOf==="2026-11-10"&&now.toISOString().slice(0,10)>="2026-11-11"
    &&now.toISOString().slice(0,10)<="2026-11-13"
   ?"11 Nov 2026 US fixed-income holiday: SIFMA recommended a full market close. " :"")+
   stateMessage+" All 1D/3D/5D moves use trading sessions and are source-dated; TLT ETF observations may be on a different session.";
 const headline=state==="UNAVAILABLE"?"Duration reading unavailable":
   state==="STALE"?"Last yield reading is stale":
   windows[0].trend==="better"?"Long-bond yields are easing":
   windows[0].trend==="worse"?"Long-bond yields are climbing":
   windows[0].trend==="mixed"?"10Y and 30Y signals diverge":"Matched direction unavailable";
 return {state,asOf,calendarLagDays:lag,windows,curve,drivers,etfs,spreads,tltConfirmation,headline,notice};
}
