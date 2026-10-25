/** Read-only public projection from existing tracked thesis snapshots. This
 * does not assess new evidence, advance a Story version or imply freshness. */
export type PublicThesis = {
 id:string;slug:string;title:string;question:string;thesis:string;
 support:string;contradiction:string;confirmation:string;invalidation:string;
 nextTest:string;pricedAssessment:string;updatedAt:string;status:string;
};
type RecordInput=Record<string,unknown>;
const trim=(value:unknown,max=900)=>typeof value==="string"?value.trim().slice(0,max):"";
export function projectPublicTheses(rows:readonly RecordInput[],now=new Date(),limit=9):PublicThesis[]{
 const current=now.getTime(),seen=new Set<string>();
 if(!Number.isFinite(current))return [];
 return rows.flatMap(row=>{
  const id=trim(row.id,50),slug=trim(row.slug,100);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[a-z0-9-]+$/.test(slug)||seen.has(id))return [];
  if(!["publish","monitor"].includes(trim(row.status,20)))return [];
  if(!Number.isInteger(row.rank)||Number(row.rank)<1||Number(row.rank)>5)return [];
  const updated=Date.parse(trim(row.updated_at));
  if(!Number.isFinite(updated)||updated>current)return [];
  const title=trim(row.title,200),question=trim(row.market_question,500);
  const thesis=trim(row.thesis,900);
  if(title.length<8||question.length<14||thesis.length<30)return [];
  seen.add(id);
  return [{
   id,slug,title,question,thesis,
   support:trim(row.strongest_support,800),contradiction:trim(row.strongest_contradiction,800),
   confirmation:trim(row.confirmation_trigger,700),invalidation:trim(row.invalidation_trigger,700),
   nextTest:trim(row.next_catalyst,400),pricedAssessment:trim(row.priced_assessment,700),
   updatedAt:new Date(updated).toISOString(),status:trim(row.status,20),
  }];
 }).slice(0,Math.max(0,Math.min(limit,12)));
}
