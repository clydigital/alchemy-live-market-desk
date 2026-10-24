/**
 * Reader-only prior completed session context and attributed creator selection.
 * Does not mutate the canonical Story thesis, infer EMA values or treat creators
 * as independent primary-source verification.
 */
import type { EditorialPriceCard } from "./editorial-price-context.ts";

export type CloseScenario = {
  id:string; label:string; asOf:string|null; source:string; sourceUrl:string|null;
  observedClose:number|null; previousDate:string|null; previousClose:number|null;
  oneSessionChange:number|null; oneSessionUnit:"bp"|"%";
  threeSessionChange:number|null; fiveSessionChange:number|null;
  note:string; conditions:string; status:"OBSERVED"|"STALE"|"UNKNOWN";
};
const ASSET_THEMES:ReadonlyArray<{test:RegExp;ids:readonly string[]}>= [
 {test:/\b(?:crude|brent|wti|oil|diesel|fuel|hormuz|opec|energy)\b/i,ids:["brent","wti","spx"]},
 {test:/\b(?:treasury|treasuries|bond|yield|rates|fed|inflation|credit|duration|auction)\b/i,ids:["us2y","us10y-fred","us30y-fred"]},
 {test:/\b(?:yen|japan|boj|jgb|usd.?jpy)\b/i,ids:["usdjpy","us10y-fred","spx"]},
 {test:/\b(?:gold|silver|precious|metal|xau)\b/i,ids:["gold-proxy","us10y-fred","dxy"]},
 {test:/\b(?:ai|semiconductor|chip|nvidia|amd|tsmc|nasdaq|tech|earnings|capex)\b/i,ids:["smh","ndx","spx"]},
 {test:/\b(?:dollar|dxy|forex|currency|euro|pound|fx)\b/i,ids:["dxy","us2y","spx"]},
 {test:/\b(?:equity|stocks|shares|stock.market|s&p|russell)\b/i,ids:["spx","ndx","us10y-fred"]},
];
export function projectArticleCloseScenarios(topic:string,cards:readonly EditorialPriceCard[]):CloseScenario[]{
 const selector=ASSET_THEMES.find(row=>row.test.test(topic));
 const ids=selector?.ids||["spx","us10y-fred","brent"];
 const byId=new Map(cards.map(card=>[card.id,card]));
 return ids.flatMap(id=>{
  const c=byId.get(id);
  if(!c)return [];
  const d=c.comparisons.find(x=>x.sessions===1),t=c.comparisons.find(x=>x.sessions===3),f=c.comparisons.find(x=>x.sessions===5);
  const isRate=c.type==="Rates";
  const move=d?.change??null;
  const oneSessionChange=isRate?move:d?.percent??null;
  const noun=isRate?"yield":"price";
  const conditions=c.status!=="OBSERVED"||oneSessionChange===null?"No fresh completed daily comparison is available. Check the original session closes before interpreting any chart.":oneSessionChange>0
    ? `The last completed daily ${noun} rose. A subsequent completed close holding above the latest level would be consistent with continued strength; a reversal below the prior close would weaken it. Check the daily EMA20/EMA50 bands (±1 SD) and 4H structure independently before calling a trend.`
    :oneSessionChange<0
    ? `The last completed daily ${noun} fell. A subsequent close below the latest level would support downside follow-through; reclaiming the prior close would challenge it. Check the daily EMA20/EMA50 bands (±1 SD) and 4H structure independently before calling a breakdown.`
    :`The latest completed daily close was unchanged against its comparison. Watch a confirmed break in either direction and verify the 20/50 EMA bands before describing a trend.`;
  return [{id,label:c.label,asOf:c.lastDate,source:c.source,sourceUrl:c.sourceUrl,
    observedClose:c.lastClose,previousDate:d?.referenceDate??null,
    previousClose:d?.reference??null,oneSessionChange,oneSessionUnit:isRate?"bp":"%",
    threeSessionChange:isRate?(t?.change??null):(t?.percent??null),
    fiveSessionChange:isRate?(f?.change??null):(f?.percent??null),
    status:c.status,note:c.caution,conditions}];
 });
}
export type CreatorInput={
 publisher:string;title:string;url:string;published_at:string;
 transcript_status:string;video_analysis_status:string|null;
 recontextualized_summary:string|null;creator_logic:string|null;
};
export type CreatorPerspective={
 publisher:string;title:string;url:string;publishedAt:string;view:string;
};
const CREATORS=new Set(["StockedUp","Wall Street Truthbombs","FX Evolution","TraderNick","Traders Reality","Kevin Gerrity"]);
const TOPICS=[
 /\b(?:oil|brent|wti|hormuz|iran|energy|fuel)\b/i,
 /\b(?:treasury|bonds?|yields?|credit|fed|rates?|inflation|french|sovereign)\b/i,
 /\b(?:ai|chip|semiconductor|spx|nasdaq|nvidia|capex|stocks?|equities|tech)\b/i,
 /\b(?:gold|silver|bullion|metal|xau)\b/i,
 /\b(?:yen|japan|boj|jgb|usd.?jpy)\b/i,
 /\b(?:dollar|dxy|euro|sterling|gbp|forex|currency)\b/i,
];
function sourceUrl(value:string):boolean{
 try{const u=new URL(value);return u.protocol==="https:"&&
  (u.hostname==="www.youtube.com"||u.hostname==="youtube.com"||u.hostname==="youtu.be")&&
  (u.hostname==="youtu.be"||u.pathname==="/watch"||u.pathname.startsWith("/live/"))&&
  !u.username&&!u.password;
 }catch{return false;}
}
/** Preserve publisher attribution; never upgrade transcript summaries into facts. */
export function projectCreatorPerspectives(topic:string,rows:readonly CreatorInput[],nowIso:string):CreatorPerspective[]{
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now))return [];
 const wanted=TOPICS.flatMap((r,i)=>r.test(topic)?[i]:[]);
 const seen=new Set<string>(),publishers=new Set<string>();
 const output:CreatorPerspective[]=[];
 for(const row of [...rows].sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))){
  if(!CREATORS.has(row.publisher)||row.transcript_status!=="ready"||
    row.video_analysis_status==="failed"||!sourceUrl(row.url)||
    !row.title.trim()||!row.recontextualized_summary?.trim())continue;
  const at=Date.parse(row.published_at);
  if(!Number.isFinite(at)||at>now||now-at>14*86400000)continue;
  const creatorText=row.title+" "+row.recontextualized_summary;
  if(wanted.length&&!wanted.some(i=>TOPICS[i].test(creatorText)))continue;
  if(seen.has(row.url)||publishers.has(row.publisher))continue;
  const cleaned=row.recontextualized_summary.replace(/\s+/g," ").trim();
  if(cleaned.length<32)continue;
  seen.add(row.url);publishers.add(row.publisher);
  output.push({publisher:row.publisher,title:row.title.slice(0,160),url:row.url,
    publishedAt:row.published_at,view:cleaned.slice(0,500)+(cleaned.length>500?"…":"")});
  if(output.length===3)break;
 }
 return output;
}
