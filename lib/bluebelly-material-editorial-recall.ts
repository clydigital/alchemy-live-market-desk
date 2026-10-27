/** Read-only material event editorial-recall diagnostic.
 * LEAD or reported-only sources remain NON-EVIDENCE. */
export type RecallSource={
 title:string;url:string;publishedAt:string;itemKey?:string;
 sourceKind?:string;sourceQuality?:number;materiality?:number;publisher?:string;
};
export type RecallIdea={title:string;hook?:string;mechanism?:string;sourceUrls?:string[]};
export type StructuredRecallReceipt={item_key:string;source_url:string;disposition:"SELECTED"|"EXCLUDED"|"NEEDS_SOURCE";reason:string};
export type RecallSlate={producedAt:string;dayMyt:string;ideas:RecallIdea[];notes:string;receipts?:StructuredRecallReceipt[]}|null;
export type RecallStatus="selected"|"excluded_with_reason"|"needs_source"|"unacknowledged"|"post_cutoff";
export type RecallCandidate={
 key:string;title:string;url:string;eventAt:string;sourceState:"original_checked"|"reported_only"|"creator_lead";
 status:RecallStatus;materiality:number;why:string;
};
const ENTITIES=[
 ["anthropic",/\banthropic\b/i],["spacex",/\bspace[\s-]?x\b/i],
 ["tesla",/\btesla\b/i],["meta",/\bmeta\b/i],
 ["broadcom",/\bbroadcom\b/i],["nvidia",/\bnvidia\b/i],
 ["microsoft",/\bmicrosoft\b/i],["amazon",/\bamazon\b/i],
 ["oracle",/\boracle\b/i],["openai",/\bopenai\b/i],
 ["alphabet",/\b(?:alphabet|google)\b/i],["apple",/\bapple\b/i],
 ["samsung",/\bsamsung\b/i],["boj",/\b(?:bank of japan|boj)\b/i],
 ["federal-reserve",/\b(?:federal reserve|fomc|fed rate)\b/i],
] as const;
const ACTIONS=[
 ["ipo",/\b(?:s-1|f-1|ipo|initial public offering|prospectus|public listing)\b/i],
 ["merger",/\b(?:merg(?:e|er|ing)|takeover|acquisition|special committees?|combination discussions|buyout)\b/i],
 ["capital",/\b(?:equity offering|priced offering|preferred shares|share offering|equity sale|mandatory.convertible|stock issuance)\b/i],
 ["financing",/\b(?:equipment financing|loan facility|secured financing|spv financing|credit facility|debt financing|bond issuance)\b/i],
 ["guidance",/\b(?:guidance|earnings outlook|forecast revision|profit warning)\b/i],
 ["policy",/\b(?:central bank|rate decision|fomc decision|bank of japan decision)\b/i],
] as const;
const goodUrl=(v:string)=>{try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}};
export function materialEventKey(headline:string):string|null{
 const entities=ENTITIES.filter(([,rx])=>rx.test(headline)).map(x=>x[0]).sort();
 const type=ACTIONS.find(([,rx])=>rx.test(headline))?.[0];
 if(!type||!entities.length)return null;
 // Tesla and SpaceX discussions are a distinct M&A event, not a chip SPV.
 const primary=type==="merger"?entities.slice(0,2).join("-"):
   type==="ipo"?entities.find(x=>x==="anthropic")||entities[0]:
   entities[0];
 return primary+":"+type;
}
export function computeMaterialEditorialRecall(
 sources:readonly RecallSource[],slate:RecallSlate,now=new Date(),limit=12
):RecallCandidate[]{
 const current=now.getTime(),cutoff=slate?Date.parse(slate.producedAt):NaN;
 if(!Number.isFinite(current))return [];
 const grouped=new Map<string,{source:RecallSource;state:RecallCandidate["sourceState"]}>();
 for(const source of sources){
  if(!goodUrl(source.url)||!source.title)continue;
  const when=Date.parse(source.publishedAt);
  if(!Number.isFinite(when)||when>current+5*60_000||current-when>72*3_600_000)continue;
  if((source.materiality??0)<68)continue;
  const key=materialEventKey(source.title);
  if(!key)continue;
  const host=new URL(source.url).hostname;
  const primary=Boolean(source.itemKey?.startsWith("official-edgar:")&&host==="www.sec.gov") ||
   Boolean(source.itemKey?.startsWith("official-press:")&&(source.sourceQuality??0)>=90);
  const state:RecallCandidate["sourceState"]=primary?"original_checked":
   source.sourceKind==="creator"?"creator_lead":"reported_only";
  const old=grouped.get(key);
  const rank=(state==="original_checked"?200:state==="reported_only"?100:0)
    +(source.materiality??0)+(source.sourceQuality??0)/100;
  const prev=old?((old.state==="original_checked"?200:old.state==="reported_only"?100:0)
    +(old.source.materiality??0)+(old.source.sourceQuality??0)/100):-1;
  if(rank>prev||(rank===prev&&when>Date.parse(old!.source.publishedAt)))
   grouped.set(key,{source,state});
 }
 const results:RecallCandidate[]=[];
 for(const [key,{source,state}] of grouped){
  // Company-action match, not simply company mention. Broadcom's facility
  // must NEVER count as having covered Anthropic's S-1 IPO.
  const matches=(slate?.ideas||[]).some(idea=>{
   const plain=[idea.title,idea.hook||"",idea.mechanism||""].join(" ");
   return materialEventKey(plain)===key;
  });
  // Structured receipts are anchored to an exact original item_key + URL.
  // Older notes remain fallback ONLY for historical slates before the new
  // source-checked receipt constraint was installed.
  const structured=slate?.receipts?.find(r=>
    r.item_key===source.itemKey&&r.source_url===source.url);
  const legacy=(slate?.dayMyt||"")<"2026-10-28";
  const receipt=legacy?(slate?.notes||"").toUpperCase():"";
  const prefix="RECALL["+key.toUpperCase()+"]=";
  const after=Number.isFinite(cutoff)&&Date.parse(source.publishedAt)>cutoff+5*60_000;
  const status:RecallStatus=after?"post_cutoff":matches?"selected":
   structured?.disposition==="EXCLUDED"?"excluded_with_reason":
   structured?.disposition==="NEEDS_SOURCE"?"needs_source":
   structured?.disposition==="SELECTED"?"unacknowledged":
   receipt.includes(prefix+"EXCLUDED")?"excluded_with_reason":
   receipt.includes(prefix+"NEEDS_SOURCE")?"needs_source":"unacknowledged";
  const why=after?"Published after the slate cutoff; reconsider in the next edition.":
   status==="unacknowledged"?"No explicit same-event decision found in the selected slate.":
   status==="selected"?"The same material company action appears in the three ideas.":
   status==="excluded_with_reason"?"An excluded-candidate disposition was saved.":
   "The slate records that original-source checking is needed.";
  results.push({key,title:source.title,url:source.url,eventAt:source.publishedAt,
   sourceState:state,status,materiality:source.materiality??0,why});
 }
 const weight=(s:RecallStatus)=>s==="unacknowledged"?5:s==="needs_source"?4:s==="post_cutoff"?3:2;
 return results.sort((a,b)=>weight(b.status)-weight(a.status)||
  b.materiality-a.materiality||Date.parse(b.eventAt)-Date.parse(a.eventAt))
  .slice(0,Math.max(0,Math.min(25,limit)));
}
