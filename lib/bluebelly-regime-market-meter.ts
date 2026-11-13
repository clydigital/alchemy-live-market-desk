import type {PublicMarketObservation} from "./blue-desk-public-markets.ts";
import type {BondPressureMonitor} from "./bluebelly-bond-pressure.ts";
import type {RegimeDirectionId} from "./bluebelly-regime-direction-reads.ts";

type Trend="rising"|"falling"|"flat"|"unknown";
type WindowLabel="1D"|"3D"|"5D";
export type MarketMeterWindow={label:WindowLabel;trend:Trend;readout:string};
export type RegimeMeterReading={
 id:RegimeDirectionId;
 label:string;
 scope:string;
 leftLabel:string;
 rightLabel:string;
 direction:-1|0|1|null;
 needlePeriod:WindowLabel;
 value:string|null;
 observedAt:string|null;
 sourceName:string|null;
 sourceUrl:string|null;
 state:"observed"|"last_reported"|"unavailable";
 windows:readonly MarketMeterWindow[];
 caveat:string;
};
const WINDOW_LABELS=["1D","3D","5D"] as const;
const DAY=86_400_000;
function stamp(value:string|null):number|null{
 if(!value)return null;
 const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(value);
 const n=Date.parse(dateOnly?value+"T00:00:00Z":value);
 if(!Number.isFinite(n))return null;
 if(dateOnly&&new Date(n).toISOString().slice(0,10)!==value)return null;
 return n;
}
function sourceOk(value:string|null){
 if(!value)return false;
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&u.href.length<=2048}
 catch{return false}
}
function fresh(row:PublicMarketObservation,now:Date):boolean{
 const time=stamp(row.asOf),age=time===null?Infinity:now.getTime()-time;
 return row.frequency==="daily"&&row.last!==null&&Number.isFinite(row.last)
  &&row.dataStatus!=="UNAVAILABLE_OR_STALE"&&age>=-DAY&&age<=6*DAY
  &&sourceOk(row.sourceUrl);
}
function change(row:PublicMarketObservation,label:WindowLabel):number|null{
 const value=label==="1D"?row.change:label==="3D"?row.change3d:row.change5d;
 return value!==null&&Number.isFinite(value)?value:null;
}
function trend(v:number|null):Trend{
 return v===null?"unknown":v>0?"rising":v<0?"falling":"flat";
}
function sign(v:number,unit:string):string{
 return (v>0?"+":"")+v.toFixed(unit==="bp"?1:2)+(unit==="bp"?" bp":unit==="pp"?" pp":"%");
}
function empty(id:RegimeDirectionId,label:string,scope:string,leftLabel:string,rightLabel:string,
 caveat:string,needlePeriod:WindowLabel):RegimeMeterReading{
 return {id,label,scope,leftLabel,rightLabel,caveat,needlePeriod,direction:null,value:null,
  observedAt:null,sourceName:null,sourceUrl:null,state:"unavailable",
  windows:WINDOW_LABELS.map(label=>({label,trend:"unknown",readout:"NOT SUPPLIED"}))};
}
function tape(id:RegimeDirectionId,rows:readonly PublicMarketObservation[],ids:readonly string[],
 label:string,scope:string,leftLabel:string,rightLabel:string,caveat:string,
 now:Date,needlePeriod:WindowLabel="1D"):RegimeMeterReading{
 const base=empty(id,label,scope,leftLabel,rightLabel,caveat,needlePeriod);
 // Never choose a stale preferred ticker when an explicitly listed backup has a current session.
 const candidates=ids.map(key=>rows.find(r=>r.id===key)).filter((r):r is PublicMarketObservation=>Boolean(r))
  .filter(r=>fresh(r,now));
 const row=candidates.find(r=>change(r,needlePeriod)!==null)??candidates[0];
 if(!row)return base;
 const n=change(row,needlePeriod);
 return {...base,label:row.label,scope,observedAt:row.asOf,sourceName:row.sourceName,
  sourceUrl:row.sourceUrl,value:row.last!.toLocaleString("en-GB",{maximumFractionDigits:2})+
  (row.type==="Rates"?"%":row.type==="Breadth"?"%":""),state:"observed",
  direction:n===null?null:n>0?1:n<0?-1:0,
  windows:WINDOW_LABELS.map(label=>{
   const delta=change(row,label);
   return {label,trend:trend(delta),readout:delta===null?"NOT SUPPLIED":sign(delta,row.changeUnit)};
  })};
}
function treasury(bonds:BondPressureMonitor):RegimeMeterReading{
 const base=empty("bonds","10Y + 30Y Treasury","Matched official cash-yield sessions",
  "Yields rising","Yields falling","A dated Treasury yield comparison is not a forecast of TLT returns.","1D");
 if(bonds.state!=="READY"&&bonds.state!=="LAST_REPORTED")return base;
 const ten=bonds.curve.find(x=>x.id==="us10y-fred");
 const thirty=bonds.curve.find(x=>x.id==="us30y-fred");
 if(!ten||!thirty||!bonds.asOf||ten.asOf!==bonds.asOf||
  thirty.asOf!==bonds.asOf||!sourceOk(ten.sourceUrl)||!sourceOk(thirty.sourceUrl))return base;
 const first=bonds.windows.find(w=>w.label==="1D");
 const dir=first?.trend==="better"?1:first?.trend==="worse"?-1:first?.trend==="mixed"?0:null;
 return {...base,direction:dir,observedAt:bonds.asOf,sourceName:"US Treasury yields · "+(ten.sourceName??"FRED"),
  sourceUrl:ten.sourceUrl,value:"10Y "+ten.last!.toFixed(2)+"% · 30Y "+thirty.last!.toFixed(2)+"%",
  state:bonds.state==="READY"?"observed":"last_reported",
  windows:WINDOW_LABELS.map(label=>{
   const w=bonds.windows.find(item=>item.label===label);
   const tenBp=w?.tenYearBp,thirtyBp=w?.thirtyYearBp;
   if(!w||tenBp===null||thirtyBp===null||tenBp===undefined||thirtyBp===undefined)
    return {label,trend:"unknown" as const,readout:"NOT SUPPLIED"};
   return {label,trend:w.trend==="better"?"falling" as const:w.trend==="worse"?"rising" as const:
     w.trend==="mixed"?"flat" as const:"unknown" as const,
    readout:"10Y "+sign(tenBp,"bp")+" / 30Y "+sign(thirtyBp,"bp")};
  })};
}
/** Independent public tape layer. The outlook/Story/qualitative research readers
 * remain unchanged; source markets cannot auto-reclassify a regime. */
export function projectRegimeMeterReadings(rows:readonly PublicMarketObservation[],
 breadth50:PublicMarketObservation|null,bonds:BondPressureMonitor,now:Date):
 Record<RegimeDirectionId,RegimeMeterReading>{
 return {
  energy:tape("energy",rows,["brent","wti"],"Brent / WTI crude",
   "Crude price proxy · not vessel or barrel flow","Price falling","Price rising",
   "A crude-price move does not establish shipping normalisation or physical fuel availability.",now),
  fed:tape("fed",rows,["us2y"],"US 2Y Treasury yield",
   "Front-end rate proxy · not FedWatch odds","Yield falling","Yield rising",
   "The 2Y yield reflects market pricing, not a Fed decision or verified policy probability.",now),
  bonds:treasury(bonds),
  ai:tape("ai",rows,["soxx","smh"],"Semiconductor equities",
   "Semiconductor price proxy · not AI cash-flow fundamentals","Price falling","Price rising",
   "Semiconductor ETF prices are not evidence that hyperscaler cash returns improved.",now),
  breadth:tape("breadth",breadth50?[breadth50]:[],["breadth:S5FI"],
   "S&P 500 above 50D","S&P member participation · provider reports 5D",
   "Breadth falling","Breadth rising",
   "Current-member breadth proxy is not the same series as the S5FI index close; 1D/3D changes are not inferred.",now,"5D")
 };
}
