import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";
import {EDITORIAL_REGIME_LENSES} from "./bluebelly-editorial-architecture.ts";
import type {PublicThesis} from "./blue-desk-thesis-ledger.ts";
import type {PublicSourceObservation} from "./blue-desk-source-observations-projector.ts";
import {matchRecentLensObservations} from "./bluebelly-regime-lens-workbook.ts";

/**
 * Display-only change scanner. Read the ALREADY collected public Story memory and
 * admitted original observations; do not recruit sources, create research, or
 * mutate the human-reviewed lens outlook / canonical Regime state.
 *
 * A Story updated_at is a prompt to recheck a view, NOT proof that its thesis
 * materially changed. An original-source topic match is NOT causal evidence.
 */
export type RegimeViewScan={
 lens:EditorialRegimeId;
 reviewedAt:string;
 state:"NEW_VIEW"|"UPDATED_RECORD"|"NEW_SOURCE"|"NO_NEW_INPUT"|"PARTIAL"|"UNAVAILABLE";
 newViews:PublicThesis[];
 updatedRecords:PublicThesis[];
 sourceInputs:PublicSourceObservation[];
 latestInputAt:string|null;
 storyReadAvailable:boolean;
 sourceReadAvailable:boolean;
};

const MS_DAY=86400000;
function reviewCutoff(reviewedAt:string):number|null{
 // Editorial dates are MYT calendar days. Compare AFTER that entire day,
 // avoiding false "new" signals for inputs already in the dated review.
 if(!/^20\\d{2}-\\d{2}-\\d{2}$/.test(reviewedAt))return null;
 const start=Date.parse(reviewedAt+"T00:00:00+08:00");
 if(!Number.isFinite(start)||new Date(start+8*3600000).toISOString().slice(0,10)!==reviewedAt)return null;
 return start+MS_DAY-1;
}
function dateOf(value:string):number|null{
 const parsed=Date.parse(value);
 return Number.isFinite(parsed)?parsed:null;
}

export function scanRegimeViews(
 lens:EditorialRegimeId,
 reviewedAt:string,
 stories:readonly PublicThesis[]|null,
 observations:readonly PublicSourceObservation[]|null,
 now=new Date(),
):RegimeViewScan{
 const empty={lens,reviewedAt,newViews:[] as PublicThesis[],
  updatedRecords:[] as PublicThesis[],sourceInputs:[] as PublicSourceObservation[],
  latestInputAt:null as string|null,
  storyReadAvailable:stories!==null,sourceReadAvailable:observations!==null};
 const cutoff=reviewCutoff(reviewedAt),current=now.getTime();
 if(cutoff===null||!Number.isFinite(current)||current<cutoff){
  return {...empty,state:"UNAVAILABLE"};
 }
 const definition=EDITORIAL_REGIME_LENSES.find(item=>item.id===lens);
 if(!definition)return {...empty,state:"UNAVAILABLE"};
 const relevant=(stories||[]).filter(story=>{
  const at=dateOf(story.updatedAt);
  return at!==null&&at>cutoff&&at<=current&&
   definition.pattern.test(story.title+" "+story.slug+" "+story.question);
 }).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0,8);
 const newViews=relevant.filter(story=>{
  const created=story.createdAt?dateOf(story.createdAt):null;
  return created!==null&&created>cutoff&&created<=current;
 });
 const updatedRecords=relevant.filter(story=>!newViews.includes(story));
 // This uses the existing bounded 48-hour, tier-1/2 original-source reader.
 // "New" includes a newly *recorded* old event, which is still a review input.
 const sourceInputs=observations===null?[]:
  matchRecentLensObservations(lens,observations,now,4).filter(item=>{
   const event=dateOf(item.eventAt),recorded=dateOf(item.recordedAt);
   return event!==null&&recorded!==null&&event<=current&&recorded<=current&&
    Math.max(event,recorded)>cutoff;
  });
 const times=[...newViews,...updatedRecords].map(x=>dateOf(x.updatedAt))
  .concat(sourceInputs.map(x=>dateOf(x.recordedAt))).filter((x):x is number=>x!==null);
 const latestInputAt=times.length?new Date(Math.max(...times)).toISOString():null;
 const state:RegimeViewScan["state"]=
  newViews.length?"NEW_VIEW":updatedRecords.length?"UPDATED_RECORD":
  sourceInputs.length?"NEW_SOURCE":
  stories===null&&observations===null?"UNAVAILABLE":
  stories===null||observations===null?"PARTIAL":"NO_NEW_INPUT";
 return {...empty,newViews,updatedRecords,sourceInputs,latestInputAt,state};
}

export function summarizeRegimeScans(scans:readonly RegimeViewScan[]){
 return {
  newViewLenses:scans.filter(s=>s.newViews.length>0).length,
  revisedRecordLenses:scans.filter(s=>s.updatedRecords.length>0).length,
  sourceInputLenses:scans.filter(s=>s.sourceInputs.length>0).length,
  incompleteLenses:scans.filter(s=>!s.storyReadAvailable||!s.sourceReadAvailable).length,
 };
}
