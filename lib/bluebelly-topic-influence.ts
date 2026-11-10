import {X_CORE_ROSTER,normaliseXPostUrl} from "./x-sweep-core.ts";
import {rankXWireMarketCandidates} from "./x-wire-market-candidates.ts";
import type {XWireDurable} from "./x-wire-durable.ts";

/** Display-only discovery, not independent verification or a canonical Regime mutation. */
export const INFLUENCE_TOPICS=["hormuz","fed","bonds","ai","china","energy","yen","breadth","gold","housing"] as const;
export type InfluenceTopic=typeof INFLUENCE_TOPICS[number];
export type InfluenceLead={
 id:string;
 source:"X"|"CREATOR";
 sourceName:string;
 url:string;
 title:string;
 reason:string;
 excerpt:string;
 publishedAt:string;
 reviewedAt:string|null;
 nextCheck:string;
 verification:"UNVERIFIED_LEAD";
};
export type InfluenceSourceState="AVAILABLE"|"EMPTY"|"UNAVAILABLE";
export type TopicInfluenceRead={
 topic:InfluenceTopic;
 checkedAt:string;
 xState:InfluenceSourceState;
 creatorState:InfluenceSourceState;
 x:InfluenceLead[];
 creators:InfluenceLead[];
};
export type XInfluenceRow={
 post_id:string;handle:string;original_url:string;published_at:string;
 retrieved_at:string|null;body:string;intake_status:string;
};
export type CreatorInfluenceRow={
 external_id:string|null;publisher:string;title:string;url:string;
 published_at:string;transcript_interpreted_at:string|null;
 transcript_status:string|null;video_review_status:string|null;
 recontextualized_summary:string|null;summary:string|null;
 claim_checks:unknown;
};
const DAY=86400000;
type ReasonRule={pattern:RegExp;reason:string;check:string};
const RULES:Record<InfluenceTopic,ReasonRule[]>={
 hormuz:[
  {pattern:/\b(ceasefire|mediat\w*|negotiat\w*|doha|peace talks?|sanction\w*|reopen\w*)\b/i,reason:"Is a diplomatic breakthrough actually agreed and enforceable?",check:"Confirm original statements from all parties, then ship passages rather than proposals."},
  {pattern:/\b(tanker|shipping|maritime|insurance|crossings?|vessel|strait|blocked|warship)\b/i,reason:"Is ship traffic actually recovering or deteriorating?",check:"Compare AIS crossings, UKMTO incident logs and maritime insurance signals."},
  {pattern:/\b(diesel|gasoline|crack spreads?|brent|crude|fuel|refin\w*|lng)\b/i,reason:"Are energy and refined-fuel markets confirming supply pressure?",check:"Check dated crude, distillate, LNG and refinery data against physical flows."},
 ],
 fed:[
  {pattern:/\b(nfp|payroll|job loss|hiring|unemploy\w*|labor|labour|jobs report)\b/i,reason:"Are labour-market details changing the Fed growth outlook?",check:"Check BLS sector payrolls, revisions, unemployment and wage measures."},
  {pattern:/\b(cpi|pce|inflation|disinflation|sticky prices|core price)\b/i,reason:"Is inflation broadening or easing beneath the headline?",check:"Compare official CPI/PCE components, breadth and release periods."},
  {pattern:/\b(fomc|powell|fed funds|rate cut|rate hike|dot plot|central bank)\b/i,reason:"Are the policy path and market pricing diverging?",check:"Check Fed releases against dated front-end Treasury and futures pricing."},
 ],
 bonds:[
  {pattern:/\b(auction|bid.to.cover|tail|treasury issuance|debt supply|term premium)\b/i,reason:"Is Treasury supply or auction demand repricing duration?",check:"Check official auction results, issuance plans and matched maturity yields."},
  {pattern:/\b(tlt|long.bond|30.y(?:ear)?|10.y(?:ear)?|duration|real yields?)\b/i,reason:"Are long-bond prices and yields signalling a duration shift?",check:"Compare TLT, Treasury yields, term premium and actual total returns."},
  {pattern:/\b(credit spread|default|refinanc\w*|funding stress|corporate bonds?)\b/i,reason:"Is refinancing or credit stress spreading?",check:"Verify credit spreads, financing terms and issuer maturity schedules."},
 ],
 ai:[
  {pattern:/\b(capex|capital expenditure|cash flow|free cash|fcf|debt|financ\w*|lease|funding)\b/i,reason:"Can AI investment convert into cash flow without excessive financing?",check:"Reconcile issuer capex, operating cash flow, leases, debt and maturity disclosures."},
  {pattern:/\b(nvidia|nvda|gpu|hbm|semiconductor|chips?|memory|hynix|micron)\b/i,reason:"Is demand for AI hardware sustainable beyond current orders?",check:"Check issuer shipments, margins, backlog and inventory disclosures."},
  {pattern:/\b(cloud|hyperscaler|compute|data cent(?:re|er)|inference|ai revenue|azure|aws)\b/i,reason:"Is AI utilisation and revenue keeping pace with new capacity?",check:"Compare hyperscaler segment revenue, utilisation and disclosed capital commitments."},
 ],
 china:[
  {pattern:/\b(export controls?|sanction\w*|tariff|chip restriction|trade war)\b/i,reason:"Are trade restrictions changing the China–US compute cost gap?",check:"Check official export-control texts and issuer exposure disclosures."},
  {pattern:/\b(deepseek|model|ai|compute|memory|cxmt|hbm|semiconductor)\b/i,reason:"Is Chinese compute progress changing competition or margins?",check:"Verify benchmarks, hardware access, manufacturing yields and pricing."},
 ],
 energy:[
  {pattern:/\b(hormuz|iran|tanker|ship\w*|freight|strait|sanction\w*)\b/i,reason:"Is geopolitics affecting physical energy availability?",check:"Check actual vessel flows, sanctions, security and delivery receipts."},
  {pattern:/\b(diesel|crack|refin\w*|gasoline|distillate|inventory)\b/i,reason:"Are refined products tightening independently of crude?",check:"Cross-check official refinery runs, EIA stocks and product crack spreads."},
  {pattern:/\b(lng|natural gas|gas export|pipeline|electricity)\b/i,reason:"Is gas or LNG scarcity becoming an inflation channel?",check:"Check terminal flows, gas storage and delivered market pricing."},
 ],
 yen:[
  {pattern:/\b(boj|jgb|japan yields?|japanese bond|u[e]da)\b/i,reason:"Are Japanese policy and JGB yields shifting the carry equation?",check:"Check BOJ guidance, JGB auctions and rate differentials."},
  {pattern:/\b(usd.?jpy|yen|jpy|carry trade|funding|unwind)\b/i,reason:"Is yen funding pressure transmitting across markets?",check:"Compare USDJPY, cross-currency funding and matched risk-asset moves."},
 ],
 breadth:[
  {pattern:/\b(breadth|equal.weight|rsp|s5fi|s5th|50.day|200.day|small.cap|russell)\b/i,reason:"Is market participation strengthening or narrowing?",check:"Check equal-weight breadth and the percentage above 50D/200D averages."},
  {pattern:/\b(nasdaq|smh|semiconductor|megacap|index concentration)\b/i,reason:"Is index strength concentrated in a few technology stocks?",check:"Compare cap-weighted versus equal-weight returns and sector participation."},
  {pattern:/\b(credit|banks?|provisions|defaults?|earnings)\b/i,reason:"Are credit and issuer profits consistent with risk appetite?",check:"Check spreads, bank provisions and breadth of earnings revisions."},
 ],
 gold:[
  {pattern:/\b(real yield|treasury|dxy|dollar|fed|rate cut)\b/i,reason:"Is gold responding to real yields or the dollar?",check:"Compare same-session real yields, DXY and spot gold."},
  {pattern:/\b(reserve|central bank|gold purchase|bullion|official buying)\b/i,reason:"Is reserve diversification supporting gold demand?",check:"Verify published central-bank reserve purchases and reporting dates."},
 ],
 housing:[
  {pattern:/\b(mortgage|affordab\w*|home sales|housing starts?|builder|home prices?)\b/i,reason:"Are borrowing costs changing housing demand?",check:"Compare mortgage rates, official sales, permits and affordability."},
  {pattern:/\b(rent|shelter cpi|housing inflation|delinquenc\w*|construction)\b/i,reason:"Is housing stress feeding inflation or credit?",check:"Check shelter inflation, rent and mortgage delinquency releases."},
 ],
};
const THEMES:Record<InfluenceTopic,RegExp>={
 hormuz:/\b(?:hormuz|strait of hormuz|iran|iranian|tehran|persian gulf|gulf of oman|ceasefire|doha talks|qatar mediation|shipping blockade)\b/i,
 fed:/\b(?:fed|fomc|federal reserve|powell|pce|cpi|inflation|payrolls?|labou?r|rate cuts?|rate hikes?)\b/i,
 bonds:/\b(?:treasur\w*|bonds?|tlt|duration|auction|yields?|credit spread|term premium|refinanc\w*)\b/i,
 ai:/\b(?:artificial intelligence|ai|nvidia|nvda|semiconductor|hyperscaler|gpu|hbm|coreweave|crwv|data cent(?:re|er)|aws|azure|google cloud|ai capex|compute financing)\b/i,
 china:/\b(?:china|chinese|beijing|deepseek|cxmt|export control|trade war|chip restrictions?)\b/i,
 energy:/\b(?:oil|brent|wti|diesel|refin\w*|lng|natural gas|hormuz|opec|tanker|crude|fuel|energy)\b/i,
 yen:/\b(?:japan|japanese|boj|jgb|usd.?jpy|yen|jpy|carry trade)\b/i,
 breadth:/\b(?:breadth|equal.weight|rsp|s5fi|s5th|small.cap|russell|nasdaq|smh|equity participation|stock concentration)\b/i,
 gold:/\b(?:gold|bullion|reserve purchases?|precious metal|real yields?)\b/i,
 housing:/\b(?:housing|mortgage|home sales|house prices|shelter cpi|rent inflation|homebuilder|affordability)\b/i,
};
const CHECKS:Record<InfluenceTopic,string>={
 hormuz:"Confirm diplomacy against security notices, vessel crossings and dated fuel data.",
 fed:"Check Fed and BLS/BEA release details and same-session pricing.",
 bonds:"Check official Treasury auctions, duration, rates and spreads.",
 ai:"Check issuer capex, cash flow, utilisation, margins and debt.",
 china:"Check official export rules, independent tests and disclosed chip economics.",
 energy:"Check dated flows, inventories, refined products and freight.",
 yen:"Check BOJ/JGB releases, USDJPY and funding stress.",
 breadth:"Check equal-weight participation, momentum breadth and credit.",
 gold:"Check official reserve purchases, real yields, DXY and spot.",
 housing:"Check mortgage rates, sales, starts, rents and housing inflation.",
};
/** Select an explicit research question from visible post or private reviewed-video signals;
 * never assert that the source proved the mechanism. */
export function reasonForTopic(topic:InfluenceTopic,raw:string):{reason:string;check:string}{
 const matched=RULES[topic].find(rule=>rule.pattern.test(raw));
 return matched?{reason:matched.reason,check:matched.check}:
 {reason:"Could this new "+topic+" source change the current research view?",check:CHECKS[topic]};
}
const APPROVED_CREATORS=new Set(["stockedup","wall street truthbombs","fx evolution","tradernick"]);
const ALLOWED_X=new Set(X_CORE_ROSTER.map(row=>row.handle.toLowerCase()));
const clean=(v:unknown,max=240)=>typeof v==="string"?v.replace(/\s+/g," ").trim().slice(0,max):"";
function validDate(value:string|null|undefined,now:Date,maxAgeMs:number):boolean{
 if(!value)return false;
 const date=Date.parse(value),current=now.getTime();
 return Number.isFinite(date)&&date<=current+300000&&date>=current-maxAgeMs;
}
function videoSource(url:string,id:string):boolean{
 if(!/^[A-Za-z0-9_-]{11}$/.test(id))return false;
 try{
  const u=new URL(url);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return false;
  if(["www.youtube.com","youtube.com","m.youtube.com"].includes(u.hostname))
   return u.pathname==="/watch"&&u.searchParams.get("v")===id;
  return u.hostname==="youtu.be"&&u.pathname==="/"+id;
 }catch{return false;}
}
function selectedClaim(value:unknown,pattern:RegExp):{claim:string;target:string}|null{
 if(!Array.isArray(value))return null;
 for(const raw of value.slice(0,10)){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
  const row=raw as Record<string,unknown>;
  const claim=clean(row.claim,260),target=clean(row.verificationTarget,250);
  if(pattern.test(claim+" "+target)&&claim)return {claim,target};
 }
 return null;
}
/** Repeatable, bounded source projection. A video being discovered is NOT a completed transcript. */
export function projectTopicInfluence(
 topic:InfluenceTopic,xRows:readonly XInfluenceRow[],videoRows:readonly CreatorInfluenceRow[],
 now=new Date(),xState:InfluenceSourceState="AVAILABLE",creatorState:InfluenceSourceState="AVAILABLE",
):TopicInfluenceRead{
 const theme=THEMES[topic],checkedAt=now.toISOString();
 const eligiblePosts=xRows.filter(p=>p.intake_status==="discovery"&&ALLOWED_X.has(p.handle.toLowerCase())&&
  validDate(p.published_at,now,48*3600000)&&theme.test(p.body));
 const posts:XWireDurable["posts"]=eligiblePosts.map(p=>({
  id:p.post_id,handle:p.handle,url:p.original_url,publishedAt:p.published_at,text:p.body,
  images:[],quoteUrl:null,attribution:"THIRD_PARTY_ONLY" as const,intakeStatus:"discovery" as const,
 }));
 // Preserve existing priority ranking; supplement only with source-validated
 // topic matches (e.g. gold/housing) absent from the general Market candidate taxonomy.
 const preferred=rankXWireMarketCandidates(posts,now,12).slice(0,3).map(candidate=>candidate.post);
 const rankedIds=new Set(preferred.map(post=>post.id));
 const candidates=[...preferred,...posts.filter(post=>!rankedIds.has(post.id))
  .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))];
 const x:InfluenceLead[]=[];
 const usedX=new Set<string>();
 for(const post of candidates){
  if(x.length>=3)break;
  let normal:ReturnType<typeof normaliseXPostUrl>;
  try{normal=normaliseXPostUrl(post.url);}catch{continue;}
  if(normal.postId!==post.id||normal.handle.toLowerCase()!==post.handle.toLowerCase()||
    !ALLOWED_X.has(post.handle.toLowerCase())||post.text.length<30||usedX.has(post.id))continue;
  const original=eligiblePosts.find(row=>row.post_id===post.id);
  const why=reasonForTopic(topic,post.text);
  x.push({
   id:"x:"+normal.postId,source:"X",sourceName:"@"+post.handle,url:normal.url,
   title:"X Wire report to verify",reason:why.reason,excerpt:clean(post.text,240),publishedAt:post.publishedAt,
   reviewedAt:original?.retrieved_at||null,nextCheck:why.check,
   verification:"UNVERIFIED_LEAD",
  });
  usedX.add(post.id);
 }
 const creators:InfluenceLead[]=[];
 const used=new Set<string>(),seen=new Set<string>();
 for(const video of [...videoRows].sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))){
  const creator=clean(video.publisher,60);
  if(!APPROVED_CREATORS.has(creator.toLowerCase())||used.has(creator.toLowerCase())||
   video.transcript_status!=="ready"||video.video_review_status!=="reviewed"||
   !validDate(video.published_at,now,14*DAY)||
   !validDate(video.transcript_interpreted_at,now,14*DAY)||
   !video.external_id||!videoSource(video.url,video.external_id)||
   seen.has(video.external_id))continue;
  const claim=selectedClaim(video.claim_checks,theme);
  const summary=clean(video.recontextualized_summary||video.summary,420);
  if(!theme.test(video.title+" "+summary)&&!claim)continue;
  if(!claim&&!summary)continue;
  const why=reasonForTopic(topic,[video.title,summary,claim?.claim,claim?.target].filter(Boolean).join(" "));
  creators.push({
   id:"video:"+video.external_id,source:"CREATOR",sourceName:creator,
   url:video.url,title:clean(video.title,160),reason:why.reason,
   // Never publish the private transcript-derived claim or review summary.
   // Only public video metadata and a generic topic check leave this projector.
   excerpt:topic==="ai"?"Video identified for AI demand, financing or cash-conversion research. Its underlying claims remain unverified.":
    "Video identified for Iran, Hormuz or maritime-risk research. Its underlying claims remain unverified.",
   publishedAt:video.published_at,reviewedAt:video.transcript_interpreted_at,
   nextCheck:why.check,verification:"UNVERIFIED_LEAD",
  });
  used.add(creator.toLowerCase());seen.add(video.external_id);
  if(creators.length===2)break;
 }
 return {topic,checkedAt,xState:xState==="UNAVAILABLE"?"UNAVAILABLE":x.length?"AVAILABLE":"EMPTY",
  creatorState:creatorState==="UNAVAILABLE"?"UNAVAILABLE":creators.length?"AVAILABLE":"EMPTY",x,creators};
}
