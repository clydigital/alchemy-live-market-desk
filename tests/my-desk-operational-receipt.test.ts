import test from "node:test";
import assert from "node:assert/strict";
import {lane} from "../lib/my-desk-health-core.ts";
import {parseOperationalReceipt,parseOperationalBlocks,applyOperationalReceipt} from "../lib/my-desk-operational-receipt.ts";
const now=new Date("2026-11-26T05:30:00Z");
const raw={version:"md4-work-health/1",lane:"macropulse",runId:"fixture",attemptAt:"2026-11-26T04:01:00Z",completedAt:"2026-11-26T04:02:00Z",scheduledAt:"2026-11-26T04:00:00Z",nextScheduledAt:"2026-11-26T14:00:00+08:00",execution:"completed",coverage:"none",delivery:"failed",cause:"service_unavailable",fallback:"not_attempted",budget:"unknown",origin:"scheduler_readback"};
const block=(r:unknown)=>({type:"code",code:{language:"json",rich_text:[{plain_text:JSON.stringify(r)}]}});
test("successful scheduler exit can carry failed delivery without replacing the last successful Log",()=>{
 const r=parseOperationalReceipt(raw,now)!;assert.ok(r);
 const base=lane("MacroPulse",{success:"2026-11-25T22:48:00Z",fresh:true});
 const projected=applyOperationalReceipt(base,r,now);
 assert.equal(projected.state,"failed");assert.equal(projected.success,base.success);assert.equal(projected.attempt,raw.attemptAt);
 assert.match(projected.execution,/completed · delivery failed/);assert.equal(projected.failure,"Service unavailable");assert.equal(projected.backup,"Not attempted");
 assert.match(projected.gaps,/not guaranteed retry/);assert.equal(projected.retry,null);
});
test("partial and stale task receipts never turn a lane green",()=>{
 const base=lane("AI16",{success:"2026-11-26T00:03:00Z",fresh:true,coverageComplete:true});
 const partial=parseOperationalReceipt({...raw,lane:"ai16",coverage:"partial",delivery:"saved",cause:"source_gap"},now)!;
 assert.equal(applyOperationalReceipt(base,partial,now).state,"degraded");
 const stale=parseOperationalReceipt({...raw,coverage:"complete",delivery:"reported_verified",nextScheduledAt:"2026-11-26T04:10:00Z"},now)!;
 assert.equal(applyOperationalReceipt(base,stale,now).state,"degraded");
 assert.match(applyOperationalReceipt(base,stale,now).gaps,/newer receipt absent/);
});
test("task self-report cannot pretend to be scheduler readback; unknown/invalid and duplicate lane receipts rejected",()=>{
 assert.equal(parseOperationalReceipt({...raw,origin:"task_reported"},now),null);
 assert.equal(parseOperationalReceipt({...raw,attemptAt:"2026-11-27T00:00:00Z"},now),null);
 assert.equal(parseOperationalReceipt({...raw,cause:"raw token or error"},now),null);
 assert.equal(parseOperationalReceipt({...raw,completedAt:null},now),null);
 assert.deepEqual(parseOperationalBlocks({results:[block(raw),block(raw)]},now),{});
 assert.equal(parseOperationalBlocks({results:[block(raw)]},now).macropulse?.delivery,"failed");
});
test("provider recovery is reported separately, not inferred as complete coverage",()=>{
 const r=parseOperationalReceipt({...raw,origin:"task_reported",execution:"reported_finished",coverage:"partial",delivery:"saved",fallback:"partial_recovery",budget:"exhausted"},now)!;
 const base=lane("Creator",{attempt:"2026-11-26T05:00:00Z",coverage:"private review pending canonical intake",success:null});
 const p=applyOperationalReceipt(base,r,now);assert.equal(p.state,"degraded");assert.equal(p.backup,"Partial recovery reported");assert.match(p.budget,/Allowance exhausted/);assert.match(p.gaps,/Underlying source\/Run attempt/);
});
