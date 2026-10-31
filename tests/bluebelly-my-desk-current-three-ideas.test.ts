import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectReportLedTopicIdeas,postCutoverDailyArchive,MY_DESK_ARCHIVE_CUTOVER}
 from "../lib/bluebelly-my-desk-suggestions.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const intro="The original-source document shows stronger revenue but also a widening gap between capital expenditures and near-term cash generation. ";
function section(id:string,title:string,text:string,url:string){
 return '<section class="report-section" id="'+id+'"><h2>'+title+'</h2>'+
 '<p>'+text+intro+intro+'</p>'+
 '<p>However, another interpretation is possible: valuations may have changed independently of the underlying profits. '+intro+'</p>'+
 '<p>The next test is the upcoming company guidance and independently verified market reaction. '+intro+'</p>'+
 '<a href="'+url+'">Original issuer source</a></section>';
}
const report='<!DOCTYPE html><html><head><title>Private</title></head><body><main>'+
 section("verdict","The five-minute read",intro,"https://a.example/original")+
 section("issuers","Strong growth, very different cash economics",intro,"https://issuer.example/financials")+
 section("chips","Intel and Sandisk: what did the price already demand?",intro,"https://chips.example/filing")+
 section("fed","The Fed held. The equity market still looked uncomfortable",intro,"https://federalreserve.gov/newsevents/pressreleases")+
 section("oil","Oil was rising while technology was being sold",intro,"https://energy.gov/inventory")+
 "</main></body></html>";
const news:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",verification:"SOURCE_VERIFIED",
 id:"news-1",headline:"Brent shipping spreads widened after the latest supply event",
 summary:"An original official source described a change in port operations, but no price causation was established.",
 sourceName:"Official authority",sourceUrl:"https://example.org/official-event",
 sourceKind:"official",occurredAt:"2026-10-31T03:00:00Z",observedAt:"2026-10-31T04:00:00Z",
};

test("the current report, not a stale editorial slate, determines three differentiated topic cards",()=>{
 const ideas=projectReportLedTopicIdeas(report,[]);
 assert.equal(ideas.length,3);
 assert.deepEqual(ideas.map(x=>x.rank),[1,2,3]);
 assert.deepEqual(ideas.map(x=>x.theme),["AI & cash flow","Semiconductors","Rates & policy"]);
 assert.ok(ideas.every(x=>x.provenance==="DAILY_REPORT"));
 assert.ok(ideas.every(x=>x.thesis.length>100&&x.antithesis.includes("However")));
 assert.equal(ideas[0].sourceUrls[0],"https://issuer.example/financials");
 assert.equal(ideas[1].reportSection,"chips");
 assert.ok(ideas[2].technicalCheck.includes("2Y/10Y/30Y"));
});
test("changing the report immediately changes the shortlist; old ideas are not archived",()=>{
 const alternate='<!DOCTYPE html><html><body>'+intro.repeat(11)+
  section("energy","Brent and oil supply face a policy shock",intro,"https://energy.gov/update")+
  "</body></html>";
 const ideas=projectReportLedTopicIdeas(alternate,[news]);
 assert.equal(ideas[0].theme,"Energy");
 assert.equal(ideas[0].title,"Brent and oil supply face a policy shock");
 assert.equal(ideas[1].provenance,"RESEARCH_GAP");
 assert.ok(ideas.every(x=>!x.title.includes("Intel")));
});
test("verified Newsroom items supplement only if the Daily Report leaves a distinct gap",()=>{
 const shortReport='<!DOCTYPE html><html><body>'+intro.repeat(11)+
  section("chips","Intel earnings and semiconductor repricing",intro,"https://chips.example/earnings")+
  "</body></html>";
 const ideas=projectReportLedTopicIdeas(shortReport,[news]);
 assert.equal(ideas[0].provenance,"DAILY_REPORT");
 assert.equal(ideas[1].provenance,"NEWSROOM_SUPPLEMENT");
 assert.equal(ideas[1].sourceUrls[0],news.sourceUrl);
 assert.equal(ideas[2].provenance,"RESEARCH_GAP");
});
test("reject non-HTTPS links and never convert a research gap into market facts",()=>{
 const unsafe=report.replace("https://issuer.example/financials","javascript:alert(1)");
 const ideas=projectReportLedTopicIdeas(unsafe,[]);
 assert.deepEqual(ideas[0].sourceUrls,[]);
 const empty=projectReportLedTopicIdeas(null,[]);
 assert.equal(empty.length,3);
 assert.ok(empty.every(x=>x.provenance==="RESEARCH_GAP"&&x.sourceUrls.length===0));
});
test("only post-cutover Daily Report editions qualify for the new visible history",()=>{
 const editions=[{createdAt:"2026-10-31T08:57:30Z",type:"DAILY"},
  {createdAt:"2026-10-31T09:11:09Z",type:"DAILY"},
  {createdAt:"2026-10-31T09:11:11Z",type:"DAILY"}];
 assert.equal(MY_DESK_ARCHIVE_CUTOVER,"2026-10-31T09:11:10.000Z");
 assert.deepEqual(postCutoverDailyArchive(editions),[editions[2]]);
});
test("My Desk no longer displays the former Drive, PDF or saved slate archives",()=>{
 const page=read("app/my-reports/page.tsx");
 const reader=read("components/blue-desk/OwnerDailyIntelligenceHome.tsx");
 const newComponent=read("components/blue-desk/OwnerDailyTopicIdeas.tsx");
 const server=read("lib/bluebelly-owner-report-led-ideas.ts");
 assert.match(page,/OwnerDailyTopicIdeas/);
 assert.doesNotMatch(page,/OwnerEditorialSlatePdfReader|OwnerEditorialSlateHtml|DRIVE_FOLDER|EDITIONS|OwnerAutomaticReportReader|getPrivateHtmlEditions/);
 assert.match(reader,/postCutoverDailyArchive/);
 assert.doesNotMatch(reader,/Previous Daily Intelligence editions/);
 assert.match(newComponent,/Thesis \/ evidence:/);
 assert.match(newComponent,/Antithesis:/);
 assert.match(newComponent,/What to look for:/);
 assert.match(newComponent,/\/blue-desk\/newsroom/);
 assert.match(server,/app_access_allowlist/);
 assert.match(server,/html_sha256===latest\.htmlSha256/);
 assert.match(server,/digest\(bytes\)===latest\.htmlSha256/);
 assert.match(server,/eq\("owner_user_id",user\.id\)/);
});
