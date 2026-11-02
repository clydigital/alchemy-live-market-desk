import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isFreshPrivateMorningReceipt,selectPrivateDailyArchive}
 from "../lib/bluebelly-private-report-freshness.ts";

const now=new Date("2026-11-02T03:35:00Z");
const W=(id:string,created_at:string,delivery_type:"CHATGPT_WORK"|"SCHEDULED_RESEARCH")=>
 ({id,created_at,delivery_type});

test("A Friday Work edition with the correct Friday US session is stale on Monday morning",()=>{
 const result=selectPrivateDailyArchive(
  [W("old-fri","2026-10-31T09:11:09Z","CHATGPT_WORK")],[],now);
 assert.equal(result.action,"generate");
 assert.match(result.reason,/older_same_session/);
});
test("A fresh same-session Work edition outranks fallback; newest first",()=>{
 const result=selectPrivateDailyArchive([
  W("fallback","2026-11-02T03:30:00Z","SCHEDULED_RESEARCH"),
  W("old","2026-10-31T09:11:00Z","CHATGPT_WORK"),
  W("fresh","2026-11-02T02:35:00Z","CHATGPT_WORK"),
 ],[],now);
 assert.deepEqual(result,{action:"reuse_complete",id:"fresh",reason:"fresh_work_edition"});
});
test("Fresh owner revisions are complete and older fallback remains correctly labelled",()=>{
 assert.equal(selectPrivateDailyArchive([],[{id:"owner",created_at:"2026-11-02T01:02:00Z"}],now).action,"reuse_complete");
 const fresh=selectPrivateDailyArchive([W("fallback","2026-11-02T03:30:00Z","SCHEDULED_RESEARCH")],[],now);
 assert.equal(fresh.action,"reuse_fallback");
 const stale=selectPrivateDailyArchive([W("old","2026-10-31T03:30:00Z","SCHEDULED_RESEARCH")],[],now);
 assert.equal(stale.action,"stale_fallback");
 assert.match(stale.reason,/full_work_update_needed/);
});
test("Future timestamps, malformed dates and off-window readback do not masquerade as fresh",()=>{
 for(const s of ["garbage","2026-11-02T04:00:00Z","2026-11-01T18:00:00Z"])
  assert.equal(isFreshPrivateMorningReceipt(s,now),false,s);
 assert.equal(isFreshPrivateMorningReceipt("2026-11-02T03:30:00Z",now),true);
 assert.equal(isFreshPrivateMorningReceipt("2026-11-02T03:36:30Z",now),true,
  "small clock skew allowed");
});
test("Production fallback routes keep auth, original source gate and session correctness",()=>{
 const s=readFileSync(new URL("../lib/bluebelly-scheduled-daily-html-job.ts",import.meta.url),"utf8");
 assert.match(s,/selectPrivateDailyArchive\(work\.data\|\|\[\],owner\.data\|\|\[\],now\)/);
 assert.match(s,/private_daily_html_stale/);
 assert.match(s,/acceptsResearchAuthorization/);
 assert.match(s,/reportEvidenceReady\(evidence\)/);
 assert.match(s,/expectedCompletedUsWeekdaySessionDay/);
 assert.doesNotMatch(s,/\.update\(\{owner_user_id/);
});
