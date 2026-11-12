import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getManualSweeps} from "../lib/bluebelly-manual-sweeps.ts";
const read=(s:string)=>readFileSync(new URL("../"+s,import.meta.url),"utf8");

test("Newsroom exposes committed manual sweep checks as a separately labelled public evidence lane",()=>{
 const page=read("app/blue-desk/newsroom/page.tsx");
 assert.match(page,/data-newsroom-manual-sweeps="editor-committed-source-labelled"/);
 assert.match(page,/getManualSweeps\(topic,now,2\)/);
 assert.match(page,/sweep\.findings\.find\(f=>f\.status==="SOURCE_CORROBORATED"\)/);
 assert.match(page,/best\.status\.replaceAll\("_"," "\)/);
 assert.match(page,/An attributed lead is still a lead/);
 assert.match(page,/href="#newsroom-manual-sweeps"/);
 assert.ok(page.indexOf('<BluebellyNewsWire ')<page.indexOf('id="newsroom-manual-sweeps"'),"Verified wire must remain above manual research");
 assert.doesNotMatch(page,/createSupabaseAdminClient/);
 const css=read("app/blue-desk/newsroom/newsroom.module.css");
 assert.match(css,/@media\(max-width:580px\)/);
 assert.match(css,/\.manualGrid/);
});

test("manual public source notes remain exact editor-committed source checks",()=>{
 const energy=getManualSweeps("energy",new Date("2026-11-12T14:00:00Z"),1);
 assert.ok(energy.length>=1);
 assert.equal(energy[0].topic,"energy");
 assert.ok(energy[0].findings.some(f=>f.status==="SOURCE_CORROBORATED"));
});
