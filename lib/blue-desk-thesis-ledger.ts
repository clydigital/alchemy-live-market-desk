/** Read-only snapshot of the existing Story memory. Historical thesis text
 * is not automatically today's verified market direction. */
export type PublicThesis = {
 id:string;slug:string;title:string;question:string;thesis:string;
 support:string;contradiction:string;confirmation:string;invalidation:string;
 nextTest:string;pricedAssessment:string;updatedAt:string;status:string;rank:number|null;
};
type RecordInput=Record<string,unknown>;
const trim=(value:unknown,max=1700)=>typeof value==="string"?value.trim().slice(0,max):"";
const VALID=new Set(["publish","monitor","develop"]);
export function projectPublicTheses(rows:readonly RecordInput[],now=new Date(),limit=24):PublicThesis[]{
 const current=now.getTime(),seen=new Set<string>();
 if(!Number.isFinite(current))return [];
 const projected=rows.flatMap(row=>{
  const id=trim(row.id,50),slug=trim(row.slug,150);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[a-z0-9-]+$/.test(slug)||seen.has(id))return [];
  const status=trim(row.status,20);
  if(!VALID.has(status))return [];
  const updated=Date.parse(trim(row.updated_at));
  if(!Number.isFinite(updated)||updated>current)return [];
  const title=trim(row.title,230),question=trim(row.market_question,750);
  const thesis=trim(row.thesis,1650);
  if(title.length<6||thesis.length<25)return [];
  const rank=Number(row.rank);
  seen.add(id);
  return [{
   id,slug,title,
   // Missing questions belong to the developing Story record; never silently
   // manufacture a claim or treat missing fields as a completed assessment.
   question:question||"What would confirm that this theme is changing markets?",
   thesis,support:trim(row.strongest_support,1100),
   contradiction:trim(row.strongest_contradiction,1100),
   confirmation:trim(row.confirmation_trigger,850),
   invalidation:trim(row.invalidation_trigger,850),
   nextTest:trim(row.next_catalyst,550),
   pricedAssessment:trim(row.priced_assessment,850),
   updatedAt:new Date(updated).toISOString(),status,
   rank:Number.isInteger(rank)&&rank>=1&&rank<=5?rank:null,
  }];
 });
 return projected.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))
  .slice(0,Math.max(0,Math.min(38,limit)));
}

/** Causal explanation prompts are conditional teaching, NOT generated market
 * evidence. They explain an economic transmission path, not observed prices. */
export function storyMarketTransmission(story:Pick<PublicThesis,"slug"|"title">):string{
 const s=(story.slug+" "+story.title).toLowerCase();
 if(/hormuz|iran|oil|brent|crude|refin|distillat|diesel|tanker|gas|lng/.test(s))
  return "When fuel or shipping becomes harder to secure, buyers can face higher transport and energy bills. That may lift inflation expectations, squeeze company margins and make interest-rate cuts harder. Brent, diesel, bond yields and transport-sensitive shares are worth watching together; the direction of a price move still needs a dated market observation.";
 if(/japan|jgb|yen|boj|carry/.test(s))
  return "Higher Japanese yields can draw money back into domestic bonds and unsettle yen-funded positions overseas. That could affect USD/JPY, global bond yields and risk assets, but the actual flow must be observed rather than assumed.";
 if(/fomc|fed|cpi|rates|yield|bond|treasur|credit|funding|mortgage|housing/.test(s))
  return "A change in inflation or rate expectations alters what it costs to borrow and the return investors can earn from safer bonds. That can move Treasury yields, the dollar, gold and equity valuations. The key is whether the relevant yields and assets actually responded in the same market session.";
 if(/ai|nvidia|capex|tech|compute|semiconduct|data.cent|financ/.test(s))
  return "AI orders and spending do not immediately become cash profits. Companies must pay for equipment, power and financing before they earn those returns. That makes debt costs, cash flow and delivery timelines important checks on technology valuations.";
 if(/china|tariff|trade|yuan|renminbi/.test(s))
  return "A change in Chinese demand or trade policy can work through factory orders, raw-material imports and currencies before it reaches company earnings. Copper, regional equities and exposed exporters can react differently, so the transmission needs to be checked asset by asset.";
 if(/equity|stock|earning|profit|consumer|labou?r|productiv|breadth|growth/.test(s))
  return "Stock prices depend on what investors expect companies to earn and how much they are willing to pay for those profits. Weaker spending, rising costs or expensive financing can challenge that calculation, although a strong earnings surprise could offset it.";
 return "The market impact depends on how this development changes actual demand, costs, financing or investor expectations. Check the exposed assets and their dated price action before treating the explanation as a confirmed cause.";
}

/** Explicitly linked Motion is context for ordering, not evidence of a market
 * reaction or an accepted Story revision. Never infer links from keywords. */
export type StoryMotionRecency = {
  primary_story_id:string|null;occurred_at:string;verification_state:string;
};
export type MotionOrderedStory = PublicThesis & {
  latestMotionAt:string|null;latestMotionVerification:string|null;
};
export function orderStoriesByLatestMotion(
  stories:readonly PublicThesis[], motions:readonly StoryMotionRecency[], now=new Date(),
):MotionOrderedStory[]{
  const current=now.getTime();
  const validIds=new Set(stories.map(s=>s.id));
  const latest=new Map<string,{at:string;verification:string}>();
  for(const item of motions){
    if(!item.primary_story_id||!validIds.has(item.primary_story_id))continue;
    const at=Date.parse(item.occurred_at);
    if(!Number.isFinite(at)||at>current)continue;
    const old=latest.get(item.primary_story_id);
    if(!old||at>Date.parse(old.at))latest.set(item.primary_story_id,{
      at:new Date(at).toISOString(),verification:item.verification_state,
    });
  }
  return stories.map(story=>({
    ...story,latestMotionAt:latest.get(story.id)?.at||null,
    latestMotionVerification:latest.get(story.id)?.verification||null,
  })).sort((a,b)=>
    Date.parse(b.latestMotionAt||b.updatedAt)-Date.parse(a.latestMotionAt||a.updatedAt)
    || a.title.localeCompare(b.title)
  );
}
