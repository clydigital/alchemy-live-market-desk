/** A conservative single-provider, session-dated price-comparison projection.
 * No intraday marks, inferred close, swapped instruments or mixed-feed returns.
 * Every reference is one of the original source's sorted daily observations.
 */
import type { MarketMonitorRow } from "./market-monitor.ts";

export type EditorialWindow = {
  sessions:1|3|5; label:string; referenceDate:string|null;
  reference:number|null; change:number|null; percent:number|null;
  unit:"%"|"bp"; reason:string|null;
};
export type EditorialPriceCard = {
  id:string; label:string; symbol:string; type:string;
  source:string; sourceUrl:string|null; lastDate:string|null;
  lastClose:number|null; levelUnit:"%"|"source units";
  status:"OBSERVED"|"STALE"|"UNKNOWN";
  caution:string; comparisons:EditorialWindow[];
};
const WINDOW_LABELS = [[1,"1 session"],[3,"3 sessions"],[5,"5 sessions"]] as const;
const DAY=86_400_000;
function isoDay(epoch:number):string|null {
  const millis=epoch<100_000_000_000?epoch*1000:epoch;
  if(!Number.isFinite(millis)||millis<0||millis>Date.UTC(2100,0,1))return null;
  return new Date(millis).toISOString().slice(0,10);
}
function validUrl(value:string):string|null {
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.toString():null;}
  catch{return null;}
}
export function editorialPriceCard(row:Pick<MarketMonitorRow,
  "id"|"label"|"symbol"|"type"|"frequency"|"sourceName"|"sourceUrl"|"points"|"asOf"|"last">,
  nowIso:string):EditorialPriceCard {
  const now=Date.parse(nowIso), today=nowIso.slice(0,10);
  const empty:EditorialPriceCard={
    id:row.id,label:row.label,symbol:row.symbol,type:row.type,
    source:row.sourceName,sourceUrl:validUrl(row.sourceUrl),lastDate:null,lastClose:null,
    levelUnit:row.type==="Rates"?"%":"source units",status:"UNKNOWN",
    caution:"No trustworthy completed daily observations available from this source.",
    comparisons:WINDOW_LABELS.map(([sessions,label])=>({
      sessions,label,referenceDate:null,reference:null,change:null,percent:null,
      unit:row.type==="Rates"?"bp":"%",reason:"Missing session-dated source bars",
    })),
  };
  if(!Number.isFinite(now)||row.frequency!=="daily"||!Array.isArray(row.points))return empty;
  const byDate=new Map<string,number>();
  for(const p of row.points) {
    const day=isoDay(p.time);
    if(!day||day>=today||(row.asOf&&day>row.asOf.slice(0,10))||
       typeof p.close!=="number"||!Number.isFinite(p.close)||p.close<=0)continue;
    byDate.set(day,p.close);
  }
  const points=[...byDate].sort(([a],[b])=>a.localeCompare(b))
    .map(([date,close])=>({date,close}));
  const last=points[points.length-1];
  if(!last) {
    // Keep a source-dated latest level when the history feed is unavailable.
    // Never infer completed-session returns from a single observation.
    const date=typeof row.asOf==="string"?row.asOf.slice(0,10):"";
    const age=Date.parse(date+"T00:00:00Z");
    if(row.frequency==="daily" && /^\\d{4}-\\d{2}-\\d{2}$/.test(date) &&
       Number.isFinite(age) && age<=now && typeof row.last==="number" &&
       Number.isFinite(row.last) && row.last>0)
      return {...empty,lastDate:date,lastClose:row.last,
        status:now-age>7*DAY?"STALE":"OBSERVED",
        caution:"Source-dated monitor level only. Completed-session history unavailable; changes withheld."};
    return empty;
  }
  const ageDays=(now-Date.parse(last.date+"T00:00:00Z"))/DAY;
  const older=ageDays>7;
  const comparisons:EditorialWindow[]=WINDOW_LABELS.map(([sessions,label])=>{
    const p=points[points.length-1-sessions];
    if(!p)return {sessions,label,referenceDate:null,reference:null,
      change:null,percent:null,unit:row.type==="Rates"?"bp" as const:"%" as const,
      reason:"Fewer than "+(sessions+1)+" dated daily observations"};
    const move=last.close-p.close;
    return {sessions,label,referenceDate:p.date,reference:p.close,
      change:row.type==="Rates"?Number((move*100).toFixed(2)):Number(move.toFixed(5)),
      percent:row.type==="Rates"?null:Number((move/p.close*100).toFixed(2)),
      unit:row.type==="Rates"?"bp" as const:"%" as const,reason:null};
  });
  return {...empty,lastDate:last.date,lastClose:last.close,
    status:older?"STALE":"OBSERVED",comparisons,
    caution:older
      ? "Last eligible daily source observation is over seven calendar days old."
      : "Source daily observations, not verified event-window ticks. Same-UTC-day bars withheld; check exchange close, adjusted/continuous series and contract rolls before publication."};
}
export function projectEditorialPriceCards(rows:readonly MarketMonitorRow[],nowIso:string) {
  const priority=["brent","wti","spx","ndx","dxy","usdjpy","us2y","us5y-fred","us10y-fred",
    "us20y-fred","us30y-fred","gold-proxy","hy-oas","smh","qqq","nvda","tsm","amd",
    "distillate","soxx","meta","us10y-real","jxy","eur","gbp"];
  const present=new Map(rows.map(r=>[r.id,r]));
  return priority.flatMap(id=>{
    const row=present.get(id);return row?[editorialPriceCard(row,nowIso)]:[];
  }).slice(0,24);
}
export function editorialPriceLines(card:EditorialPriceCard) {
  const level=card.lastClose===null?"UNKNOWN":card.lastClose.toFixed(card.type==="Rates"?3:2);
  const lines=[card.label+" ("+card.symbol+") — "+card.status+"; "+
    "last completed-date candidate "+(card.lastDate||"UNKNOWN")+", level "+level,
    "Source: "+card.source+"; "+(card.sourceUrl||"source URL unavailable")];
  for(const c of card.comparisons)lines.push(c.label+": "+
    (c.referenceDate===null?"UNKNOWN ("+c.reason+")":
      c.referenceDate+" → "+card.lastDate+"; "+
      (c.change===null?"UNKNOWN":(c.change>0?"+":"")+c.change+" "+(c.unit==="bp"?"bp":
        "source units")+(c.percent!==null?" ("+(c.percent>0?"+":"")+c.percent+"%)":""))));
  return lines.join("\n")+"\nCaveat: "+card.caution;
}
