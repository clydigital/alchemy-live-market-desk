import type {HormuzWatchTile} from "./bluebelly-hormuz-public.ts";

/** Source-dated direction-only measurements, not likelihood, scarcity or causal scores. */
export type AcceleratorDirection=-1|0|1|null;
export type EnergyAcceleratorReading={
 id:string;label:string;interpretation:string;leftLabel:string;rightLabel:string;
 metricId:string;direction:AcceleratorDirection;state:HormuzWatchTile["status"];
 current:string|null;change:string|null;observedAt:string|null;
 sourceUrl:string|null;sourceName:string;
};
export type EnergyAcceleratorGroup={
 id:"crude"|"diesel"|"gasoline";title:string;subtitle:string;
 scope:string;nextTest:string;readings:EnergyAcceleratorReading[];
};
type DialSpec={id:string;label:string;metricId:string;interpretation:string;leftLabel:string;rightLabel:string};
type GroupSpec=Omit<EnergyAcceleratorGroup,"readings">&{readings:DialSpec[]};
const SPEC:GroupSpec[]=[
 {id:"crude",title:"CRUDE OIL",scope:"US stocks / throughput; global Brent",
 subtitle:"Does more crude reach refineries, and is the stock cushion rebuilding?",
 nextTest:"Check EIA crude inventory and refinery intake together, then Gulf physical shut-ins and actual cargo arrivals.",
 readings:[
  {id:"crude-stock",label:"Stock cushion",metricId:"us-crude-stocks",interpretation:"Weekly US commercial crude stock change, not global production.",leftLabel:"Drawing",rightLabel:"Building"},
  {id:"crude-runs",label:"Refinery intake",metricId:"us-refinery-inputs",interpretation:"US refinery crude intake, a processing-demand proxy, not consumer fuel purchases.",leftLabel:"Slowing",rightLabel:"Rising"},
  {id:"crude-price",label:"Brent price",metricId:"brent-confirmation",interpretation:"Dated Brent price change. Price direction cannot establish lost or recovered barrels.",leftLabel:"Falling",rightLabel:"Rising"}
 ]},
 {id:"diesel",title:"DIESEL / DISTILLATES",scope:"US weekly balances and US crack proxy",
 subtitle:"Is diesel supply rebuilding quickly enough to meet freight and industrial use?",
 nextTest:"Check US distillate stocks, product supplied and crack together; then verify Europe/Asia gasoil exports, refinery output and freight demand.",
 readings:[
  {id:"diesel-stock",label:"Stock cushion",metricId:"us-distillate-stocks",interpretation:"Weekly distillate inventory change: a build does not prove global diesel abundance.",leftLabel:"Drawing",rightLabel:"Building"},
  {id:"diesel-demand",label:"Demand proxy",metricId:"us-distillate-demand",interpretation:"US product supplied includes more than road diesel and is not directly measured final consumption.",leftLabel:"Cooling",rightLabel:"Rising"},
  {id:"diesel-margin",label:"Diesel crack",metricId:"distillate-crack",interpretation:"US distillate-versus-crude price proxy, not a global diesel shortage meter.",leftLabel:"Narrowing",rightLabel:"Widening"}
 ]},
 {id:"gasoline",title:"GASOLINE / PETROL",scope:"US weekly balances and US crack proxy",
 subtitle:"Are drivers using more petrol than refineries and imports can replace?",
 nextTest:"Compare US gasoline stocks with four-week product supplied, production/imports and the crack; verify seasonal context.",
 readings:[
  {id:"gasoline-stock",label:"Stock cushion",metricId:"us-gasoline-stocks",interpretation:"US gasoline inventory change; a build can reflect more supply, less demand or both.",leftLabel:"Drawing",rightLabel:"Building"},
  {id:"gasoline-demand",label:"Demand proxy",metricId:"us-implied-demand",interpretation:"US weekly finished motor gasoline product supplied, not direct pump sales.",leftLabel:"Cooling",rightLabel:"Rising"},
  {id:"gasoline-margin",label:"Petrol crack",metricId:"gasoline-crack",interpretation:"US gasoline-versus-crude price proxy; compare matched periods, not a global retail petrol quote.",leftLabel:"Narrowing",rightLabel:"Widening"}
 ]}
];
/** Parsing is deliberately bounded to provider numeric text; stale/invalid data park the needle. */
export function signOfSourceChange(delta:string|null):AcceleratorDirection{
 if(!delta)return null;
 const match=/^([+-]?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?)(?:\s|%|$)/.exec(delta.trim());
 if(!match)return null;
 const value=Number(match[1].replaceAll(",",""));
 if(!Number.isFinite(value))return null;
 return value>0?1:value<0?-1:0;
}
export function buildEnergyAccelerators(tiles:readonly HormuzWatchTile[]):EnergyAcceleratorGroup[]{
 const byId=new Map(tiles.map(t=>[t.id,t]));
 return SPEC.map(group=>({...group,readings:group.readings.map(item=>{
  const tile=byId.get(item.metricId);
  const state=tile?.status||"unavailable";
  const direction=state==="available"?signOfSourceChange(tile?.delta||null):null;
  return {...item,direction,state,current:tile?.value||null,change:tile?.delta||null,
   observedAt:tile?.observedAt||null,sourceUrl:tile?.sourceUrl||null,
   sourceName:tile?.sourceName||"Source not connected"};
 })}));
}
