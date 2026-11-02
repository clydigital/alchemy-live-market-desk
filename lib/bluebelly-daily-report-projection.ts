import type {decisionTopics} from "./bluebelly-decision-brief.ts";

/** Read-only rolling headline selection from the existing public decision
 * packet. No claim that five different independently verified events
 * occurred today; never add dates, consensus, market moves or probabilities.
 * Owner-only immutable Daily Intelligence editions are separate.
 */
export type DailyDecisionTopic=ReturnType<typeof decisionTopics>[number];
export type DailyReportProjection={
 stories:DailyDecisionTopic[];
 upcoming:DailyDecisionTopic[];
 newestSourceAt:string|null;
 freshWithin48h:number;
 status:"CURRENT_SOURCES"|"RECENT_REVIEWED_ONLY"|"NO_QUALIFIED_SOURCES";
};
const DAY=86400000;
const validOriginal=(u:string)=>{
 try{const v=new URL(u);return v.protocol==="https:"&&!v.username&&!v.password&&v.pathname!=="/";}catch{return false;}
};
const eventAt=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)?Date.parse(s+"T00:00:00Z"):Date.parse(s);
export function projectDailyReport(
 topics:readonly DailyDecisionTopic[],now:Date,limit=5,
):DailyReportProjection{
 const time=now.getTime();
 if(!Number.isFinite(time)||!Number.isInteger(limit)||limit<1||limit>5)
  return {stories:[],upcoming:[],newestSourceAt:null,freshWithin48h:0,status:"NO_QUALIFIED_SOURCES"};
 const seen=new Set<string>(), groups=new Map<string,number>();
 const qualified=topics.filter(t=>t.status!=="UPCOMING"&&
  typeof t.id==="string"&&t.id.length>2&&t.title.trim().length>=8&&
  t.fact.trim().length>=18&&t.why.trim().length>=10&&t.mechanism.trim().length>=15&&
  t.test.trim().length>=8&&validOriginal(t.sourceUrl)&&
  Number.isFinite(eventAt(t.at))&&eventAt(t.at)<=time&&time-eventAt(t.at)<=7*DAY);
 // Released original facts first, then established official macro/issuer
 // scorecards, followed by reviewed explanatory features. Older editorial
 // seasonality cannot crowd out newly released results.
 const rank=(t:DailyDecisionTopic)=>t.status==="NEW"&&t.href.startsWith("?news=")?110:
  t.status==="NEW"&&t.href.startsWith("?brief=")?90:
  t.href.startsWith("?brief=")?85:
  t.status==="NEW"?80:60;
 const ordered=[...qualified].sort((a,b)=>rank(b)-rank(a)||
   eventAt(b.at)-eventAt(a.at)||a.id.localeCompare(b.id));
 const stories:DailyDecisionTopic[]=[];
 for(const t of ordered){
  if(stories.length===limit)break;
  const group=t.href.startsWith("?brief=")&&t.assets.length===1?"issuer":t.id;
  if((groups.get(group)||0)>=2||seen.has(t.sourceUrl))continue;
  seen.add(t.sourceUrl);groups.set(group,(groups.get(group)||0)+1);
  stories.push(t);
 }
 const upcoming=topics.filter(t=>t.status==="UPCOMING"&&
  typeof t.title==="string"&&t.title.trim().length>5&&
  validOriginal(t.sourceUrl)&&Number.isFinite(eventAt(t.at))&&
  eventAt(t.at)>=time-60*60000&&eventAt(t.at)<=time+14*DAY)
  .sort((a,b)=>eventAt(a.at)-eventAt(b.at)).slice(0,3);
 const freshWithin48h=stories.filter(t=>t.status==="NEW"&&time-eventAt(t.at)<=48*3600000).length;
 const newestSourceAt=stories.length?stories.map(t=>t.at)
  .sort((a,b)=>eventAt(b)-eventAt(a))[0]:null;
 return {stories,upcoming,newestSourceAt,freshWithin48h,
  status:!stories.length?"NO_QUALIFIED_SOURCES":
   freshWithin48h?"CURRENT_SOURCES":"RECENT_REVIEWED_ONLY"};
}
