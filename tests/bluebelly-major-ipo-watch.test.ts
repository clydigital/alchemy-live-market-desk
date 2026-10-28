import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { projectMajorIpoWatch } from "../lib/bluebelly-major-ipo-watch.ts";
import { loadMajorIpoWatch } from "../lib/bluebelly-major-ipo-watch-server.ts";

const now=new Date("2026-10-28T12:00:00.000Z");
const access="0001628280-26-067168";
const idx="https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/"+access+"-index.html";
const api="https://data.sec.gov/submissions/CIK0002130357.json";
const ua="Bluebelly IPO checks desk@example.org";
const payload={
 cik:2130357,name:"Anthropic, PBC",
 filings:{recent:{accessionNumber:[access],filingDate:["2026-10-26"],form:["S-1"],
  reportDate:[""],acceptanceDateTime:["20261026090011"],primaryDocument:["anthropicpbc-sx1.htm"],items:[""]}},
};
function mock({record=payload,body="<html>Filing Date 2026-10-26 SEC Accession No. "+access+" Form S-1</html>",
  submissionsOk=true,indexOk=true}:{record?:unknown;body?:string;submissionsOk?:boolean;indexOk?:boolean}={}){
 const visited:string[]=[];
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  const url=String(target);visited.push(url);
  if(url===api)return submissionsOk?Response.json(record):new Response("Unavailable",{status:403});
  if(url===idx)return indexOk?new Response(body,{headers:{"content-type":"text/html"}}):new Response("Unavailable",{status:403});
  return new Response("Invalid",{status:404});
 }) as typeof fetch;
 return {fetchImpl,visited};
}
test("IPO entries are source-linked monitoring, never invented trading dates",()=>{
 const out=projectMajorIpoWatch({now});
 assert.deepEqual(out.map(c=>c.id),["ipo:anthropic","ipo:openai","ipo:databricks"]);
 assert.ok(out.every(c=>c.lane==="ipo"&&c.date===null&&c.startAt===null&&c.timePrecision==="tbc"&&c.signalOnly));
 assert.ok(out.every(c=>c.status.includes("IPO date not confirmed")));
 assert.equal(out[0].certainty,"official");
 assert.equal(out[0].priority,"must_watch");
 assert.match(out[0].status,/2026-10-26/);
 assert.match(out[0].title,/ANT \(proposed\)/);
 assert.match(out[1].status,/Confidential draft S-1 announced/);
 assert.equal(out[2].certainty,"reported");
 assert.deepEqual(projectMajorIpoWatch({now:new Date("2026-10-27T17:00:00Z")}).map(c=>c.id),
  ["ipo:anthropic","ipo:openai","ipo:databricks"],
  "MYT 28 Oct falls on UTC 27 Oct: the review card must already be present");
 assert.ok(!out[0].ticker,"Proposed ANT must not be presented as actively tradeable");
});
test("SEC index and submission verify latest Anthropic public filing as a historical milestone",async()=>{
 const source=mock();
 const output=await loadMajorIpoWatch({now,fetchImpl:source.fetchImpl,userAgent:ua});
 assert.equal(output.coverage.state,"checked");
 assert.equal(output.cards[0].sourceUrl,idx);
 assert.match(output.cards[0].status,/Public S-1 filed · 2026-10-26/);
 assert.equal(output.cards[0].date,null);
 assert.deepEqual(source.visited,[api,idx]);
});
test("SEC API errors, invalid identity or index mismatch fail back to a dated official source",async()=>{
 for(const input of [{submissionsOk:false},{record:{...payload,cik:999999}},
 {record:{...payload,name:"Other Company"}},{indexOk:false},{body:"another registrant"}]){
  const source=mock(input);
  const output=await loadMajorIpoWatch({now,fetchImpl:source.fetchImpl,userAgent:ua});
  assert.equal(output.coverage.state,"unavailable");
  assert.match(output.cards[0].sourceUrl,/www\.sec\.gov/);
  assert.equal(output.cards[0].date,null);
 }
 const empty=await loadMajorIpoWatch({now,userAgent:"",fetchImpl:mock().fetchImpl});
 assert.equal(empty.coverage.state,"not_configured");
});
test("amendments may update the filing milestone but never create a listing date",()=>{
 const rows=projectMajorIpoWatch({now,anthropicFiling:{form:"S-1/A",filedOn:"2026-10-27",
  sourceUrl:"https://www.sec.gov/Archives/edgar/data/2130357/000162828026067169/0001628280-26-067169-index.html"}});
 assert.match(rows[0].status,/S-1 amendment filed · 2026-10-27/);
 assert.equal(rows[0].date,null);
 const invalid=projectMajorIpoWatch({now,anthropicFiling:{form:"S-1/A",filedOn:"2026-11-10",
  sourceUrl:"https://not-sec.example.net/Archives/edgar/data/2130357/000162828026067169/0001628280-26-067169-index.html"}});
 assert.match(invalid[0].status,/Public S-1 filed · 2026-10-26/);
});
test("calendar has an independent IPO filter, dated milestones remain off week tiles",()=>{
 const calendar=readFileSync(new URL("../app/blue-desk/calendar/page.tsx",import.meta.url),"utf8");
 const radar=readFileSync(new URL("../components/blue-desk/CatalystCalendar.tsx",import.meta.url),"utf8");
 const model=readFileSync(new URL("../lib/bluebelly-catalyst-calendar.ts",import.meta.url),"utf8");
 assert.match(calendar,/loadMajorIpoWatch\(\{ now \}\)/);
 assert.match(calendar,/sourceCoverage = \[\.\.\.radar\.coverage, ipos\.coverage\]/);
 assert.match(radar,/data-major-ipo-watch="source-qualified"/);
 assert.match(radar,/\{id:"ipo",label:"Major IPOs"\}/);
 assert.match(radar,/item\.signalOnly && item\.lane!=="ipo"/);
 assert.match(model,/"ipo", "other"/);
});
