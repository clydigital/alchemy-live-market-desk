import type {PublicMarketObservation} from "./blue-desk-public-markets";
import {expectedHomeEtfSession} from "./bluebelly-home-etf-history.ts";

export type CreatorSignal={asset:string;bias:"Bullish"|"Bearish"|"Neutral";horizon:string;signals:string[];sources:string[]};
export type CreatorTake={publisher:string;videoId:string|null;title:string;publishedAt:string|null;sourceStatus:"reviewed"|"handoff_reviewed"|"supplied";news:string[];views:CreatorSignal[];fundamentals:string[];opinions:string[];changed:string};
export type CreatorDigest={version:"creator-signals-v1";generatedAt:string;marketSession:string|null;coverage:string;overview:{headline:string;news:string[];signals:CreatorSignal[];divergences:string[]};creators:CreatorTake[]};
export const CREATOR_DIGEST_TITLE="Creator Market Intelligence — Current Signal Digest";
export function parseCreatorDigestHtml(html:string,now:Date):CreatorDigest|null{
 if(html.length>400_000)return null;
 const match=html.match(/<pre id="creator-signals-v1">([\s\S]*?)<\/pre>/);
 if(!match||match[1].includes('<'))return null;
 try{return parseCreatorDigest(JSON.parse(match[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')),now);}catch{return null;}
}
const obj=(v:unknown)=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
const str=(v:unknown,max=1000):v is string=>typeof v==="string"&&v.trim().length>0&&v.length<=max;
const list=(v:unknown,max=30):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(x=>str(x));
const date=(v:unknown,now:Date):v is string=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=+now;
const day=(v:unknown,now:Date):v is string=>date(v,now)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v).toISOString().slice(0,10)===v;
function signal(v:unknown):CreatorSignal|null{
 const r=obj(v);if(!r||!str(r.asset,40)||!['Bullish','Bearish','Neutral'].includes(String(r.bias))||!str(r.horizon,100)||!list(r.signals,8)||!r.signals.length||!list(r.sources??[],20))return null;
 return {asset:r.asset,bias:r.bias as CreatorSignal['bias'],horizon:r.horizon,signals:r.signals,sources:(r.sources??[]) as string[]};
}
function signals(v:unknown):CreatorSignal[]|null{
 if(!Array.isArray(v)||v.length>60)return null;const rows=v.map(signal);return rows.every(r=>r!==null)?rows as CreatorSignal[]:null;
}
export function creatorSourceKey(c:CreatorTake){return c.videoId??`${c.publisher} (supplied)`;}
export function parseCreatorDigest(v:unknown,now=new Date()):CreatorDigest|null{
 const r=obj(v),o=obj(r?.overview);if(!r||!o||r.version!=="creator-signals-v1"||!date(r.generatedAt,now)||!(r.marketSession===null||day(r.marketSession,now))||!str(r.coverage)||!str(o.headline)||!list(o.news)||!list(o.divergences)||!Array.isArray(r.creators)||!r.creators.length||r.creators.length>24)return null;
 const overviewSignals=signals(o.signals);if(!overviewSignals)return null;
 const creators:CreatorTake[]=[];const keys=new Set<string>();
 for(const item of r.creators){const c=obj(item);if(!c||!str(c.publisher,120)||!str(c.title,300)||!['reviewed','handoff_reviewed','supplied'].includes(String(c.sourceStatus))||!list(c.news)||!list(c.fundamentals,3)||!list(c.opinions,3)||!str(c.changed)||!(c.publishedAt===null||date(c.publishedAt,now)))return null;
  if(c.sourceStatus==='supplied'){
   // Owner-supplied transcript: no invented original video identity or date.
   if(c.videoId!==null&&!(typeof c.videoId==='string'&&/^[\w-]{11}$/.test(c.videoId)))return null;
  }else{
   // Authentic handoff reviews may have an exact video ID but lack a verified
   // original publication time. Do not reject the whole newer digest for this:
   // the UI labels that date as unverified and the Radar excludes the video
   // until a source-dated original is available.
   if(typeof c.videoId!=='string'||!(/^[\w-]{11}$/).test(c.videoId))return null;
   if(c.sourceStatus==='reviewed'&&c.publishedAt===null)return null;
  }
  const views=signals(c.views);if(!views)return null;
  const take={publisher:c.publisher,title:c.title,videoId:c.videoId as string|null,publishedAt:c.publishedAt as string|null,sourceStatus:c.sourceStatus as CreatorTake['sourceStatus'],news:c.news,views,fundamentals:c.fundamentals,opinions:c.opinions,changed:c.changed};
  const key=creatorSourceKey(take);if(keys.has(key))return null;keys.add(key);creators.push(take);
 }
 if(overviewSignals.some(s=>!s.sources.length||s.sources.some(k=>!keys.has(k))))return null;
 return {version:'creator-signals-v1',generatedAt:r.generatedAt,marketSession:r.marketSession,coverage:r.coverage,overview:{headline:o.headline,news:o.news,signals:overviewSignals,divergences:o.divergences},creators};
}
const indices=['SPX','SPY','NDX','QQQ','IWM','RUT','DJI','DJIA','DIA','RSP','VIX'];
const tech=['SMH','SOXX','NVDA','AMD','AVGO','MSFT','AAPL','META','GOOGL','GOOG','AMZN','TSLA','ANET','PLTR','MU','ORCL'];
function assetKey(s:string){return s.trim().toUpperCase().replace(/^\^/, '');}
const groupLabels=["Indices & broad market","XL sector ETFs","Technology & semiconductors","Other assets"] as const;
function creatorSignalRank(asset:string){const k=assetKey(asset);return indices.includes(k)?0:/^XL[A-Z]$/.test(k)?1:tech.includes(k)?2:3;}
export function creatorSignalGroup(asset:string){return groupLabels[creatorSignalRank(asset)];}
export function orderCreatorSignals(rows:readonly CreatorSignal[]){return [...rows].sort((a,b)=>creatorSignalRank(a.asset)-creatorSignalRank(b.asset));}
// Identity-based only: a cash index must never silently inherit its ETF's return.
const alias:Record<string,string[]>={SPX:['SPX','GSPC','SP500'],NDX:['NDX'],DJI:['DJI','DJIA'],DJIA:['DJI','DJIA'],RUT:['RUT'],XAUUSD:['XAUUSD','XAU/USD'],BTCUSD:['BTCUSD','BTC-USD']};
export function creatorMarketMatch(asset:string,market:readonly PublicMarketObservation[],now:Date){
 const k=assetKey(asset),keys=alias[k]??[k];const expected=expectedHomeEtfSession(now);
 const row=market.find(r=>keys.includes(assetKey(r.symbol))&&r.frequency==='daily'&&r.dataStatus!=='UNAVAILABLE_OR_STALE'&&r.asOf&&Number.isFinite(Date.parse(r.asOf))&&Date.parse(r.asOf)<=+now);
 if(!row||!row.asOf)return null;
 const session=row.asOf.slice(0,10);
 if(!expected||session>expected||+now-Date.parse(row.asOf)>7*86400_000)return null;
 return {...row,session,latestSession:session===expected};
}
