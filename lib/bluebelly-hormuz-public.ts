import {crossingTrend,hormuzFreshness,type HormuzMonitor} from "./hormuz-monitor-core.ts";
import type {FlowMetric,GlobalFlowMonitor} from "./global-flow-monitor-core.ts";

/** Bounded, source-dated public projection. No private research triggers or market claims. */
export type HormuzWatchTile={
 id:string;label:string;category:"physical"|"crude"|"products"|"balances";
 value:string|null;previous:string|null;delta:string|null;
 observedAt:string|null;frequency:string;sourceName:string;sourceUrl:string|null;
 status:"available"|"stale"|"unavailable";explanation:string;
};
const SELECTED=[
 {id:"hormuz-insurance",label:"War-risk insurance",category:"physical"},
 {id:"brent-confirmation",label:"Brent crude",category:"crude"},
 {id:"wti-confirmation",label:"WTI crude",category:"crude"},
 {id:"distillate-crack",label:"US distillate crack proxy",category:"products"},
 {id:"gasoline-crack",label:"US gasoline crack proxy",category:"products"},
 {id:"321-crack",label:"US 3:2:1 crack proxy",category:"products"},
 {id:"us-distillate-stocks",label:"US distillate inventories",category:"balances"},
 {id:"us-refinery-utilisation",label:"US refinery utilisation",category:"balances"},
 {id:"us-crude-stocks",label:"US commercial crude inventories",category:"balances"},
 {id:"us-spr",label:"US Strategic Petroleum Reserve",category:"balances"},
] as const;
function safeLink(value:string):string|null{
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&!u.username&&!u.password&&value.length<=2000?u.href:null;
 }catch{return null;}
}
function sourceClock(value:string|null):number|null{
 if(!value)return null;
 const raw=/^\d{4}-\d{2}-\d{2}$/.test(value)?value+"T23:59:59Z":value;
 const t=Date.parse(raw);
 return Number.isFinite(t)?t:null;
}
function tileState(m:FlowMetric|undefined,now:number){
 if(!m||m.current===null||m.state!=="ready")return "unavailable" as const;
 const at=sourceClock(m.asOf);
 if(at===null||at>now+300000)return "stale" as const;
 const weekly=/Weekly|Monthly/i.test(m.cadence);
 return now-at>(weekly?15:4)*86400000?"stale" as const:"available" as const;
}
const DESCRIPTIONS:Record<string,string>={
 "hormuz-insurance":"A dated insurance multiple is an intermediary cost indication, not proof of an insurer's present quote.",
 "brent-confirmation":"Global crude benchmark. Price direction alone cannot establish how many barrels are reaching buyers.",
 "wti-confirmation":"US crude benchmark. Brent–WTI differences can reflect geography and logistics, not just Hormuz.",
 "distillate-crack":"US heating-oil/ULSD futures proxy less WTI crude, in $/bbl where source observations are available; it is not a Singapore gasoil or jet-fuel quote.",
 "gasoline-crack":"US RBOB gasoline versus WTI proxy; gasoline and diesel can diverge under refinery stress.",
 "321-crack":"Simplified 3:2:1 US refining margin proxy, not a refinery's realised profitability.",
 "us-distillate-stocks":"EIA weekly US diesel/heating-oil stocks. A draw can reinforce a product-tightness hypothesis, subject to the reporting week.",
 "us-refinery-utilisation":"EIA weekly US refinery capacity usage; higher runs can replenish fuels but are not a direct global export measure.",
 "us-crude-stocks":"EIA weekly commercial crude stocks excluding SPR. Builds and draws are US balances, not global wartime supply totals.",
 "us-spr":"EIA weekly SPR barrels; this cannot by itself identify the policy reasons for changes."
};
export function projectHormuzPublicWatch(monitor:GlobalFlowMonitor,now:Date){
 const byId=new Map(monitor.oil.map(x=>[x.id,x]));
 const tiles:HormuzWatchTile[]=SELECTED.map(x=>{
  const m=byId.get(x.id);
  return {
   id:x.id,label:x.label,category:x.category,
   value:m?.state==="ready"?m.current:null,
   previous:m?.state==="ready"?m.previous:null,
   delta:m?.state==="ready"?m.delta:null,
   observedAt:m?.asOf||null,
   frequency:m?.cadence||"Source not connected",
   sourceName:m?.sourceName||"Original data unavailable",
   sourceUrl:safeLink(m?.sourceUrl||""),
   status:tileState(m,now.getTime()),
   explanation:DESCRIPTIONS[x.id]
  };
 });
 const missingIds=["Gulf jet / kerosene spread","Singapore 10 ppm gasoil margin","Actual paid war-risk insurance quotes","Verified oil cargo barrels"].map(label=>({
   label,note:"No current directly comparable structured source in this public tracker; do not infer it from US crude or a vessel count."
 }));
 const crossing=monitor.hormuz||{
  snapshot:null,checkedAt:now.toISOString(),nextAttemptAt:null,refreshFailed:true
 } satisfies HormuzMonitor;
 const crossingState=hormuzFreshness(crossing,+now);
 const comparison=crossing.snapshot?crossingTrend(crossing.snapshot):null;
 return {tiles,crossing,crossingState,comparison,missingIds,
  available:tiles.filter(t=>t.status==="available").length,
  noPriceCausality:"Market changes are not attributed to a maritime event without matched timestamps and independent evidence.",
  dataLimit:"AIS counts are lower-bound observations under switch-offs, jamming and spoofing; all-vessel crossings are not cargo barrels."
 };
}
