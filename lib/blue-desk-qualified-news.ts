import type { NewsBriefV1 } from "./market-brief-news";

/** One URL is one announcement; a verified canonical Motion takes precedence
 * over a receipt of the same original source. Event time never changes. */
export function combineQualifiedNews(
 motion:readonly NewsBriefV1[],official:readonly NewsBriefV1[],limit=12,
):NewsBriefV1[]{
 const map=new Map<string,NewsBriefV1>();
 for(const item of [...motion,...official]){
  if(item.verification!=="SOURCE_VERIFIED")continue;
  let key:string;
  try{
   const url=new URL(item.sourceUrl);
   if(url.protocol!=="https:")continue;
   key=url.origin+url.pathname.replace(/\/$/,"");
  }catch{continue;}
  if(!map.has(key))map.set(key,item);
 }
 return [...map.values()].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))
   .slice(0,Math.max(0,Math.min(18,limit)));
}
