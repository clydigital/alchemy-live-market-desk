import test from "node:test";
import assert from "node:assert/strict";
import {prepareCreatorStory,buildCreatorStoryPrompt,parseCreatorStoryDraft,renderCreatorStoryMarkdown,
 CREATOR_STORY_EDITORIAL_STANDARD,type CreatorStoryInput} from "../lib/blue-desk-creator-summary-compiler.ts";

const asOf="2026-10-27T01:00:00Z";
const one="AAAAAAAAAAA",two="BBBBBBBBBBB",old="CCCCCCCCCCC",pending="DDDDDDDDDDD";
const original="The company could fund growth internally, but its debt costs may rise.";
const update="New financing terms now make debt more expensive than expected.";
const transcript=(excerpt:string)=>("In today's discussion: "+excerpt+" The outcome remains uncertain. ").repeat(3);
const video=(id:string,publishedAt:string,excerpt:string,status:"complete"|"partial"|"missing"|"discovered"="complete")=>({
 creatorId:"market-creator",videoId:id,originalUrl:"https://www.youtube.com/watch?v="+id,
 title:"A documented financial market argument",publishedAt,transcriptStatus:status,
 transcriptText:status==="complete"?transcript(excerpt):null,
 transcriptRetrievedAt:status==="complete"?"2026-10-26T23:30:00Z":null,
 transcriptProvider:status==="complete"?"verified-backend":"none",
 transcriptSegments:status==="complete"?[
  {text:excerpt,startSeconds:48,endSeconds:53.25},
 ]:[],
});
const claim=(claimId:string,id:string,excerpt:string,relationTo?:{claimId:string;type:"revises"|"reinforces"|"contradicts"})=>({
 claimId,creatorId:"market-creator",videoId:id,threadId:"financing",
 assertion:excerpt,transcriptExcerpt:excerpt,transcriptSeconds:48,relationTo,
});
function packet():CreatorStoryInput {
 return {creatorId:"market-creator",asOf,
  videos:[
   video(one,"2026-10-24T13:00:00Z",original),
   video(two,"2026-10-26T12:00:00Z",update),
   video(pending,"2026-10-25T15:00:00Z","This should never be used.","partial"),
  ],
  claims:[
   claim("claim_old",one,original),
   claim("claim_new",two,update,{claimId:"claim_old",type:"revises"}),
   claim("claim_pending",pending,"This should never be used."),
  ],
 };
}
function model() {
 return {
  headline:"Can borrowing costs change the investment story?",
  centralTension:"The creator's earlier financing case ran into a complication as borrowing costs became harder to ignore.",
  acts:[
   {title:"Act 1 — The original view",
    body:"The creator first argued that internal cash could fund the plan. That was the starting point, not an independently confirmed company forecast. This remains an attributed account.",
    claimIds:["claim_old"],videoIds:[one]},
   {title:"Act 2 — Financing complicates the picture",
    body:"A later video raised the cost of new borrowing, revising the first argument. This does not prove actual market prices moved or that the company has accepted any loan agreement.",
    claimIds:["claim_new"],videoIds:[two]},
  ],
  learningMoments:[{question:"What can higher borrowing costs do to a company?",
    explanation:"More expensive debt can reduce the cash left for growth, although stronger operating profit could offset that cost.",
    claimIds:["claim_new"]}],
  latestCreatorView:"The latest supported position is more cautious about external finance; the creator has not established the outcome of any transaction.",
  latestClaimId:"claim_new",
  watchpoints:[{question:"Does the next verified financing agreement support the revised case?",claimIds:["claim_new"]}],
  limitations:"These claims reflect one creator's commentary from consumed video transcripts, not independent verification or canonical market evidence.",
 };
}
test("one creator and two transcript-consumed videos make one revision-led draft with actual citations",()=>{
 const prepared=prepareCreatorStory(packet())!;
 assert.ok(prepared);
 assert.deepEqual(prepared.consumedVideoIds,[one,two]);
 assert.deepEqual(prepared.pendingTranscriptIds,[pending]);
 assert.deepEqual(prepared.thesisChanges,[{earlierClaimId:"claim_old",laterClaimId:"claim_new",
  type:"revises",earlierVideoId:one,laterVideoId:two}]);
 assert.equal(prepared.claims.length,2);
 const draft=parseCreatorStoryDraft(model(),prepared)!;
 assert.ok(draft);
 assert.equal(draft.acts.length,2);
 assert.equal(draft.latestClaimId,"claim_new");
 assert.equal(draft.verificationStatus,"creator_attributed_unverified");
 assert.equal(draft.editorialStandard,CREATOR_STORY_EDITORIAL_STANDARD);
 assert.deepEqual(draft.sourceLedger.filter(x=>x.consumed).map(x=>x.videoId),[one,two]);
 assert.deepEqual(draft.acts.flatMap(x=>x.claimIds),["claim_old","claim_new"]);
 assert.equal("transcriptText" in draft.sourceLedger[0],false);
 assert.equal(draft.status,"draft");
 const prompt=JSON.parse(buildCreatorStoryPrompt(prepared));
 assert.equal(prompt.claims.length,2);
 assert.deepEqual(prompt.pendingTranscriptIds,[pending]);
 assert.ok(!JSON.stringify(prompt).includes("This should never be used."));
 assert.ok(!JSON.stringify(prompt).includes("transcriptText"));
 assert.ok(!JSON.stringify(prompt).includes("transcriptSegments"));
});
test("no complete transcript backed claim blocks story; incomplete discoveries remain pending in mixed batches",()=>{
 const all=packet();
 assert.equal(prepareCreatorStory({...all,videos:[all.videos[2]],claims:[all.claims[2]]}),null);
 const mixed=prepareCreatorStory(all)!;
 assert.ok(!mixed.consumedVideoIds.includes(pending));
 assert.ok(!mixed.claims.some(c=>c.videoId===pending));
});
test("late older transcript contributes only to a NEW caller-versioned draft, not a mutable watermark",()=>{
 const base=packet();const originalPrepared=prepareCreatorStory(base)!;
 const lateVideo=video(old,"2026-10-23T13:00:00Z","Earlier views favoured selling the asset.");
 const revised=prepareCreatorStory({...base,previousEditionId:"edition_older",
  videos:[...base.videos,lateVideo],claims:[...base.claims,
   claim("claim_late",old,"Earlier views favoured selling the asset.")]})!;
 assert.deepEqual(revised.consumedVideoIds,[old,one,two]);
 assert.equal(revised.previousEditionId,"edition_older");
 assert.deepEqual(originalPrepared.consumedVideoIds,[one,two]);
 assert.equal("watermark" in revised,false);
});
test("cross-creator batches and duplicate videos fail instead of inventing one speaker",()=>{
 const x=packet();
 assert.throws(()=>prepareCreatorStory({...x,videos:[{...x.videos[0],creatorId:"other-creator"},...x.videos.slice(1)]}),/INVALID_VIDEO_PROVENANCE/);
 assert.throws(()=>prepareCreatorStory({...x,videos:[x.videos[0],x.videos[0]]}),/INVALID_VIDEO_PROVENANCE/);
});
test("claim must be anchored in a fully consumed transcript; changed thesis needs valid chronology",()=>{
 const x=packet();
 assert.throws(()=>prepareCreatorStory({...x,claims:[{...x.claims[0],transcriptExcerpt:"A statement nowhere in the transcript"},x.claims[1]]}),/CLAIM_EXCERPT_NOT_IN_TRANSCRIPT/);
 assert.throws(()=>prepareCreatorStory({...x,claims:[{...x.claims[0],relationTo:{claimId:"claim_new",type:"revises"}},x.claims[1]]}),/INVALID_THESIS_CHANGE_LINEAGE/);
});
test("rejects forged video citations, new numbers, invented latest position and incorrect claim references",()=>{
 const prepared=prepareCreatorStory(packet())!;
 const valid=model();
 assert.equal(parseCreatorStoryDraft({...valid,acts:[{...valid.acts[0],videoIds:[pending]},valid.acts[1]]},prepared),null);
 assert.equal(parseCreatorStoryDraft({...valid,acts:[{...valid.acts[0],claimIds:["claim_pending"]},valid.acts[1]]},prepared),null);
 assert.equal(parseCreatorStoryDraft({...valid,latestClaimId:"claim_old"},prepared),null);
 assert.equal(parseCreatorStoryDraft({...valid,acts:[{...valid.acts[0],body:valid.acts[0].body+" Yield rose to 98765 basis points."},valid.acts[1]]},prepared),null);
 const incomplete={...prepared,sources:prepared.sources.filter(x=>x.videoId!==two)};
 assert.equal(parseCreatorStoryDraft(model(),incomplete),null);
});
test("all creator assertions remain attribution, never Dossier evidence or external verification",()=>{
 const prepared=prepareCreatorStory(packet())!;
 const draft=parseCreatorStoryDraft(model(),prepared)!;
 assert.equal(draft.verificationStatus,"creator_attributed_unverified");
 assert.equal(draft.visibility,"owner");
 assert.equal(draft.surface,"Bluebelly");
 assert.equal("canonicalEvidenceIds" in draft,false);
 assert.equal("isPublished" in draft,false);
 assert.ok(!JSON.stringify(draft).includes("transcriptText"));
});

test("Markdown companion preserves act citations, exact YouTube timecodes, pending videos and private label",()=>{
 const prepared=prepareCreatorStory(packet())!;
 const draft=parseCreatorStoryDraft(model(),prepared)!;
 const markdown=renderCreatorStoryMarkdown(draft);
 assert.match(markdown,/## Act 1/);
 assert.match(markdown,/## Act 2/);
 assert.match(markdown,/watch\?v=BBBBBBBBBBB&t=48s/);
 assert.match(markdown,/## Thesis changes/);
 assert.match(markdown,/## Source videos/);
 assert.match(markdown,/pending\/partial transcript/);
 assert.match(markdown,/Owner review draft/);
 assert.match(markdown,/not canonical Dossier evidence/);
 assert.ok(!markdown.includes("transcriptText"));
});

test("real provider segment positions, not merely matching transcript text, authorise video timecodes",()=>{
 const x=packet();
 assert.throws(()=>prepareCreatorStory({...x,claims:[
  {...x.claims[0],transcriptSeconds:99},x.claims[1],x.claims[2],
 ]}),/UNATTESTED_TRANSCRIPT_TIMECODE/);
 assert.throws(()=>prepareCreatorStory({...x,videos:[
  {...x.videos[0],transcriptSegments:[]},...x.videos.slice(1),
 ]}),/UNATTESTED_TRANSCRIPT_TIMECODE/);
 assert.throws(()=>prepareCreatorStory({...x,videos:[
  {...x.videos[0],transcriptSegments:[{text:"An excerpt not in the transcript",startSeconds:48,endSeconds:49}]},
  ...x.videos.slice(1),
 ]}),/INVALID_TRANSCRIPT_SEGMENTS/);
 const precise=prepareCreatorStory({...x,videos:[
  {...x.videos[0],transcriptSegments:[{text:original,startSeconds:48.24,endSeconds:53.25}]},
  ...x.videos.slice(1),
 ],claims:[{...x.claims[0],transcriptSeconds:48.24},...x.claims.slice(1)]})!;
 assert.equal(precise.claims[0].transcriptSeconds,48.24);
 const draft=parseCreatorStoryDraft(model(),precise)!;
 assert.match(renderCreatorStoryMarkdown(draft),/watch\?v=AAAAAAAAAAA&t=48s/);
});
test("untimed transcripts may be cited without fabricating a deep link or retrieval seconds",()=>{
 const x=packet();
 const claims=x.claims.map(c=>({...c,transcriptSeconds:null}));
 const videos=x.videos.map(v=>({...v,transcriptSegments:undefined}));
 const prepared=prepareCreatorStory({...x,videos,claims})!;
 const draft=parseCreatorStoryDraft(model(),prepared)!;
 const md=renderCreatorStoryMarkdown(draft);
 assert.match(md,/watch\?v=AAAAAAAAAAA\)/);
 assert.ok(!md.includes("t=48s"));
});
