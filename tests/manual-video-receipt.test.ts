import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { parseManualCaptionReceipt, buildManualCaptionCheckpoint } from "../lib/manual-video-receipt.ts";
import { handleVideoIntakeRequest } from "../lib/video-intake-handler.ts";

const text = "Synthetic native caption for source intake tests only. ".repeat(12);
const now = new Date("2026-11-26T05:30:00Z");
function fixture() {
  return {
    version:"native-caption-receipt/1",provider:"scrapecreators",sourceKind:"native_caption",
    sourceReceiptUrl:"https://app.notion.com/p/409519b67a9481f9ac8adbe7d1adae48",
    receiptId:"TEST-RECEIPT",channelKey:"fx-evolution",channelId:"UCvJZEG5x-DVYZKTz--pS39w",
    videoId:"abcdefghijk",url:"https://www.youtube.com/watch?v=abcdefghijk",
    title:"Synthetic eligible market review",publishedAt:"2026-11-26T01:00:00Z",
    retrievedAt:"2026-11-26T05:00:00Z",isLive:false,isShort:false,durationSeconds:240,language:"English",
    transcriptText:text,transcriptSha256:createHash("sha256").update(text).digest("hex"),
    segments:[0,60,120,180].map(start=>({startMs:start*1000,endMs:(start+59)*1000,text:"Synthetic caption segment."})),
  };
}
test("verified native caption imports to blocked pending interpretation, never accepted evidence",()=>{
  const r=parseManualCaptionReceipt(fixture(),now,{});
  const cp=buildManualCaptionCheckpoint(r,undefined,now);
  assert.equal(cp.transcript_status,"ready");
  assert.equal(cp.transcript_provider,"other");
  assert.equal(cp.video_review_status,"transcript_only");
  assert.equal(cp.transcript_job_status,"pending");
  assert.equal(cp.status,"blocked");
  assert.equal(cp.transcript_metadata.retrievalProvider,"scrapecreators");
  assert.equal(cp.transcript_metadata.manualReceipt.sha256,r.sha);
  assert.equal("transcript_evidence_id" in cp,false);
});
test("invalid fingerprint, partial coverage, summary-only, wrong channel, shorts and future dates fail closed",()=>{
  for (const patch of [
    {transcriptSha256:"0".repeat(64)},
    {segments:fixture().segments.slice(0,2)},
    {provider:"gemini"},
    {sourceKind:"summary_only"},
    {channelKey:"meetkevin",channelId:"UCPk6nJE8pBZPLCW2DAvaZOA"},
    {isShort:true},
    {publishedAt:"2027-01-01T00:00:00Z"},
    {url:"https://www.youtube.com/watch?v=12345678901"},
  ]) assert.throws(()=>parseManualCaptionReceipt({...fixture(),...patch},now,{}));
});
function request(receipt: unknown) {
  return new Request("https://example.com/api/video-intake",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({manualReceipt:receipt})});
}
test("unauthorised manual caption request never reaches persistence",async()=>{
  let calls=0;
  const resp=await handleVideoIntakeRequest(request(fixture()),undefined,{authenticate:()=>false,admitManualReceipt:async()=>{calls++;throw Error("unexpected");}});
  assert.equal(resp.status,401);assert.equal(calls,0);
});
test("authenticated manual receipt uses existing handler with no provider or discovery call",async()=>{
  let calls=0;
  const resp=await handleVideoIntakeRequest(request(fixture()),undefined,{
    authenticate:()=>true,now:()=>now,
    runScheduled:async()=>{throw Error("unexpected discovery");},
    admitManualReceipt:async r=>{calls++;assert.equal(r.videoId,"abcdefghijk");return {status:"queued_review",itemId:"item",runId:"run",videoId:r.videoId,transcriptStatus:"ready",reviewStatus:"transcript_only",jobStatus:"pending",evidenceId:null};},
  });
  assert.equal(resp.status,202);assert.equal(calls,1);const body=await resp.json();assert.equal(body.jobStatus,"pending");assert.equal(body.evidenceId,null);assert.equal("transcriptText" in body,false);
});
test("invalid receipt returns 422 without a provider or persistence call",async()=>{
  const resp=await handleVideoIntakeRequest(request({...fixture(),sourceKind:"summary_only"}),undefined,{authenticate:()=>true,now:()=>now,admitManualReceipt:async()=>{throw Error("unexpected write");}});
  assert.equal(resp.status,422);
});
