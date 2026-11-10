import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {powerStackResearchTopics,projectPowerStackResearch,powerStackResearchHref,
 type PowerStackTracked} from "../lib/power-stack-research-links.ts";
import type {TopicInfluenceRead,InfluenceTopic,InfluenceLead} from "../lib/bluebelly-topic-influence.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const now=new Date("2026-11-11T01:00:00Z");
const holding=(ticker:string):PowerStackTracked=>({ticker,name:ticker,scope:"archived_holding"});
const watch=(ticker:string):PowerStackTracked=>({ticker,name:ticker,scope:"archived_watchlist"});
const bond=(ticker:string):PowerStackTracked=>({ticker,name:ticker,scope:"bond_watch"});
const lead=(id:string,source:"X"|"CREATOR"="X"):InfluenceLead=>({
 id,source,sourceName:source==="X"?"@KobeissiLetter":"TraderNick",
 url:source==="X"?"https://x.com/KobeissiLetter/status/2120147133542125818":
 "https://www.youtube.com/watch?v=-_AFTV4xQOo",
 title:"Original public link",reason:"Is inflation broadening or easing?",
 excerpt:"Unverified commentary",publishedAt:"2026-11-10T13:30:41Z",
 reviewedAt:"2026-11-10T14:00:00Z",nextCheck:"Check official releases",
 verification:"UNVERIFIED_LEAD",
});
const topic=(name:InfluenceTopic):TopicInfluenceRead=>({
 topic:name,checkedAt:now.toISOString(),xState:"AVAILABLE",creatorState:"AVAILABLE",
 x:[lead("x:test-"+name)],creators:[lead("video:test-"+name,"CREATOR")],
});
test("actual tracked ticker groups require explicit mappings, not name/word guesses",()=>{
 const assets=[holding("XOM"),watch("MU"),watch("GLDM"),bond("TLT"),watch("9988.HK")];
 const topics=powerStackResearchTopics(assets);
 for(const expected of ["bonds","ai","hormuz","gold","china","fed","breadth"]){
  assert.ok(topics.some(topic=>topic===expected),expected);
 }
 assert.equal(powerStackResearchTopics([holding("BWXT"),watch("SMR")]).includes("hormuz"),false);
 assert.equal(powerStackResearchTopics([holding("BWXT"),watch("SMR")]).includes("ai"),false);
 assert.deepEqual(powerStackResearchTopics([]),[]);
});
test("the 10 Nov source-linked manual ledger and fresh leads join Power Stack without scoring",()=>{
 const rows=[holding("XOM"),watch("MU"),watch("GLDM"),bond("TLT"),watch("9988.HK")];
 const group=projectPowerStackResearch(rows,powerStackResearchTopics(rows).map(topic),now);
 const by=new Map(group.map(item=>[item.topic,item]));
 assert.equal(by.get("bonds")?.assets[0]?.ticker,"TLT");
 assert.equal(by.get("ai")?.assets[0]?.ticker,"MU");
 assert.equal(by.get("hormuz")?.assets[0]?.ticker,"XOM");
 assert.equal(by.get("gold")?.assets[0]?.ticker,"GLDM");
 assert.equal(by.get("china")?.assets[0]?.ticker,"9988.HK");
 assert.equal(by.get("fed")?.channel,"PORTFOLIO-WIDE");
 assert.equal(by.get("fed")?.assets.length,0);
 assert.equal(by.get("breadth")?.assets.length,0);
 assert.equal(by.get("fed")?.manual?.date,"2026-11-10");
 assert.equal(by.get("bonds")?.manual?.date,"2026-11-10");
 assert.ok(by.get("hormuz")?.findings.some(f=>f.sourceUrl.startsWith("https://")));
 assert.equal(by.get("bonds")?.leads.length,2);
 assert.equal(by.get("hormuz")?.leads.length,2);
 assert.equal(powerStackResearchHref("hormuz"),"/hormuz#influence-hormuz");
 assert.equal(powerStackResearchHref("bonds"),"/regime-watch/bonds#influence-bonds");
});
test("scope is owner-recorded, historic holding wins over duplicate saved idea",()=>{
 const rows=[bond("TLT"),watch("TLT"),holding("TLT"),watch("MU"),holding("MU")];
 const group=projectPowerStackResearch(rows,powerStackResearchTopics(rows).map(topic),now);
 assert.equal(group.find(g=>g.topic==="bonds")?.assets.length,1);
 assert.equal(group.find(g=>g.topic==="bonds")?.assets[0]?.scope,"archived_holding");
 assert.equal(group.find(g=>g.topic==="ai")?.assets[0]?.scope,"archived_holding");
 assert.ok(!group.some(g=>g.topic==="china"));
});
test("private panel does not publish unreviewed transcripts or make issuer-level recommendations",()=>{
 const page=read("app/power-stack/page.tsx");
 const panel=read("components/blue-desk/PowerStackResearchImpact.tsx");
 const projector=read("lib/power-stack-research-links.ts");
 const source=read("lib/bluebelly-topic-influence-server.ts");
 assert.match(page,/PowerStackResearchImpact groups={researchGroups}/);
 assert.match(page,/getTopicInfluences\(researchTopics,researchedAt\)/);
 assert.match(page,/const researchAssets:PowerStackTracked\[\]=ready\?/);
 assert.ok(page.indexOf("auth.getUser()")<page.indexOf("getTopicInfluences(researchTopics,researchedAt)"));
 assert.ok(page.indexOf("app_access_allowlist")<page.indexOf("getTopicInfluences(researchTopics,researchedAt)"));
 assert.ok(page.indexOf("legacy_source_retired === true")<page.indexOf("getTopicInfluences(researchTopics,researchedAt)"));
 assert.match(panel,/data-power-stack-research-impact="owner-sourced-not-canonical"/);
 assert.match(panel,/AUTOMATIC \/ UNVERIFIED SOURCE LEADS/);
 assert.match(panel,/MANUAL SWEEP FINDINGS/);
 assert.match(panel,/sourceUrl/);
 assert.match(panel,/sourceDate\(lead.publishedAt\)/);
 assert.doesNotMatch(projector+panel,/transcript_text|recontextualized_summary|claim_checks|\.insert\(|\.update\(|\.upsert\(/);
 assert.match(source,/\.eq\("video_review_status","reviewed"\)/);
});
test("unavailable source reads never create a fake verified finding",()=>{
 const rows=[holding("MU")];
 const reads:TopicInfluenceRead[]=powerStackResearchTopics(rows).map(topic=>({
  topic,checkedAt:now.toISOString(),xState:"UNAVAILABLE",creatorState:"UNAVAILABLE",x:[],creators:[],
 }));
 const groups=projectPowerStackResearch(rows,reads,now);
 assert.ok(groups.every(g=>!g.leads.length));
 assert.ok(groups.every(g=>g.manual===null||g.manual.findings.every(f=>f.sourceUrl.startsWith("https://"))));
 assert.deepEqual(projectPowerStackResearch([],reads,now),[]);
});
