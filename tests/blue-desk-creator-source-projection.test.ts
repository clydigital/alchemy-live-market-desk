import test from "node:test";
import assert from "node:assert/strict";
import {CREATOR_SOURCE_PACKET_VERSION,projectCreatorIntakeForReview,renderCreatorSourceTimeline,
 compileCreatorOwnerReviewBundle,type CreatorIntakeReadRow,
 type CreatorEditorialAnchor} from "../lib/blue-desk-creator-source-projection.ts";

/**
 * Source-shaped fixture: real IDs, titles, dates and segment excerpts observed
 * by a read-only 27 Oct 2026 database audit. Only the minimum segment fragments
 * are reproduced; this is NOT a complete production transcript or an
 * authenticated HTTP owner-readback test.
 */
const oldVideo="o1Q2zBpwNxM",newVideo="AkTXAcMgO3E";
const oldExcerpt="The 10-year yield closed below 5% on";
const newExcerpt="American Treasury yields drift below 5%";
const asOf="2026-10-27T00:30:00Z";
const segments=(index:number,txt:string,startSeconds:number,endSeconds:number)=>{
 const result:unknown[]=Array(index+1).fill(null);
 result[index]={text:txt,startSeconds,endSeconds};
 return result;
};
const oldSource:CreatorIntakeReadRow={
 id:"f59dad20-dab3-4bce-bdae-4da4cb4216e0",
 run_id:"50c852f3-415a-41c9-b9af-396a7803db61",
 item_key:"youtube:wall-street-truth-bombs:"+oldVideo,
 publisher:"Wall Street Truthbombs",external_id:oldVideo,
 title:"Big Tech vs. $116 Crude: The $145B Capex Shock Hitting Stocks",
 url:"https://www.youtube.com/watch?v="+oldVideo,
 published_at:"2026-10-25 20:00:33+00",transcript_status:"ready",
 transcript_job_status:"completed",video_review_status:"reviewed",
 transcript_text:"An earlier commentary segment: "+oldExcerpt+
  " This is an attributed transcript fragment, not a complete report.",
 transcript_retrieved_at:"2026-10-26 01:40:59.294+00",
 transcript_provider:"supadata",
 transcript_segments:segments(38,oldExcerpt,100.079,104.64),
 claim_checks:[{claim:"Prior view: ten-year yields were lower, subject to market confirmation.",kind:"creator_claim",verificationNeeded:true}],
};
const newSource:CreatorIntakeReadRow={
 id:"ec73ea53-2a1e-4a03-af21-5511d3b2a05a",
 run_id:"1618d22f-4549-4de3-9315-d4ec6e364058",
 item_key:"youtube:wall-street-truth-bombs:"+newVideo,
 publisher:"Wall Street Truthbombs",external_id:newVideo,
 title:"Yields Dip Under 5%: Why Did Oil & Factory Prices Explode?",
 url:"https://www.youtube.com/watch?v="+newVideo,
 published_at:"2026-10-26 12:15:37+00",transcript_status:"ready",
 transcript_job_status:"completed",video_review_status:"reviewed",
 transcript_text:"Newer commentary begins with: "+newExcerpt+
  " This is only a short verified excerpt for a unit test.",
 transcript_retrieved_at:"2026-10-26 13:18:39.002+00",
 transcript_provider:"supadata",
 transcript_segments:segments(2,newExcerpt,2.96,8.76),
 claim_checks:[{claim:"The later video argues that Treasury yields can remain under pressure.",kind:"creator_claim",verificationNeeded:true}],
};
const firstClaim="c_"+oldVideo+"_38_quote";
const lastClaim="c_"+newVideo+"_2_quote";
const anchors:CreatorEditorialAnchor[]=[
 {videoId:oldVideo,segmentIndex:38,threadId:"yield-pressure"},
 {videoId:newVideo,segmentIndex:2,threadId:"yield-pressure"},
];
const packet=()=>({
 creatorId:"wall-street-truth-bombs" as const,asOf,
 rows:[oldSource,newSource],selectedAnchors:anchors,
});
const model=()=>({
 headline:"The creator returns to a question about Treasury yields",
 centralTension:"The earlier video mentioned falling Treasury yields. The following video returned to the subject, but the extracts cannot establish the full argument.",
 acts:[
  {title:"Act 1 — Earlier discussion",
   body:"In the earlier transcript, the creator referred to the 10-year yield closing below 5%. That is a quoted creator statement rather than independently verified market data.",
   claimIds:[firstClaim],videoIds:[oldVideo]},
  {title:"Act 2 — Following discussion",
   body:"The following video referred to American Treasury yields drifting below 5%. This is a subsequent discussion of a similar theme, not proof of a changed thesis.",
   claimIds:[lastClaim],videoIds:[newVideo]},
 ],
 learningMoments:[],
 latestCreatorView:"The most recent transcript excerpt refers to Treasury yields below 5%, but provides insufficient evidence here to determine whether the speaker changed his forecast.",
 latestClaimId:lastClaim,
 watchpoints:[{question:"Can independent yield observations confirm the quoted movement?",claimIds:[lastClaim]}],
 limitations:"Only selected original transcript fragments were supplied to this fixture. The speaker's statements and interpretation remain unverified pending original market evidence.",
});
test("a real-source-shaped two-video owner packet projects into two cited chronological acts",()=>{
 const p=projectCreatorIntakeForReview(packet());
 assert.equal(p.contractVersion,CREATOR_SOURCE_PACKET_VERSION);
 assert.equal(p.prepared?.creatorId,"wall-street-truth-bombs");
 assert.deepEqual(p.prepared?.consumedVideoIds,[oldVideo,newVideo]);
 assert.equal(p.acceptedAnchorCount,2);
 assert.deepEqual(p.pendingVideoIds,[]);
 assert.deepEqual(p.prepared?.thesisChanges,[],"Chronology alone cannot invent a changed forecast");
 assert.equal(p.prepared?.claims[0].transcriptExcerpt,oldExcerpt);
 assert.equal(p.prepared?.claims[0].transcriptSeconds,100.079);
 assert.equal(p.prepared?.claims[1].transcriptSeconds,2.96);
 assert.equal(p.sourceReceipts[0].rowId,oldSource.id);
 assert.equal(p.sourceReceipts[1].runId,newSource.run_id);
 assert.equal(p.verificationState,"CREATOR_COMMENTARY_UNVERIFIED");
 const draft=compileCreatorOwnerReviewBundle(p,model());
 assert.ok(draft);
 assert.equal(draft.visibility,"owner");
 assert.equal(draft.status,"draft");
 assert.match(draft.markdown,/## Act 1/);
 assert.match(draft.markdown,/## Act 2/);
 assert.match(draft.markdown,/watch\?v=o1Q2zBpwNxM&t=100s/);
 assert.match(draft.markdown,/watch\?v=AkTXAcMgO3E&t=2s/);
 assert.equal(draft.sourceReceipts.length,2);
 assert.equal("transcript_text" in draft.sourceReceipts[0],false);
 assert.equal("transcriptText" in draft.draft.sourceLedger[0],false);
 assert.ok(!draft.markdown.includes("Prior view: ten-year yields were lower"));
});
test("a partial or unreviewed transcript stays pending, never supports a selected segment",()=>{
 const unavailable={...newSource,video_review_status:"pending"};
 const p=projectCreatorIntakeForReview({...packet(),rows:[oldSource,unavailable],
  selectedAnchors:[anchors[0]]});
 assert.deepEqual(p.prepared?.consumedVideoIds,[oldVideo]);
 assert.deepEqual(p.pendingVideoIds,[newVideo]);
 assert.equal(p.prepared?.claims.length,1);
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),rows:[oldSource,unavailable]}),
   /CLAIM_NOT_ANCHORED_TO_COMPLETE_TRANSCRIPT/);
 const tooLate={...newSource,transcript_retrieved_at:"2026-10-28T00:00:00Z"};
 assert.deepEqual(projectCreatorIntakeForReview({...packet(),rows:[oldSource,tooLate],
  selectedAnchors:[anchors[0]]}).pendingVideoIds,[newVideo]);
});
test("the reader cannot mix publishers, replay duplicate video IDs or forge intake receipts",()=>{
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),rows:[oldSource,
  {...newSource,publisher:"TraderNick"}]}),/UNTRUSTED_CREATOR_SOURCE_ROW/);
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),rows:[oldSource,oldSource]}),
   /UNTRUSTED_CREATOR_SOURCE_ROW/);
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),rows:[{...oldSource,run_id:"not-a-uuid"},newSource]}),
   /UNTRUSTED_CREATOR_SOURCE_ROW/);
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),creatorId:"unapproved" as never}),
   /CREATOR_ID_NOT_APPROVED/);
});
test("a wrong index, wrong segment text and unavailable transcript must fail closed",()=>{
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),selectedAnchors:[
  {...anchors[0],segmentIndex:3},anchors[1]]}),/CLAIM_NOT_ANCHORED_TO_COMPLETE_TRANSCRIPT/);
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),rows:[
  {...oldSource,transcript_segments:segments(38,"Fabricated quote",100.079,104.64)},newSource]}),
   /CLAIM_NOT_ANCHORED_TO_COMPLETE_TRANSCRIPT/);
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),selectedAnchors:[
  anchors[0],anchors[0]]}),/DUPLICATE_CREATOR_ANCHOR/);
});
test("claim_checks remain paraphrases and need explicit reviewer indexing",()=>{
 const p=projectCreatorIntakeForReview({...packet(),selectedAnchors:[
  {...anchors[0],claimCheckIndex:0},anchors[1],
 ]});
 assert.equal(p.prepared?.claims[0].assertion,
  "Prior view: ten-year yields were lower, subject to market confirmation.");
 assert.equal(p.prepared?.claims[0].transcriptExcerpt,oldExcerpt);
 assert.notEqual(p.prepared?.claims[0].assertion,p.prepared?.claims[0].transcriptExcerpt);
 assert.equal(p.verificationState,"CREATOR_COMMENTARY_UNVERIFIED");
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),selectedAnchors:[
  {...anchors[0],claimCheckIndex:25},anchors[1]]}),/INVALID_RESEARCH_CLAIM_INDEX/);
});
test("revisions require explicit chronology-valid relation; broken source IDs are rejected",()=>{
 const later={...anchors[1],relationTo:{claimId:firstClaim,type:"reinforces" as const}};
 const projection=projectCreatorIntakeForReview({...packet(),selectedAnchors:[anchors[0],later]});
 assert.equal(projection.prepared?.thesisChanges[0].type,"reinforces");
 assert.equal(projection.prepared?.thesisChanges[0].laterVideoId,newVideo);
 assert.equal(compileCreatorOwnerReviewBundle(projection,{...model(),
  acts:[{...model().acts[0],claimIds:["invented_claim"]},model().acts[1]]}),null);
 assert.throws(()=>projectCreatorIntakeForReview({...packet(),selectedAnchors:[
  {...anchors[0],relationTo:{claimId:lastClaim,type:"revises"}},anchors[1]
 ]}),/INVALID_THESIS_CHANGE_LINEAGE/);
});

test("model-free timeline exposes only selected attributed excerpts and exact private read receipts",()=>{
 const projection=projectCreatorIntakeForReview(packet());
 const md=renderCreatorSourceTimeline(projection);
 assert.match(md,/## Act 1/);
 assert.match(md,/## Act 2/);
 assert.match(md,/watch\?v=o1Q2zBpwNxM&t=100s/);
 assert.match(md,/watch\?v=AkTXAcMgO3E&t=2s/);
 assert.match(md,/No thesis revision or reinforcement has been established/);
 assert.match(md,/Awaiting human review/);
 assert.match(md,/Creator commentary/);
 assert.ok(md.includes(oldSource.id));
 assert.ok(md.includes(newSource.run_id));
 assert.ok(!md.includes("Prior view: ten-year yields were lower"));
 assert.ok(!md.includes("transcript_text"));
 const unavailable={...newSource,video_review_status:"pending"};
 const partial=projectCreatorIntakeForReview({...packet(),rows:[oldSource,unavailable],
  selectedAnchors:[anchors[0]]});
 assert.match(renderCreatorSourceTimeline(partial),/Pending transcripts/);
 assert.match(renderCreatorSourceTimeline(partial),/AkTXAcMgO3E — not used as story evidence/);
});
