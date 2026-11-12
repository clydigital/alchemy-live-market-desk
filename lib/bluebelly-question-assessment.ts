/** Read-only, source-dated editorial question verdicts. Not canonical Regime or a trading score. */
export type QuestionVerdict="improving"|"unchanged"|"deteriorating"|"mixed"|"insufficient";
export type QuestionSource=Readonly<{name:string;url:string;publishedOn:string;note?:string}>;
export type QuestionRevision=Readonly<{
 revisionId:string;reviewedOn:string;sourceThrough:string;
 verdict:QuestionVerdict;condition:string;why:string;countercase:string;nextTest:string;
 sources:readonly QuestionSource[];
}>;
export type QuestionRecord=Readonly<{
 id:string;question:string;scope:string;comparison:string;horizon:string;
 authority:"SOURCE_REVIEWED_PROVISIONAL";expiresAfterDays:number;
 revisions:readonly QuestionRevision[];
}>;
export type QuestionAssessment=Readonly<{
 id:string;question:string;scope:string;comparison:string;horizon:string;
 authority:QuestionRecord["authority"];verdict:QuestionVerdict;recordedVerdict:QuestionVerdict;
 freshness:"current"|"stale"|"unavailable";condition:string;why:string;countercase:string;
 nextTest:string;reviewedOn:string|null;sourceThrough:string|null;
 previousVerdict:QuestionVerdict|null;previousReviewedOn:string|null;changeSummary:string;
 sources:readonly QuestionSource[];revisionId:string|null;
}>;
const DAY=86400000;
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
function dayTime(day:string){const ms=Date.parse(day+"T00:00:00Z");return dayPattern.test(day)&&Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===day?ms:null;}
function validSource(source:QuestionSource,on:string){
 try{const url=new URL(source.url);
  return url.protocol==="https:"&&!url.username&&!url.password&&!!source.name&&
   dayTime(source.publishedOn)!==null&&source.publishedOn<=on;
 }catch{return false;}
}
/** No source publication, no "same as yesterday". The source clock is NOT page-view time. */
export function projectQuestionAssessment(record:QuestionRecord,now:Date):QuestionAssessment{
 const today=now.toISOString().slice(0,10),todayMs=dayTime(today)!;
 const revisions=record.revisions.filter((r,i,a)=>!!r.revisionId&&
  a.findIndex(other=>other.revisionId===r.revisionId)===i&&
  dayTime(r.reviewedOn)!==null&&r.reviewedOn<=today&&
  dayTime(r.sourceThrough)!==null&&r.sourceThrough<=r.reviewedOn&&
  !!r.condition&&!!r.why&&!!r.countercase&&!!r.nextTest&&
  r.sources.length>0&&r.sources.every(s=>validSource(s,r.sourceThrough))&&
  r.sources.some(s=>s.publishedOn===r.sourceThrough)&&
  (r.verdict!=="unchanged"||a.some(p=>dayTime(p.reviewedOn)!==null&&p.reviewedOn<r.reviewedOn))
 ).sort((a,b)=>a.reviewedOn.localeCompare(b.reviewedOn));
 const current=revisions.at(-1),previous=revisions.at(-2);
 const age=current?Math.round((todayMs-dayTime(current.sourceThrough)!)/DAY):Infinity;
 const freshness=current?(age>=record.expiresAfterDays?"stale":"current"):"unavailable";
 const verdict=freshness==="current"?current!.verdict:"insufficient";
 const changeSummary=current&&previous?
   current.verdict===previous.verdict?
     "Answer still "+current.verdict+" after a newer source review; see new evidence.":
     "Changed from "+previous.verdict+" to "+current.verdict+" after review.":
   "No earlier accepted comparison is available.";
 return {
  id:record.id,question:record.question,scope:record.scope,comparison:record.comparison,
  horizon:record.horizon,authority:record.authority,verdict,
  recordedVerdict:current?.verdict||"insufficient",freshness,
  condition:current?.condition||"No admitted source-backed assessment yet.",
  why:current?.why||"Fresh source review required.",countercase:current?.countercase||"Not assessed.",
  nextTest:current?.nextTest||"Qualify original evidence and record an editorial review.",
  reviewedOn:current?.reviewedOn||null,sourceThrough:current?.sourceThrough||null,
  previousVerdict:previous?.verdict||null,previousReviewedOn:previous?.reviewedOn||null,
  changeSummary,sources:current?.sources||[],revisionId:current?.revisionId||null
 };
}
export const QUESTION_VERDICT_LABELS:Readonly<Record<QuestionVerdict,string>>={
 improving:"Improving",unchanged:"About the same",deteriorating:"Getting worse",
 mixed:"Mixed signals",insufficient:"Needs fresh review"
};
