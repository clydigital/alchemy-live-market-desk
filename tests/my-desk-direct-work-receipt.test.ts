import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {DIRECT_WORK_TITLES,parseDirectWorkReceipt,pickDirectWorkReceipt,projectDirectWorkReceipt,type DirectWorkRow} from "../lib/my-desk-direct-work-receipt.ts";
const now=new Date("2026-11-26T21:00:00Z");
const receipt={version:"md4-work-health/1",lane:"macropulse",scheduledAt:"2026-11-26T20:00:00Z",attemptAt:"2026-11-26T20:01:00Z",completedAt:"2026-11-26T20:02:00Z",nextScheduledAt:"2026-11-26T22:00:00Z",execution:"completed",coverage:"partial",delivery:"not_attempted",cause:"handoff_failure",fallback:"unknown",budget:"unknown",origin:"scheduler_readback"};
function row(r:Record<string,unknown>=receipt,patch:Partial<DirectWorkRow>={}):DirectWorkRow{
 const html_content='<!doctype html><html><head><title>Private research report</title></head><body><h1>Private research report</h1><p>'+"Source-labelled research. ".repeat(70)+'</p><pre id="work-operational-receipt-v1">'+JSON.stringify(r)+'</pre></body></html>';
 return {title:DIRECT_WORK_TITLES.macropulse,report_day:"2026-11-27",created_at:"2026-11-26T20:36:00Z",html_content,html_sha256:createHash("sha256").update(html_content).digest("hex"),...patch};
}
test("direct immutable edition preserves autonomous failure rather than treating manual save as success",()=>{
 const p=parseDirectWorkReceipt(row(),now);assert.ok(p);
 const l=projectDirectWorkReceipt("MacroPulse",p,now);
 assert.equal(l.state,"degraded");assert.equal(l.success,"2026-11-26T20:36:00Z");assert.equal(l.attempt,receipt.attemptAt);
 assert.match(l.execution,/delivery not_attempted/);assert.match(l.execution,/Direct private Supabase/);assert.equal(l.coverageComplete,false);
});
test("reject wrong lane, corrupt hash, wrong date, future storage and impossible clocks",()=>{
 for(const item of [row(receipt,{title:DIRECT_WORK_TITLES.ai16}),row(receipt,{html_sha256:"0".repeat(64)}),row(receipt,{report_day:"2026-11-26"}),row(receipt,{created_at:"2026-11-27T01:00:00Z"}),row({...receipt,completedAt:"2026-11-26T20:50:00Z"})])assert.equal(parseDirectWorkReceipt(item,now),null);
});
test("select by actual attempt, not later archive time",()=>{
 const old=row({...receipt,attemptAt:"2026-11-26T19:59:00Z",scheduledAt:"2026-11-26T19:58:00Z"},{created_at:"2026-11-26T20:50:00Z"});
 assert.equal(pickDirectWorkReceipt([old,row()],"macropulse",now)?.receipt.attemptAt,receipt.attemptAt);
 assert.equal(pickDirectWorkReceipt([row()],"ai16",now),null);
});
