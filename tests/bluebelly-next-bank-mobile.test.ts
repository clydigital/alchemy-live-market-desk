import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sourceScheduledBankWatch} from "../lib/bluebelly-next-bank-catalysts.ts";
const text=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("ECB exact CET clock and BoJ date-only source clock both appear before their decisions",()=>{
 const rows=sourceScheduledBankWatch(new Date("2026-10-28T20:24:00Z"));
 assert.deepEqual(rows.map(x=>x.id),["ecb-2026-10-29","boj-2026-10-30"]);
 const ecb=rows[0],boj=rows[1];
 assert.equal(ecb.scheduledAt,"2026-10-29T13:15:00.000Z");
 assert.match(ecb.timeBasis,/14:15 CET/);
 assert.match(ecb.sourceUrl,/ecb\.europa\.eu/);
 assert.equal(ecb.phase,"SCHEDULED");
 assert.equal(boj.scheduledAt,null);
 assert.match(boj.timeBasis,/exact publication time undecided/);
 assert.match(boj.sourceUrl,/boj\.or\.jp/);
 assert.equal(boj.phase,"DATE ONLY · SCHEDULED");
});
test("an elapsed ECB release cannot be presented as upcoming with a known result",()=>{
 const rows=sourceScheduledBankWatch(new Date("2026-10-29T14:00:00Z"));
 const ecb=rows.find(x=>x.id==="ecb-2026-10-29");
 assert.equal(ecb?.phase,"PUBLICATION DUE · OUTCOME UNVERIFIED");
 assert.equal(sourceScheduledBankWatch(new Date("2026-11-02T04:00:00Z")).length,0);
});
test("site contains separate source-scheduled policy lane and fast-scanning mobile previews",()=>{
 const page=text("app/blue-desk/newsroom/page.tsx");
 const component=text("components/blue-desk/NextBankCatalysts.tsx");
 const css=text("components/blue-desk/Newsroom48hTimeline.module.css");
 assert.match(page,/<NextBankCatalysts items=\{nextBanks\}/);
 assert.match(page,/sourceScheduledBankWatch\(now\)/);
 assert.match(component,/data-bank-preview="official-schedule-not-released"/);
 assert.match(component,/Current decision outcome, consensus surprise and price impact are not verified/);
 assert.match(component,/How I'd prepare to explain it/);
 assert.match(css,/-webkit-line-clamp:3/);
 assert.match(css,/-webkit-line-clamp:2/);
 assert.doesNotMatch(component,/fetch\(|createSupabaseAdminClient|service_role|story_thesis_versions/);
});
