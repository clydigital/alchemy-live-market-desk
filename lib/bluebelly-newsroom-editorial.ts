import type {EditorialTopicId} from "./bluebelly-editorial-architecture.ts";
import type {BankDecisionSnapshot} from "./bluebelly-bank-decision-snapshots.ts";
import type {ReportedEditorial} from "./bluebelly-reported-editorial.ts";
import type {PostEventRecap} from "./bluebelly-post-event-recap.ts";

/** Read-only Newsroom placement of existing dated, public editorial readers.
 * This is NOT an ingestion path, new canonical Story, or price-causality verdict.
 */
export type NewsroomEditorialItem={
 id:string;headline:string;summary:string;occurredAt:string;
 sourceName:string;sourceUrl:string;readerHref:string;
 topics:readonly EditorialTopicId[];verificationLabel:string;
 why:string;nextTest:string;kind:"incident"|"reported"|"bank"|"earnings";
};
export function projectNewsroomEditorial(
 banks:readonly BankDecisionSnapshot[],reports:readonly ReportedEditorial[],
 recaps:readonly PostEventRecap[],readerHref:string,now:Date,
):NewsroomEditorialItem[]{
 const recapIds=new Set(recaps.filter(r=>r.featuredStatus==="REVIEWED").map(r=>r.id));
 const reviewed:NewsroomEditorialItem[]=recaps.filter(r=>r.featuredStatus==="REVIEWED"&&r.kind!=="source_only")
  .map(r=>({
   id:"recap:"+r.id,headline:r.headline,summary:r.standfirst,
   occurredAt:r.releaseAt,sourceName:r.sourceUrls[0]?.label||r.eventName,
   sourceUrl:r.sourceUrls[0]?.url||"",readerHref:readerHref+r.detailsHref,
   topics:r.kind==="bank"?["policy","bonds"] as EditorialTopicId[]:["earnings","ai"] as EditorialTopicId[],
   verificationLabel:"REVIEWED POST-EVENT RECAP",why:r.marketEffects,nextTest:r.whatNext,
   kind:r.kind==="bank"?"bank" as const:"earnings" as const,
  }));
 const decisions:NewsroomEditorialItem[]=banks.filter(b=>!recapIds.has(b.id)).map(b=>({
  id:"policy:"+b.id,headline:b.headline,summary:b.observedStatement,
  occurredAt:b.releaseAt,sourceName:b.sourceName,sourceUrl:b.sourceUrl,
  readerHref:readerHref+"?policy="+encodeURIComponent(b.id),
  topics:["policy","bonds"] as EditorialTopicId[],
  verificationLabel:"ORIGINAL BANK STATEMENT",why:b.financialMechanism,nextTest:b.nextTest,kind:"bank",
 }));
 const incidents:NewsroomEditorialItem[]=reports.map(r=>({
  id:"reported:"+r.id,headline:r.headline,summary:r.reporting,occurredAt:r.publishedAt,
  sourceName:r.publisher,sourceUrl:r.sourceUrl,
  readerHref:readerHref+"?reported="+encodeURIComponent(r.id),
  topics:(r.kind==="VERIFIED_INCIDENT"?["crypto"]:["ai","earnings"]) as EditorialTopicId[],
  verificationLabel:r.kind==="VERIFIED_INCIDENT"?"OFFICIAL INCIDENT · ESTIMATED IMPACT":"ATTRIBUTED REPORT · UNCONFIRMED",
  why:r.why,nextTest:r.nextTest,kind:r.kind==="VERIFIED_INCIDENT"?"incident":"reported",
 }));
 const at=+now;
 return [...incidents,...reviewed,...decisions]
  .filter(item=>Number.isFinite(at)&&Number.isFinite(Date.parse(item.occurredAt))&&Date.parse(item.occurredAt)<=at&&item.sourceUrl.startsWith("https://"))
  .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)||a.id.localeCompare(b.id));
}
