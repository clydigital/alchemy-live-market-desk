import type {NewsBriefV1} from "./market-brief-news.ts";

/** Read-only editorial recommendation, never a canonical Story/evidence writer.
 * Only source-verified NewsBriefs from established projection are eligible.
 * Intake 'accepted' or creator score alone MUST NOT qualify an item. */
export type EditorialShortlistRow={
 news:NewsBriefV1;
 theme:"AI & Funding"|"Rates & Inflation"|"Energy & Geopolitics"|"Equities & Credit"|"Other";
 editorialScore:number;sourceAgeHours:number;why:string[];
};
const themeOf=(v:string):EditorialShortlistRow["theme"]=>{
 const title=v.toLowerCase();
 if(/\b(anthropic|broadcom|gpu|ai|artificial intelligence|chip|ipo|meta|capex|semiconductor|cloud)\b/.test(title))return "AI & Funding";
 if(/\b(fed|treasury|fomc|boj|boe|bank of japan|yield|inflation|cpi|pce|rate)\b/.test(title))return "Rates & Inflation";
 if(/\b(brent|oil|iran|hormuz|opec|crude|saudi|tanker|gas|lng)\b/.test(title))return "Energy & Geopolitics";
 if(/\b(stocks?|equities|shares?|credit|earnings?|cash.flow|funding|default|debt)\b/.test(title))return "Equities & Credit";
 return "Other";
};
const isValidSource=(u:string)=>{try{const x=new URL(u);return x.protocol==="https:"&&!x.username&&!x.password&&x.pathname.length>1;}catch{return false;}};
export function selectHtmlEditorialShortlist(
 verified:readonly NewsBriefV1[],now=new Date(),limit=8
):EditorialShortlistRow[]{
 const t=now.getTime();if(!Number.isFinite(t))return [];
 const seen=new Set<string>();
 const candidates:EditorialShortlistRow[]=[];
 for(const news of verified){
  if(news.verification!=="SOURCE_VERIFIED"||!isValidSource(news.sourceUrl))continue;
  const event=Date.parse(news.occurredAt),observed=Date.parse(news.observedAt);
  if(!Number.isFinite(event)||!Number.isFinite(observed)||event>t||observed>t||observed<event)continue;
  const ageHours=(t-event)/3_600_000;
  if(ageHours>48)continue;
  const key=new URL(news.sourceUrl).origin+new URL(news.sourceUrl).pathname;
  if(seen.has(key))continue;seen.add(key);
  const theme=themeOf(news.headline+" "+news.summary);
  const sourceTier=["official","filing","primary"].includes(news.sourceKind.toLowerCase())?18:12;
  const age=ageHours<=8?15:ageHours<=24?11:ageHours<=36?7:3;
  const themePoints=theme==="Other"?0:theme==="AI & Funding"?14:12;
  const actionability=/(announc|pric|fil|offer|raise|quarter|earn|decision|cut|hike|risk|miss|attack|strike|surge|fall|drop)/i.test(news.headline)?11:4;
  // Scores reflect *editorial priority*, not verified market impact or
  // price reaction. Those require separate dated observations.
  const editorialScore=sourceTier+age+themePoints+actionability;
  candidates.push({news,theme,editorialScore,sourceAgeHours:Math.round(ageHours*10)/10,
   why:[news.sourceKind+" source-verified",ageHours.toFixed(1)+"h since event","topic: "+theme]});
 }
 return candidates.sort((a,b)=>b.editorialScore-a.editorialScore ||
   Date.parse(b.news.occurredAt)-Date.parse(a.news.occurredAt))
   .slice(0,Math.max(0,Math.min(18,limit)));
}
