import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyOfficialPressNewsIntake, OFFICIAL_PRESS_FEEDS, materiallyActionableOfficialHeadline } from "../lib/official-press-news-intake.ts";
import type { ResearchRunInput } from "../lib/research-update.ts";
import { buildMarketMotionCandidates } from "../lib/market-motion-ingestion.ts";

const now = new Date("2026-10-22T00:00:00.000Z");
function input(items: ResearchRunInput["items"] = []): ResearchRunInput {
  return { runKey: "official-press-test", scheduleSlot: "morning",
    scheduledFor: now.toISOString(), sourceChecks: [], items, summary: "Canonical input." };
}
const fedUrl = "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261021a.htm";
const secUrl = "https://www.sec.gov/newsroom/press-releases/2026-109";
const fedTitle = "Federal Reserve Board issues FOMC statement on monetary policy";
const secTitle = "SEC approves Treasury market clearing changes";
const rss = (entries: Array<{title:string,url:string,date:string}>) =>
  "<rss version=\"2.0\"><channel>" + entries.map(entry =>
    "<item><title>" + entry.title + "</title><link>" + entry.url +
    "</link><pubDate>" + entry.date + "</pubDate></item>").join("") + "</channel></rss>";
const item = (title:string,url:string,date="Wed, 21 Oct 2026 18:00:00 GMT")=>({title,url,date});
function response(body: string, type: string, status=200) {
  return new Response(body,{status,headers:{"content-type":type}});
}
const html = (title:string) => "<html><head><title>" + title + " - official news</title></head><body><h1>" + title + "</h1><main>Original publication.</main></body></html>";

test("Fed monetary policy and SEC trading rules enter canonical intake after original same-host HTML read", async () => {
  const seen: string[]=[];
  const fetchImpl = (async (target: RequestInfo | URL) => {
    const uri=String(target);seen.push(uri);
    if(uri===OFFICIAL_PRESS_FEEDS[0].feed) return response(rss([item(fedTitle,fedUrl)]),"text/xml");
    if(uri===OFFICIAL_PRESS_FEEDS[1].feed) return response(rss([item(secTitle,secUrl)]),"application/rss+xml");
    if(uri===fedUrl) return response(html(fedTitle),"text/html");
    if(uri===secUrl) return response(html(secTitle),"text/html");
    return response("Not Found","text/plain",404);
  }) as typeof fetch;
  const result=await applyOfficialPressNewsIntake(input(),{now,fetchImpl});
  assert.deepEqual(result.items.map(x=>x.url),[fedUrl,secUrl]);
  assert.equal(seen.length,4);
  const motions = buildMarketMotionCandidates(result.items.map(i => ({
    ...i, candidateScore: 84, evidence: i.evidence || [],
  })), [], { now });
  assert.deepEqual(motions.map(m => [m.sourceKind, m.verificationState, m.marketReaction]), [
    ["official", "VERIFIED", null],
    ["filing", "VERIFIED", null],
  ]);
  assert.equal(result.sourceChecks.length,0,"Existing nine-source contract unchanged");
  assert.match(result.summary||"",/Original-source press coverage/);
  for (const row of result.items) {
    assert.equal(row.itemType,"news");
    assert.equal(row.sourceQuality,95);
    assert.equal(row.materiality,80);
    assert.equal(row.recommendedAction,"collect_evidence");
    assert.equal(row.publishedAt,"2026-10-21T18:00:00.000Z");
    assert.equal(row.evidence?.[0].claim,row.title);
    assert.match(row.reviewReason||"",/not its financial effect/);
    assert.doesNotMatch(row.newsSignal||"",/stocks rose|stocks fell|bond yields moved/);
  }
});

test("meetings, forged URLs, and stale publication clocks do not count as original news", async () => {
  const fetchImpl=(async (target: RequestInfo | URL) => {
    const uri=String(target);
    if(uri===OFFICIAL_PRESS_FEEDS[0].feed)return response(rss([
      item("Federal Reserve Board announces a public roundtable",fedUrl),
      item(fedTitle,"https://www.federalreserve.gov.evil.example/newsevents/pressreleases/monetary20261021a.htm"),
      item(fedTitle,"https://www.federalreserve.gov/newsevents/pressreleases/monetary20261015a.htm","Thu, 15 Oct 2026 18:00:00 GMT"),
    ]),"text/xml");
    if(uri===OFFICIAL_PRESS_FEEDS[1].feed)return response(rss([
      item("SEC announces advisory committee meeting",secUrl),
      item(secTitle,"http://www.sec.gov/newsroom/press-releases/2026-109"),
      item(secTitle,"https://www.sec.gov/other/2026-109"),
    ]),"text/xml");
    throw new Error("No original HTML read should occur");
  }) as typeof fetch;
  assert.deepEqual((await applyOfficialPressNewsIntake(input(),{now,fetchImpl})).items,[]);
});

test("mismatched original page title or denied publisher fails closed", async () => {
  const fetchImpl=(async (target: RequestInfo | URL) => {
    const uri=String(target);
    if(uri===OFFICIAL_PRESS_FEEDS[0].feed)return response(rss([item(fedTitle,fedUrl)]),"text/xml");
    if(uri===OFFICIAL_PRESS_FEEDS[1].feed)return response("access denied","text/plain",403);
    if(uri===fedUrl)return response(html("Unrelated historical press archive"),"text/html");
    return response("none","text/plain",404);
  }) as typeof fetch;
  const result=await applyOfficialPressNewsIntake(input(),{now,fetchImpl});
  assert.deepEqual(result.items,[]);
  assert.match(result.summary||"",/SEC press releases:blocked/);
});

test("original statement is deduplicated against existing canonical intake",async()=>{
  const existing:ResearchRunInput["items"]=[{
    itemKey:"already",itemType:"news",publisher:"Federal Reserve Board",url:fedUrl,title:fedTitle,
    publishedAt:"2026-10-21T18:00:00Z",summary:fedTitle,sourceQuality:95,
    relevance:84,novelty:76,materiality:80,recommendedAction:"collect_evidence",
  }];
  const fetchImpl=(async (target: RequestInfo | URL) => {
    const uri=String(target);
    if(uri===OFFICIAL_PRESS_FEEDS[0].feed)return response(rss([item(fedTitle,fedUrl)]),"text/xml");
    if(uri===OFFICIAL_PRESS_FEEDS[1].feed)return response(rss([]),"text/xml");
    if(uri===fedUrl)return response(html(fedTitle),"text/html");
    return response("bad","text/plain",404);
  }) as typeof fetch;
  const result=await applyOfficialPressNewsIntake(input(existing),{now,fetchImpl});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].itemKey,"already");
});

test("source-specific materiality and execution order preserve canonical verification",()=>{
  assert.equal(materiallyActionableOfficialHeadline(OFFICIAL_PRESS_FEEDS[0],fedTitle),true);
  assert.equal(materiallyActionableOfficialHeadline(OFFICIAL_PRESS_FEEDS[0],"Fed announces public webinar"),false);
  assert.equal(materiallyActionableOfficialHeadline(OFFICIAL_PRESS_FEEDS[1],secTitle),true);
  assert.equal(materiallyActionableOfficialHeadline(OFFICIAL_PRESS_FEEDS[1],"SEC appoints a new staff member"),false);
  const scheduled=readFileSync(new URL("../lib/firecrawl-scheduled-research.ts",import.meta.url),"utf8");
  const motion=readFileSync(new URL("../lib/market-motion-ingestion.ts",import.meta.url),"utf8");
  assert.ok(scheduled.indexOf("buildScheduledResearchInput(slot, options)") <
    scheduled.indexOf("await applyOfficialPressNewsIntake(input, { now })"));
  assert.ok(scheduled.indexOf("await applyOfficialPressNewsIntake(input, { now })") <
    scheduled.indexOf("await applyResearchDiscoveryProviders("));
  assert.match(motion,/item\.sourceQuality >= 90/);
  assert.match(motion,/item\.materiality < MARKET_MOTION_MIN_MATERIALITY/);
});
