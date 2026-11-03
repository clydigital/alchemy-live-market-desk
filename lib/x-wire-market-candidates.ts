import {X_CORE_ROSTER, normaliseXPostUrl} from "./x-sweep-core.ts";
import type {XWireDurable} from "./x-wire-durable.ts";

type WirePost=XWireDurable["posts"][number];
export type XMarketTheme="energy_shipping"|"macro_rates_fx"|"geopolitics"|"equities_ai"|"corporate"|"resilience_preparedness"|"cross_asset";
export type XMarketCandidate={post:WirePost;theme:XMarketTheme;priority:number};

/** Editorial significance signals, NOT verified claims, price measurements or evidence. */
const TOPICS:readonly {theme:XMarketTheme;regex:RegExp}[]=[
 {theme:"energy_shipping",regex:/\b(?:hormuz|strait|oil|brent|wti|crude|tanker|shipping|shipments|vessel|lng|opec|diesel|refiner(?:y|ies)?|pipeline|saudi|gulf|barrel|terminal|freight|red sea|maritime|port|bpd)\b/i},
 {theme:"macro_rates_fx",regex:/\b(?:fed|fomc|federal reserve|cpi|pce|inflation|payroll|nfp|treasury|bond|yield|rate cut|rate hike|interest rate|spread|ecb|boj|boe|dxy|yen|dollar|currency|usd.?jpy|usd.?cny|jgb|10.year|30.year|2.year|central bank)\b/i},
 {theme:"geopolitics",regex:/\b(?:missile|strike|attack|ceasefire|war|conflict|tariff|sanction|military|iran|israel|russia|ukraine|china|taiwan|drone|diplomacy|blockade)\b/i},
 {theme:"equities_ai",regex:/\b(?:earnings|revenue|guidance|capex|semiconductor|chips?|nvidia|amd|nasdaq|s&p.?500|stock market|stocks?|ai spending|data.?cent(?:er|re)|valuation|free cash flow|microsoft|meta|alphabet|oracle|coreweave|market breadth)\b/i},
 {theme:"resilience_preparedness",regex:/\b(?:stockpiling|stockpile|stock up|emergency kit|emergency supplies|red cross|civil preparedness|disaster preparedness|civil defence|civil defense|power grid|blackout|emergency preparedness|self.preparedness|crisis supplies|drinking water|shelter in place|strategic reserve)\b/i},
 {theme:"corporate",regex:/\b(?:merger|merging|ipo|initial public offering|prospectus|takeover|buyout|capital raise|debt financing|stock offering|profit warning|special committee|s.1 filing|bankruptcy|acquisition)\b/i},
 {theme:"cross_asset",regex:/\b(?:gold|silver|xau|xag|crypto|bitcoin|ether|market.?cap|liquidity|risk.?off|risk.?on|cross.?asset|futures selloff|asian shares)\b/i},
];
const SOURCE_PRIORITY=new Set(["hormuzreport","kobeissiletter","zerohedge","tgletter"]);
const HANDLES=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));

export function rankXWireMarketCandidates(posts:readonly WirePost[],now=new Date(),max=12):XMarketCandidate[]{
 const chosen:XMarketCandidate[]=[];
 const seen=new Set<string>(),byAccount=new Map<string,number>(),byTheme=new Map<XMarketTheme,number>();
 const valid=posts.flatMap(post=>{
  if(post.intakeStatus!=="discovery"||post.text.length<30)return [];
  const time=Date.parse(post.publishedAt),age=now.getTime()-time;
  if(!Number.isFinite(age)||age< -5*60_000||age>48*3_600_000)return [];
  let normalized:ReturnType<typeof normaliseXPostUrl>;
  try{normalized=normaliseXPostUrl(post.url);}catch{return [];}
  const handle=post.handle.toLowerCase();
  if(!HANDLES.has(handle)||normalized.handle.toLowerCase()!==handle||
     normalized.postId!==post.id)return [];
  const matched=TOPICS.filter(t=>t.regex.test(post.text));
  if(!matched.length)return [];
  const preferred=handle==="hormuzreport"?"energy_shipping":
    handle==="kobeissiletter"?"macro_rates_fx":
    handle==="tgletter"?"resilience_preparedness":
    handle==="macropaperr"?"cross_asset":null;
  const theme=matched.find(t=>t.theme===preferred)?.theme||matched[0].theme;
  const isFresh=age<6*3_600_000;
  const priority=65+(isFresh?8:0)+Math.min(matched.length,3)*3+
   (SOURCE_PRIORITY.has(handle)?8:0)+(/\b(?:breaking|confirmed|official|revised|unexpected)\b/i.test(post.text)?3:0);
  return [{post,theme,priority:Math.min(priority,95)}];
 }).sort((a,b)=>b.priority-a.priority||
   Date.parse(b.post.publishedAt)-Date.parse(a.post.publishedAt));
 for(const candidate of valid){
  const handle=candidate.post.handle.toLowerCase();
  if(seen.has(candidate.post.id)||chosen.length>=Math.min(Math.max(max,0),12)||
    (byAccount.get(handle)||0)>=3||(byTheme.get(candidate.theme)||0)>=5)continue;
  seen.add(candidate.post.id);
  byAccount.set(handle,(byAccount.get(handle)||0)+1);
  byTheme.set(candidate.theme,(byTheme.get(candidate.theme)||0)+1);
  chosen.push(candidate);
 }
 return chosen;
}
