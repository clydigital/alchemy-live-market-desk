import {creatorSourceKey,type CreatorDigest,type CreatorTake} from "./bluebelly-creator-signals.ts";
export type ArgumentSource={key:string;publisher:string;title:string;videoId:string|null;publishedAt:string|null;sourceStatus:CreatorTake["sourceStatus"]};
export type ArgumentCard={text:string;sources:ArgumentSource[]};
export type ArgumentGroup={id:"news"|"divergences"|"fundamentals"|"opinions"|"changed";title:string;cards:ArgumentCard[]};
const key=(s:string)=>s.trim().replace(/\s+/g," ").toLowerCase();
const source=(c:CreatorTake):ArgumentSource=>({key:creatorSourceKey(c),publisher:c.publisher,title:c.title,videoId:c.videoId,publishedAt:c.publishedAt,sourceStatus:c.sourceStatus});
/** Exact-text deduplication only. Different forecasts and horizons are retained.
 * Source count is not consensus; consolidated digest prose is not a verified fact. */
export function buildCreatorArgumentGroups(digest:CreatorDigest):ArgumentGroup[]{
 const groups:ArgumentGroup[]=[
  {id:"news",title:"Developments shaping markets",cards:[]},
  {id:"divergences",title:"Where markets are diverging",cards:[]},
  {id:"fundamentals",title:"The business and economic picture",cards:[]},
  {id:"opinions",title:"What could happen next",cards:[]},
  {id:"changed",title:"What has changed",cards:[]},
 ];
 const add=(id:ArgumentGroup["id"],value:string,c?:CreatorTake)=>{
  if(!value.trim())return;
  const g=groups.find(x=>x.id===id)!;
  let card=g.cards.find(x=>key(x.text)===key(value));
  if(!card){card={text:value,sources:[]};g.cards.push(card);}
  if(c&&!card.sources.some(x=>x.key===creatorSourceKey(c)))card.sources.push(source(c));
 };
 for(const s of digest.overview.news)add("news",s);
 for(const s of digest.overview.divergences)add("divergences",s);
 for(const c of digest.creators){
  for(const s of c.news)add("news",s,c);
  for(const s of c.fundamentals)add("fundamentals",s,c);
  for(const s of c.opinions)add("opinions",s,c);
  add("changed",c.changed,c);
 }
 return groups.filter(g=>g.cards.length);
}
