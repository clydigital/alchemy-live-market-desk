import {isExcludedXWireHandle,normaliseXPostUrl} from "./x-sweep-core.ts";
/** Only public-source locators, not downloaded bytes, interpretation or permission to republish.
 * Never fetch arbitrary URLs on the application server. Unrecognised links remain on the original post. */
const LINK_HOSTS=["bluekurtic.com","oilprice.com","isw.pub","understandingwar.org","arena.ai","zerohedge.com","hfir.com","cnbc.com","kobeissiletter.com","substack.com","fred.stlouisfed.org","federalreserve.gov","eia.gov","sec.gov","bls.gov","bea.gov"];
export function xWireSourceMaterial(post:{text:string;images:string[];quoteUrl:string|null}){
 const valid=(raw:string,hosts:string[],image=false)=>{
  try{const url=new URL(raw);if(url.protocol!=="https:"||url.username||url.password||url.port||url.hash)return null;
   if(!hosts.some(h=>url.hostname===h||(!image&&url.hostname.endsWith("."+h))))return null;
   if(image){if(!/^\/media\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname))return null;
    if([...url.searchParams].some(([key,value])=>!(["name","format"].includes(key)&&/^[a-z0-9]+$/i.test(value))))return null;
   }else if(url.search)return null;
   return url.toString();
  }catch{return null;}
 };
 const imageUrls=[...new Set((post.images||[]).map(raw=>valid(raw,["pbs.twimg.com"],true)).filter((x):x is string=>Boolean(x)))].slice(0,4);
 const articleUrls=[...new Set((post.text.match(/https:\/\/[^\s<>"']+/g)||[]).map(raw=>valid(raw.replace(/[),.;]+$/,""),LINK_HOSTS)).filter((x):x is string=>Boolean(x)))].slice(0,2);
 let quoteUrl:string|null=null;try{if(post.quoteUrl){const q=normaliseXPostUrl(post.quoteUrl);if(!isExcludedXWireHandle(q.handle))quoteUrl=q.url;}}catch{}
 return {imageUrls,articleUrls,quoteUrl,interpretation:"NOT_REVIEWED" as const};
}
