import type { NewsBriefV1 } from "./market-brief-news";

/** One URL is one announcement; a verified canonical Motion takes precedence
 * over a receipt of the same original source. Event time never changes. */
export function combineQualifiedNews(
 motion:readonly NewsBriefV1[],official:readonly NewsBriefV1[],limit=12,
):NewsBriefV1[]{
 const map=new Map<string,NewsBriefV1>();
 for(const [index,item] of [...motion,...official].entries()){
  if(item.verification!=="SOURCE_VERIFIED")continue;
  let key:string;
  try{
   const url=new URL(item.sourceUrl);
   if(url.protocol!=="https:")continue;
   key=url.origin+url.pathname.replace(/\/$/,"");
  }catch{continue;}
  const prior=map.get(key);
  if(!prior){map.set(key,item);continue;}
  // A genuine original-page fact receipt may replace a headline-only Motion,
  // but NEVER a source-rich Motion; neither path changes verification status.
  const isOfficial=index>=motion.length;
  const hasFacts=item.summary.trim().length>item.headline.length*0.6 &&
    !item.summary.startsWith("The original publisher issued this dated announcement.") &&
    item.summary.trim()!==item.headline.trim();
  const priorWeak=prior.summary.trim()===prior.headline.trim() ||
    prior.summary.startsWith("The original publisher issued this dated announcement.");
  if(isOfficial&&hasFacts&&priorWeak)map.set(key,item);
 }
 return [...map.values()].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))
   .slice(0,Math.max(0,Math.min(18,limit)));
}
