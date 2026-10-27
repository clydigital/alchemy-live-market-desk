/**
 * Branch 03 consumes rows from a Branch 02-authorised read; it does not perform
 * authentication, database access, transcript discovery or publication.
 * Stored claim_checks are research PARAPHRASES, not transcript quotations.
 */
import {prepareCreatorStory,parseCreatorStoryDraft,renderCreatorStoryMarkdown,
 type CreatorStoryInput,type CreatorStoryModelOutput,type PreparedCreatorStory,
 type CreatorStoryDraft} from "./blue-desk-creator-summary-compiler.ts";

export const CREATOR_SOURCE_PACKET_VERSION="bluebelly-creator-sources/1" as const;
export const APPROVED_CREATOR_PUBLISHERS={
 stockedup:"StockedUp",
 "wall-street-truth-bombs":"Wall Street Truthbombs",
 "fx-evolution":"FX Evolution",
 tradernick:"TraderNick",
} as const;
export type ApprovedCreatorId=keyof typeof APPROVED_CREATOR_PUBLISHERS;

/** Existing read-only source-row shape; MUST originate from the authenticated Branch 02 reader. */
export type CreatorIntakeReadRow={
 id:string;run_id:string;item_key:string;publisher:string;external_id:string;
 title:string;url:string;published_at:string;transcript_status:string;
 transcript_job_status:string|null;video_review_status:string|null;
 transcript_text:string|null;transcript_retrieved_at:string|null;
 transcript_provider:string|null;transcript_evidence_id?:string|null;
 transcript_segments:unknown;claim_checks:unknown;
};
export type CreatorEditorialAnchor={
 videoId:string;segmentIndex:number;threadId:string;claimCheckIndex?:number|null;
 relationTo?:{claimId:string;type:"reinforces"|"revises"|"contradicts"};
};
export type CreatorSourceReceipt={
 rowId:string;runId:string;itemKey:string;videoId:string;
 transcriptEvidenceId:string|null;publishedAt:string;
 transcriptRetrievedAt:string|null;transcriptProvider:string|null;
 transcriptState:"complete"|"pending";reviewState:string|null;
};
export type CreatorSourceProjection={
 contractVersion:typeof CREATOR_SOURCE_PACKET_VERSION;
 creatorId:ApprovedCreatorId;asOf:string;packet:CreatorStoryInput;
 prepared:PreparedCreatorStory|null;
 sourceReceipts:CreatorSourceReceipt[];selectedAnchorCount:number;
 acceptedAnchorCount:number;pendingVideoIds:string[];
 verificationState:"CREATOR_COMMENTARY_UNVERIFIED";visibility:"owner";
};
export type CreatorOwnerReviewBundle={
 contractVersion:typeof CREATOR_SOURCE_PACKET_VERSION;
 creatorId:ApprovedCreatorId;visibility:"owner";status:"draft";
 verificationState:"CREATOR_COMMENTARY_UNVERIFIED";
 asOf:string;markdown:string;draft:CreatorStoryDraft;
 sourceReceipts:CreatorSourceReceipt[];
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const vid=/^[A-Za-z0-9_-]{11}$/;
const fixed=(v:unknown,max:number):v is string=>
 typeof v==="string"&&v.length>=1&&v.length<=max&&v.trim()===v;
const stamp=(v:unknown,cutoff:number):string|null=>{
 if(typeof v!=="string"||!/(?:T| )\d\d:\d\d/.test(v))return null;
 const t=Date.parse(v);return Number.isFinite(t)&&t<=cutoff?new Date(t).toISOString():null;
};
type Segment={text:string;startSeconds:number;endSeconds:number};
const validSegment=(s:unknown,text:string):s is Segment=>{
 if(!s||typeof s!=="object"||Array.isArray(s))return false;
 const x=s as Record<string,unknown>;
 return fixed(x.text,2000)&&text.includes(x.text)&&
 typeof x.startSeconds==="number"&&Number.isFinite(x.startSeconds)&&
 typeof x.endSeconds==="number"&&Number.isFinite(x.endSeconds)&&
 x.startSeconds>=0&&x.startSeconds<=86400&&
 x.endSeconds>=x.startSeconds&&x.endSeconds<=86400;
};
/**
 * Pure adapter from an ALREADY authorised table read. An editorial anchor
 * must identify an original transcript segment by its original index.
 * Relation and meaning are human editorial judgements, NEVER inferred.
 */
export function projectCreatorIntakeForReview(input:{
 creatorId:ApprovedCreatorId;asOf:string;rows:readonly CreatorIntakeReadRow[];
 selectedAnchors:readonly CreatorEditorialAnchor[];previousEditionId?:string|null;
}):CreatorSourceProjection{
 if(!Object.hasOwn(APPROVED_CREATOR_PUBLISHERS,input.creatorId))throw Error("CREATOR_ID_NOT_APPROVED");
 const cutoff=Date.parse(input.asOf);
 if(!Number.isFinite(cutoff)||!input.asOf.includes("T")||
    !Array.isArray(input.rows)||input.rows.length>25||
    !Array.isArray(input.selectedAnchors)||input.selectedAnchors.length>160)
   throw Error("INVALID_CREATOR_READ_PACKET");
 const rows=new Map<string,CreatorIntakeReadRow>();
 const sources:CreatorStoryInput["videos"][number][]=[];
 const receipts:CreatorSourceReceipt[]=[];
 const segmentsByVideo=new Map<string,Array<Segment&{sourceIndex:number}>>();
 for(const row of input.rows){
   if(!row||row.publisher!==APPROVED_CREATOR_PUBLISHERS[input.creatorId]||
      !uuid.test(row.id)||!uuid.test(row.run_id)||!vid.test(row.external_id)||
      rows.has(row.external_id)||
      row.item_key!=="youtube:"+input.creatorId+":"+row.external_id||
      !fixed(row.title,180)||!fixed(row.url,500)||!stamp(row.published_at,cutoff))
     throw Error("UNTRUSTED_CREATOR_SOURCE_ROW");
   const published=stamp(row.published_at,cutoff)!;
   const retrieved=stamp(row.transcript_retrieved_at,cutoff);
   const completed=row.transcript_status==="ready"&&
     row.transcript_job_status==="completed"&&row.video_review_status==="reviewed"&&
     retrieved!==null&&typeof row.transcript_text==="string"&&
     row.transcript_text.trim().length>=60&&row.transcript_text.length<=1000000&&
     fixed(row.transcript_provider,90);
   const good:Array<Segment&{sourceIndex:number}>=[];
   if(completed){
     if(!Array.isArray(row.transcript_segments)||row.transcript_segments.length>5000)
       throw Error("INVALID_CREATOR_SEGMENT_PAYLOAD");
     let previous=-1;
     row.transcript_segments.forEach((s:unknown,index:number)=>{
       if(validSegment(s,row.transcript_text!)&&s.startSeconds>=previous){
         good.push({...s,sourceIndex:index});previous=s.startSeconds;
       }
     });
   }
   rows.set(row.external_id,row);segmentsByVideo.set(row.external_id,good);
   sources.push({
     creatorId:input.creatorId,videoId:row.external_id,
     originalUrl:row.url,title:row.title,publishedAt:published,
     transcriptStatus:completed?"complete":row.transcript_status==="missing"?"missing":"partial",
     transcriptText:completed?row.transcript_text:null,
     transcriptRetrievedAt:completed?retrieved:null,
     transcriptProvider:completed?row.transcript_provider:null,
     transcriptSegments:good.map(({sourceIndex:_,...s})=>s),
   });
   receipts.push({
     rowId:row.id,runId:row.run_id,itemKey:row.item_key,videoId:row.external_id,
     transcriptEvidenceId:row.transcript_evidence_id??null,
     publishedAt:published,transcriptRetrievedAt:retrieved,
     transcriptProvider:row.transcript_provider,
     transcriptState:completed?"complete":"pending",reviewState:row.video_review_status,
   });
 }
 const seen=new Set<string>();
 const claims:CreatorStoryInput["claims"][number][]=[];
 for(const anchor of input.selectedAnchors){
   if(!anchor||!vid.test(anchor.videoId)||!rows.has(anchor.videoId)||
      !Number.isInteger(anchor.segmentIndex)||anchor.segmentIndex<0||
      anchor.segmentIndex>4999||!fixed(anchor.threadId,90)||
      !/^[A-Za-z0-9_-]{3,90}$/.test(anchor.threadId)||
      (anchor.claimCheckIndex!=null&&
       (!Number.isInteger(anchor.claimCheckIndex)||anchor.claimCheckIndex<0||anchor.claimCheckIndex>100)))
      throw Error("UNTRUSTED_CREATOR_ANCHOR");
   const key=anchor.videoId+"_"+anchor.segmentIndex+"_"+(anchor.claimCheckIndex??"quote");
   if(seen.has(key))throw Error("DUPLICATE_CREATOR_ANCHOR");
   seen.add(key);
   const source=rows.get(anchor.videoId)!;
   const segment=segmentsByVideo.get(anchor.videoId)!.find(s=>s.sourceIndex===anchor.segmentIndex);
   if(!segment)throw Error("CLAIM_NOT_ANCHORED_TO_COMPLETE_TRANSCRIPT");
   let assertion=segment.text;
   if(anchor.claimCheckIndex!=null){
     const checks=Array.isArray(source.claim_checks)?source.claim_checks:[];
     const check=checks[anchor.claimCheckIndex];
     if(!check||typeof check!=="object"||Array.isArray(check)||
        !fixed((check as Record<string,unknown>).claim,1000))
       throw Error("INVALID_RESEARCH_CLAIM_INDEX");
     assertion=(check as {claim:string}).claim;
     // Research paraphrase semantics MUST be owner reviewed. Never assert
     // exact quotation or independently verified market fact from this join.
   }
   if(assertion.length<12||segment.text.length<12)throw Error("CREATOR_EXCERPT_TOO_SHORT");
   claims.push({
     creatorId:input.creatorId,videoId:anchor.videoId,
     claimId:"c_"+key,threadId:anchor.threadId,assertion,
     transcriptExcerpt:segment.text,transcriptSeconds:segment.startSeconds,
     ...(anchor.relationTo?{relationTo:anchor.relationTo}:{}),
   });
 }
 const packet:CreatorStoryInput={
   creatorId:input.creatorId,asOf:new Date(cutoff).toISOString(),
   previousEditionId:input.previousEditionId??null,videos:sources,claims,
 };
 const prepared=prepareCreatorStory(packet);
 return {
   contractVersion:CREATOR_SOURCE_PACKET_VERSION,
   creatorId:input.creatorId,asOf:packet.asOf,packet,prepared,
   sourceReceipts:receipts,selectedAnchorCount:input.selectedAnchors.length,
   acceptedAnchorCount:prepared?.claims.length??0,
   pendingVideoIds:prepared?.pendingTranscriptIds??sources.map(s=>s.videoId),
   verificationState:"CREATOR_COMMENTARY_UNVERIFIED",visibility:"owner",
 };
}
/** Packages a generated result for existing owner review; does not save it. */
export function compileCreatorOwnerReviewBundle(
 projection:CreatorSourceProjection,modelOutput:CreatorStoryModelOutput,
):CreatorOwnerReviewBundle|null{
 if(!projection.prepared||projection.acceptedAnchorCount<1)return null;
 const draft=parseCreatorStoryDraft(modelOutput,projection.prepared);
 if(!draft)return null;
 return {
   contractVersion:CREATOR_SOURCE_PACKET_VERSION,
   creatorId:projection.creatorId,visibility:"owner",status:"draft",
   verificationState:"CREATOR_COMMENTARY_UNVERIFIED",
   asOf:projection.asOf,markdown:renderCreatorStoryMarkdown(draft),
   draft,sourceReceipts:projection.sourceReceipts.map(s=>({...s})),
 };
}
