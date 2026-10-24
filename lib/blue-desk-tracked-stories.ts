/**
 * Public read model for *existing* frozen Dossier Story threads.
 *
 * This is not a source of new canonical Story decisions or news. It preserves
 * the published edition's six bounded, stable identities even when
 * canonicalStoryManifest/stories are empty (no freshly accepted Story change).
 * No live Story joins, synthetic quotes, fabricated evidence, or edition writes.
 */
export type TrackedStory = {
  storyId:string;
  thesisVersionId:string;
  historicalSnapshotId:string;
  question:string;
  nextTest:string|null;
  assessedAt:string|null;
  frozenDossierAsOf:string;
  evidenceReferenceCount:number;
  evidenceIds:string[];
  status:"CARRIED_FORWARD_NO_ACCEPTED_CHANGE";
};
export type TrackedStoriesRead = {
  editionId:string;
  publishedAt:string;
  dossierAsOf:string|null;
  currentAcceptedStoryCount:number;
  tracks:TrackedStory[];
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function obj(v:unknown):Record<string,unknown>|null{
  return v&&typeof v==="object"&&!Array.isArray(v) ? v as Record<string,unknown> : null;
}
function short(v:unknown,max:number):string|null{
  return typeof v==="string"&&v.trim()&&v.trim().length<=max ? v.trim() : null;
}
function asOf(v:unknown,latestMs:number):string|null{
  if(typeof v!=="string"||v.length>45)return null;
  const stamp=Date.parse(v);
  return Number.isFinite(stamp)&&stamp<=latestMs?new Date(stamp).toISOString():null;
}
export function projectFrozenTrackedStories(input:unknown):TrackedStoriesRead|null{
  const snap=obj(input);
  const id=short(snap?.id,60),pub=short(snap?.published_at,48);
  const publishedMs=Date.parse(pub||"");
  if(!id||!UUID.test(id)||!pub||!Number.isFinite(publishedMs))return null;
  const payload=obj(snap?.payload),dossier=obj(payload?.dossier);
  const lessons=Array.isArray(dossier?.lessons)?dossier.lessons:[];
  const context=obj(payload?.presenterDossierContext);
  const dossierAsOf=asOf(context?.dossierAsOf,publishedMs);
  // Historical replay may be stale relative to edition. Without a known frozen
  // Dossier clock we cannot label a thread as an authoritative carried state.
  if(!dossierAsOf)return {editionId:id,publishedAt:pub,dossierAsOf:null,
    currentAcceptedStoryCount:Array.isArray(payload?.stories)?payload.stories.length:0,tracks:[]};
  const unique=new Set<string>();
  const tracks:TrackedStory[]=[];
  for(const raw of lessons.slice(0,24)){
    const v=obj(raw),storyId=short(v?.storyId,40),
      thesisVersionId=short(v?.thesisVersionId,40),
      historicalSnapshotId=short(v?.publicationSnapshotId,40),
      question=short(v?.question,400)||short(v?.title,400);
    if(!storyId||!UUID.test(storyId)||unique.has(storyId)
      ||!thesisVersionId||!UUID.test(thesisVersionId)
      ||!historicalSnapshotId||!UUID.test(historicalSnapshotId)
      ||!question)continue;
    const callouts=Array.isArray(v?.callouts)?v.callouts:[];
    const explicitlyCarried=callouts.some(x=>{
      const c=obj(x);
      return c?.type==="commentary_context"
        &&c?.label==="RECENT CONTEXT — NO MATERIAL CHANGE";
    });
    if(!explicitlyCarried)continue;
    const attention=obj(v?.currentAttention);
    const stamp=asOf(attention?.assessedAt,publishedMs);
    const watch=Array.isArray(v?.watchItems)?v.watchItems:[];
    const nextTest=watch.map(x=>short(obj(x)?.variable,700)).find(Boolean)||null;
    const refs=Array.isArray(v?.evidenceRefs)?v.evidenceRefs:[];
    const evidenceIds=[...new Set(refs.filter((x):x is string=>typeof x==="string"&&UUID.test(x)))].slice(0,24);
    const evidenceReferenceCount=evidenceIds.length;
    unique.add(storyId);
    tracks.push({storyId,thesisVersionId,historicalSnapshotId,
      question,nextTest,assessedAt:stamp,frozenDossierAsOf:dossierAsOf,
      evidenceReferenceCount,evidenceIds,status:"CARRIED_FORWARD_NO_ACCEPTED_CHANGE"});
    if(tracks.length>=12)break;
  }
  return {editionId:id,publishedAt:pub,dossierAsOf,
    currentAcceptedStoryCount:Array.isArray(payload?.stories)?payload.stories.length:0,
    tracks};
}
