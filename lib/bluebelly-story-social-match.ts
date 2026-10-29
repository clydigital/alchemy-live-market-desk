import {X_CORE_ROSTER,normaliseXPostUrl,isExcludedXWireHandle} from "./x-sweep-core.ts";
import type {EmbeddedSocialContext} from "./bluebelly-event-social.ts";

export type Row={post_id:string;handle:string;original_url:string;published_at:string;body:string;intake_status:string};
export type Topic={id:string;title:string;fact:string;assets:readonly string[]};
const ALLOWED=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
function clue(topic:Topic):RegExp|null{
 const t=(topic.title+" "+topic.assets.join(" ")).toLowerCase();
 // A specific subject match is mandatory. Generic "market" or "AI" alone
 // is not enough to attach an unrelated post to a company release.
 if(/\b(?:hormuz|tanker|brent|crude|oil|opec|lng|shipping)\b/.test(t))
   return /\b(?:hormuz|tanker|brent|crude|oil|opec|lng|shipping)\b/i;
 if(/\b(?:rbnz|new zealand|nzd|ocr)\b/.test(t))
   return /\b(?:rbnz|new zealand|nzd|ocr)\b/i;
 if(/\b(?:amazon|amzn|aws)\b/.test(t))
   return /\b(?:amazon|amzn|aws)\b/i;
 if(/\b(?:alphabet|google|googl)\b/.test(t))
   return /\b(?:alphabet|google|googl)\b/i;
 if(/\b(?:microsoft|msft|azure)\b/.test(t))
   return /\b(?:microsoft|msft|azure)\b/i;
 if(/\b(?:nvidia|nvda|hynix|tsmc|semiconductor|chips?|hbm)\b/.test(t))
   return /\b(?:nvidia|nvda|hynix|tsmc|semiconductor|chips?|hbm)\b/i;
 if(/\b(?:fomc|federal reserve|\bfed\b|warsh)\b/.test(t))
   return /\b(?:fomc|federal reserve|\bfed\b|warsh)\b/i;
 if(/\b(?:treasury|bond|credit|yield curve)\b/.test(t))
   return /\b(?:treasury|bond|credit|yield)\b/i;
 if(/\b(?:usd.?jpy|yen|bank of japan|boj)\b/.test(t))
   return /\b(?:usd.?jpy|yen|bank of japan|boj)\b/i;
 return null;
}
export function matchPublicStoryXPosts(topics:readonly Topic[],rows:readonly Row[],now:Date){
 const byTopic:Record<string,EmbeddedSocialContext[]>={};
 const seen=new Set<string>();
 const minimum=+now-48*3_600_000;
 if(!Number.isFinite(+now))return byTopic;
 for(const topic of topics.slice(0,5)){
  const anchor=clue(topic);
  if(!anchor)continue;
  for(const post of rows){
   if(post.intake_status!=="discovery"||typeof post.body!=="string"||
       post.body.length<25||post.body.length>8000||!anchor.test(post.body))continue;
   const at=Date.parse(post.published_at);
   if(!Number.isFinite(at)||at<minimum||at>+now)continue;
   const handle=post.handle.toLowerCase();
   if(!ALLOWED.has(handle)||isExcludedXWireHandle(handle)||seen.has(post.post_id))continue;
   let link:ReturnType<typeof normaliseXPostUrl>;
   try{link=normaliseXPostUrl(post.original_url)}catch{continue}
   if(link.handle.toLowerCase()!==handle||link.postId!==post.post_id)continue;
   seen.add(post.post_id);
   byTopic[topic.id]=[{id:post.post_id,url:link.url,handle:link.handle,
     postedAt:new Date(at).toISOString(),
     caption:post.body.trim().replace(/\s+/g," ").slice(0,200),
     phase:"AFTER DECISION"}];
   break;
  }
 }
 return byTopic;
}
