import {X_CORE_ROSTER, normaliseXPostUrl} from "./x-sweep-core.ts";
import type {XWireDurable} from "./x-wire-durable.ts";
import {classifyXFlash,permitsXResearch,xWireSourcePolicy,xWireNearDuplicate} from "./x-wire-source-policy.ts";

type WirePost=XWireDurable["posts"][number];
export type XMarketTheme="energy_shipping"|"macro_rates_fx"|"geopolitics"|"equities_ai"|"corporate"|"resilience_preparedness";
export type XMarketCandidate={post:WirePost;theme:XMarketTheme;priority:number};

/** Editorial significance signals, NOT verified claims, price measurements or evidence. */
const TOPICS:readonly {theme:XMarketTheme;regex:RegExp}[]=[
 {theme:"energy_shipping",regex:/\b(?:hormuz|strait|oil|brent|wti|crude|tanker|shipping|vessel|lng|natural gas|nat gas|opec|diesel|fuel|refin(?:er(?:y|ies)?|ing|ed)|crack spreads?|pipeline|saudi|gulf|barrel|terminal|freight|red sea|maritime|port|bpd)\b/i},
 {theme:"macro_rates_fx",regex:/\b(?:fed|fomc|federal reserve|cpi|pce|inflation|payroll|nfp|jobless claims|gdp|exports?|imports?|treasury|bond|yield|rate cut|rate hike|interest rate|spread|ecb|boj|boe|dxy|yen|dollar|currency|usd.?jpy|usd.?cny|jgb|10.year|30.year|2.year|central bank)\b/i},
 {theme:"geopolitics",regex:/\b(?:missile|strike|attack|ceasefire|war|conflict|tariff|sanction|military|iran|israel|russia|ukraine|china|taiwan|drone|diplomacy|blockade)\b/i},
 {theme:"equities_ai",regex:/\b(?:earnings|revenue|guidance|capex|semiconductor|chips?|nvidia|amd|nasdaq|s&p.?500|spx|spy|qqq|ndx|rsp|smh|stock market|stocks?|ai spending|data.?cent(?:er|re)|valuation|free cash flow|microsoft|meta|alphabet|oracle|coreweave|anthropic|market breadth|breadth thrust|moving average|seasonality|drawdown|positioning|short interest)\b/i},
 {theme:"resilience_preparedness",regex:/\b(?:stockpiling|stockpile|stock up|emergency kit|emergency supplies|red cross|civil preparedness|disaster preparedness|civil defence|civil defense|power grid|blackout|emergency preparedness|self.preparedness|crisis supplies|drinking water|shelter in place|strategic reserve)\b/i},
 {theme:"corporate",regex:/\b(?:merger|merging|ipo|initial public offering|prospectus|takeover|buyout|capital raise|debt financing|stock offering|profit warning|special committee|s.1 filing|bankruptcy|acquisition)\b/i},
];
/** Keyword classification for display only; it does not verify a claim. */
export function classifyXWireThemes(body:string):XMarketTheme[] {
 return TOPICS.filter(topic=>topic.regex.test(body)).map(topic=>topic.theme);
}
const SOURCE_PRIORITY=new Set(["hormuzreport","thestudyofwar","oilandenergy"]);
const HANDLES=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));

export function rankXWireMarketCandidates(posts:readonly WirePost[],now=new Date(),max=12,options:{allowDeferred?:boolean;maxAgeHours?:number;prioritizeKobeissi?:boolean}={}):XMarketCandidate[]{
 const maxAgeHours=Math.min(168,Math.max(1,options.maxAgeHours??48));
 const chosen:XMarketCandidate[]=[];
 const seen=new Set<string>(),byAccount=new Map<string,number>(),byTheme=new Map<XMarketTheme,number>();
 const valid=posts.flatMap(post=>{
  if((post.intakeStatus!=="discovery" &&
    !(options.allowDeferred && post.intakeStatus==="deferred"))||!permitsXResearch(post.handle,post.text))return [];
  const time=Date.parse(post.publishedAt),age=now.getTime()-time;
  if(!Number.isFinite(age)||age< -5*60_000||age>maxAgeHours*3_600_000)return [];
  let normalized:ReturnType<typeof normaliseXPostUrl>;
  try{normalized=normaliseXPostUrl(post.url);}catch{return [];}
  const handle=post.handle.toLowerCase();
  if(!HANDLES.has(handle)||normalized.handle.toLowerCase()!==handle||
     normalized.postId!==post.id)return [];
  const policy=xWireSourcePolicy(handle),flash=policy.alert?classifyXFlash(post.text):null;
  if(age>policy.maxAgeHours*3_600_000)return [];
  const matched=TOPICS.filter(t=>t.regex.test(post.text));
  if(!matched.length&&!flash)return [];
  const preferred=["hormuzreport","hfi_research","oilandenergy"].includes(handle)?"energy_shipping":
    ["bluekurtic","oddstats"].includes(handle)?"equities_ai":
    ["kobeissiletter","macropaperr","drjstrategy","saraeisen"].includes(handle)?"macro_rates_fx":
    handle==="tgletter"?"resilience_preparedness":null;
  const theme=matched.find(t=>t.theme===preferred)?.theme||matched[0]?.theme||
    (flash==="macro_data"||flash==="policy_decision"?"macro_rates_fx":flash==="conflict_shock"?"geopolitics":"corporate");
  const isFresh=age<6*3_600_000;
  const material=(post.images.length>0?5:0)+(/https:\/\//i.test(post.text)?3:0);
  const analytical=/\b(?:prior|historical|sample|drawdowns?|breadth|backtest|moving average|dma|signal|tactically|turn.of.year|positioning|model|invalidation|trading days|time ever)\b/i.test(post.text)&&/\d/.test(post.text);
  const priority=57+(isFresh?8:0)+Math.min(matched.length,3)*3+
   (policy.analyst?13:SOURCE_PRIORITY.has(handle)?6:0)+(flash?11:0)+material+
   (analytical&&policy.analyst?9:0)+(/\[1\/\d+\]/.test(post.text)?5:0)+(/\d/.test(post.text)?3:0)-(policy.alert&&!flash?8:0)-(handle==="beginnertrades"?8:0);
  return [{post,theme,priority:Math.min(priority,95)}];
 }).sort((a,b)=>b.priority-a.priority||
   Date.parse(b.post.publishedAt)-Date.parse(a.post.publishedAt));
 const capacity=Math.min(Math.max(max,0),12);
 let alertCount=0,analystCount=0;
 const add=(candidate:XMarketCandidate)=>{
  const handle=candidate.post.handle.toLowerCase();
  const policy=xWireSourcePolicy(handle);
  if(seen.has(candidate.post.id)||chosen.length>=capacity||
    (byAccount.get(handle)||0)>=policy.researchCap||(byTheme.get(candidate.theme)||0)>=5||
    (policy.alert&&alertCount>=3)||chosen.some(p=>Math.abs(Date.parse(p.post.publishedAt)-Date.parse(candidate.post.publishedAt))<6*3_600_000&&xWireNearDuplicate(p.post.text,candidate.post.text)))return false;
  seen.add(candidate.post.id);
  byAccount.set(handle,(byAccount.get(handle)||0)+1);
  byTheme.set(candidate.theme,(byTheme.get(candidate.theme)||0)+1);
  chosen.push(candidate);
  if(policy.alert)alertCount++;
  if(policy.analyst)analystCount++;
  return true;
 };
 // Give the user-prioritised account the first available material slot, not a guaranteed claim or quota.
 const kobeissi=valid.find(c=>c.post.handle.toLowerCase()==="kobeissiletter"&&now.getTime()-Date.parse(c.post.publishedAt)<6*3_600_000);
 if(options.prioritizeKobeissi&&kobeissi)add(kobeissi);
 // First reserve at most two actual alert candidates, then four distinct analyst voices.
 // A quiet alert lane consumes no slots; do not force a fixed quota of low-value posts.
 if(capacity>=6){
  const flash=valid.filter(c=>c.post.handle.toLowerCase()==="firstsquawk"&&classifyXFlash(c.post.text)).sort((a,b)=>{
   const weight=(p:XMarketCandidate)=>({policy_decision:4,market_shock:3,conflict_shock:3,macro_data:2,earnings:1}[classifyXFlash(p.post.text)!]||0);
   return weight(b)-weight(a)||b.priority-a.priority;
  })[0];
  if(flash)add(flash);
  for(const c of valid){
   if(alertCount>=2)break;
   if(xWireSourcePolicy(c.post.handle).alert&&classifyXFlash(c.post.text))add(c);
  }
 }
 if(capacity>=6)for(const handle of ["bluekurtic","oddstats","hfi_research","macropaperr"]){
  const candidate=valid.find(c=>c.post.handle.toLowerCase()===handle);
  if(candidate)add(candidate);
 }
 for(const c of valid){
  if(analystCount>=Math.min(4,Math.max(0,capacity-2)))break;
  if(xWireSourcePolicy(c.post.handle).analyst&&!byAccount.has(c.post.handle.toLowerCase()))add(c);
 }
 if(capacity>=8){
  const specialist=valid.find(c=>c.post.handle.toLowerCase()==="hormuzreport")||valid.find(c=>c.post.handle.toLowerCase()==="thestudyofwar");
  if(specialist)add(specialist);
 }
 for(const c of valid)add(c);
 return chosen;
}

