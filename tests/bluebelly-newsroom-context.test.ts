import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {newsroomContext,TOPIC_RESEARCH} from "../lib/bluebelly-newsroom-context.ts";
import {EDITORIAL_REGIME_LENSES} from "../lib/bluebelly-editorial-architecture.ts";
import {getManualSweeps} from "../lib/bluebelly-manual-sweeps.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("context introduces the actual commercial players and links existing research questions",()=>{
 const fermi=newsroomContext("fermi-hyperscaler-600mw-sec-2026-11-12")!;
 assert.match(fermi.players,/unnamed hyperscaler/);
 assert.match(fermi.players,/not company confirmation/);
 assert.ok(fermi.research.some(x=>x.lens==="ai"));
 for(const ids of Object.values(TOPIC_RESEARCH))for(const id of ids)assert.ok(EDITORIAL_REGIME_LENSES.some(l=>l.id===id));
 assert.equal(newsroomContext("unknown"),null);
 assert.equal(newsroomContext("constructor"),null);
});
test("manual sweep context is additive and retains its evidence boundary",()=>{
 const rows=getManualSweeps("ai",new Date("2026-11-24T10:30:00Z"),6);
 const amd=rows.find(r=>r.id==="2026-11-20-ai-amd-reported-scrutiny-lead")?.findings[0];
 assert.equal(amd?.status,"RESEARCH_LEAD");
 assert.match(amd?.marketContext??"",/do not establish/);
 assert.ok(amd?.researchQuestion);
 const page=read("app/blue-desk/newsroom/page.tsx");
 assert.match(page,/best.marketContext/);assert.match(page,/best.researchQuestion/);
});
test("unrelated articles cannot inherit Binance or acquisition-specific labels",()=>{
 const reader=read("components/blue-desk/NewsroomEventReader.tsx");
 assert.match(reader,/cryptoIncident=story\?\.id==="binance-security-incident-2026-10-30"/);
 assert.match(reader,/dealTalks=story\?\.id==="tpg-ark-talks-2026-10-28"/);
 assert.match(reader,/data-newsroom-research-connection="existing-lens"/);
 assert.match(read("components/blue-desk/VerifiedCatalystArticle.tsx"),/data-newsroom-research-connection="topic-navigation"/);
});
