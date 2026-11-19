import assert from "node:assert/strict";
import test from "node:test";
import { reportedEditorialById } from "../lib/bluebelly-reported-editorial.ts";
import { getRecentVerifiedEarningsScorecards } from "../lib/blue-desk-earnings-results.ts";
import { getManualSweeps } from "../lib/bluebelly-manual-sweeps.ts";
import { projectMajorIpoWatch } from "../lib/bluebelly-major-ipo-watch.ts";

const now=new Date("2026-11-19T21:00:00Z");
const before=new Date("2026-11-19T18:23:00Z");
test("19 Nov reviewed reports are dated, source-linked, not live quotes or completed financing",()=>{
 const ipo=reportedEditorialById("anthropic-ipo-pricing-debut-2026-11-19",now)!;
 assert.match(ipo.reporting,/not net cash received/);
 assert.match(ipo.reporting,/13:04 ET/);
 assert.match(ipo.sourceUrl,/sec\.gov/);
 assert.match(ipo.verificationLabel!,/REPORTED INTRADAY/);
 const housing=reportedEditorialById("freddie-mac-mortgage-rate-2026-11-19",now)!;
 assert.match(housing.reporting,/7\.28%/);
 assert.match(housing.reporting,/17 basis points/);
 assert.equal(reportedEditorialById(ipo.id,before),null);
 assert.equal(reportedEditorialById(housing.id,before),null);
});
test("PANW and WMT source-qualified results do not invent missing metrics or consensus",()=>{
 const cards=getRecentVerifiedEarningsScorecards(now,7);
 const wmt=cards.find(c=>c.ticker==="WMT")!;
 const panw=cards.find(c=>c.ticker==="PANW")!;
 assert.equal(wmt.beatSource,"company_guidance");
 assert.equal(panw.beatSource,"unavailable");
 assert.equal(panw.metrics[3].state,"not_verified");
 assert.equal(wmt.metrics[2].value,null);
 assert.equal(getRecentVerifiedEarningsScorecards(before,7).some(c=>c.id===wmt.id),false);
});
test("AMD lead remains unverified; revised IPO and housing findings corroborated",()=>{
 const ai=getManualSweeps("ai",now);
 assert.equal(ai[0].findings[0].status,"RESEARCH_LEAD");
 assert.match(ai[0].findings[0].reason,/could not independently verify/);
 assert.equal(ai[1].findings[0].status,"SOURCE_CORROBORATED");
 assert.equal(getManualSweeps("housing",now)[0].findings[0].status,"SOURCE_CORROBORATED");
});
test("historical IPO watch no longer displays a proposed ticker after reviewed debut",()=>{
 const ipo=projectMajorIpoWatch({now})[0];
 assert.equal(ipo.title,"Anthropic · ANT");
 assert.equal(ipo.date,null);
 assert.equal(ipo.ticker,null);
 assert.equal(ipo.signalOnly,true);
 assert.match(projectMajorIpoWatch({now:before})[0].title,/proposed/);
});
