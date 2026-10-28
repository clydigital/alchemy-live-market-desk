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
    if(uri===OFFICIAL_PRESS_FEEDS[2].feed) return response(rss([]),"text/xml");
    if(uri===fedUrl) return response(html(fedTitle),"text/html");
    if(uri===secUrl) return response(html(secTitle),"text/html");
    return response("Not Found","text/plain",404);
  }) as typeof fetch;
  const result=await applyOfficialPressNewsIntake(input(),{now,fetchImpl});
  assert.deepEqual(result.items.map(x=>x.url),[fedUrl,secUrl]);
  assert.equal(seen.length,9);
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
    if(OFFICIAL_PRESS_FEEDS.slice(2).some(feed=>feed.feed===uri)) return response(rss([]),"text/xml");
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


test("NVIDIA official newsroom release is VERIFIED primary issuer news, not a verified stock-price explanation", async () => {
  const title="NVIDIA Announces Expanded AI Infrastructure Investment and Capacity";
  const url="https://nvidianews.nvidia.com/news/nvidia-expands-ai-infrastructure-capacity";
  const fetchImpl=(async (target:RequestInfo | URL) => {
    const uri=String(target);
    if(uri===OFFICIAL_PRESS_FEEDS[2].feed)return response(rss([item(title,url)]),"application/rss+xml");
    if(uri===url)return response(html(title),"text/html");
    return response(rss([]),"text/xml");
  }) as typeof fetch;
  const result=await applyOfficialPressNewsIntake(input(),{now,fetchImpl});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].publisher,"NVIDIA Newsroom");
  assert.equal(result.items[0].url,url);
  assert.equal(result.items[0].evidence?.[0].claim,title);
  const motion=buildMarketMotionCandidates(result.items.map(x=>({...x,candidateScore:83,evidence:x.evidence||[]})),[],{now});
  assert.equal(motion.length,1);
  assert.equal(motion[0].sourceKind,"primary");
  assert.equal(motion[0].verificationState,"VERIFIED");
  assert.equal(motion[0].marketReaction,null);
  assert.deepEqual(motion[0].tickers,["NVDA"]);
});

test("NVIDIA blogs, forged domains, stale timestamps and generic consumer content fail the original-issuer gate",async()=>{
  const title="NVIDIA Announces Expanded AI Infrastructure Investment and Capacity";
  const untrusted=[
    item(title,"https://nvidianews.nvidia.com.evil.net/news/bad"),
    item(title,"https://nvidianews.nvidia.com/blog/fake"),
    item(title,"https://nvidianews.nvidia.com/news/stale","Thu, 15 Oct 2026 18:00:00 GMT"),
    item("NVIDIA celebrates gaming community event","https://nvidianews.nvidia.com/news/consumer"),
  ];
  const fetchImpl=(async (target:RequestInfo | URL) =>{
    if(String(target)===OFFICIAL_PRESS_FEEDS[2].feed)return response(rss(untrusted),"text/xml");
    if(String(target)===OFFICIAL_PRESS_FEEDS[0].feed||String(target)===OFFICIAL_PRESS_FEEDS[1].feed) return response(rss([]),"text/xml");
    throw new Error("No original page should be fetched");
  }) as typeof fetch;
  assert.deepEqual((await applyOfficialPressNewsIntake(input(),{now,fetchImpl})).items,[]);
});

test("NVIDIA canonical trailing-slash original release is eligible; nested paths are rejected", async () => {
  const title = "NVIDIA and Supply Chain Partners Expand Capacity to Accelerate AI Infrastructure Buildout";
  const url = "https://nvidianews.nvidia.com/news/nvidia-and-supply-chain-partners-expand-capacity-to-accelerate-ai-infrastructure-buildout/";
  const invalidUrl = url + "extra";
  const fetched: string[] = [];
  const fetchImpl = (async (target: RequestInfo | URL) => {
    const uri = String(target);
    fetched.push(uri);
    if (uri === OFFICIAL_PRESS_FEEDS[2].feed) {
      return response(rss([item(title, invalidUrl), item(title, url)]), "application/rss+xml");
    }
    if (uri === url) return response(html(title), "text/html");
    if (uri === OFFICIAL_PRESS_FEEDS[0].feed || uri === OFFICIAL_PRESS_FEEDS[1].feed) {
      return response(rss([]), "text/xml");
    }
    throw new Error("Unexpected original-page read: " + uri);
  }) as typeof fetch;
  const result = await applyOfficialPressNewsIntake(input(), { now, fetchImpl });
  assert.deepEqual(result.items.map(entry => entry.url), [url]);
  assert.equal(fetched.includes(invalidUrl), false, "Nested forged path must not be fetched");
  assert.equal(fetched.includes(url), true, "Original trailing-slash permalink must be fetched");
  const motions = buildMarketMotionCandidates(result.items.map(entry =>
    ({ ...entry, candidateScore: 83, evidence: entry.evidence || [] })), [], { now });
  assert.equal(motions.length, 1);
  assert.equal(motions[0].sourceKind, "primary");
  assert.equal(motions[0].verificationState, "VERIFIED");
  assert.equal(motions[0].marketReaction, null, "Issuer announcement does not prove price reaction");
});


test("Broadcom and Meta financing primary releases enter original verified-news intake",async()=>{
 const oldNow=new Date("2026-10-27T12:00:00Z");
 const broadcom=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="investors.broadcom.com")!;
 const meta=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="investor.atmeta.com")!;
 const bTitle="Broadcom Announces Major AI Equipment Financing for Anthropic";
 const mTitle="Meta Announces Pricing of Offering of Class A Common Stock";
 const bUrl="https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-major-ai-equipment-financing";
 const mUrl="https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Announces-Pricing-of-Offering/default.aspx";
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  const url=String(target);
  if(url===broadcom.feed)return response(rss([item(bTitle,bUrl,"Mon, 26 Oct 2026 17:00:00 GMT")]),"application/rss+xml");
  if(url===meta.feed)return response(rss([item(mTitle,mUrl,"Tue, 27 Oct 2026 01:30:00 GMT")]),"application/rss+xml");
  if(url===bUrl)return response(html(bTitle),"text/html");
  if(url===mUrl)return response(html(mTitle),"text/html");
  return response(rss([]),"text/xml");
 }) as typeof fetch;
 const result=await applyOfficialPressNewsIntake(input(),{now:oldNow,fetchImpl});
 assert.deepEqual(result.items.map(x=>x.url).sort(),[bUrl,mUrl].sort());
 assert.ok(result.items.every(x=>x.sourceQuality===95));
 assert.ok(result.items.every(x=>x.evidence?.[0]?.claim===x.title));
 assert.ok(result.items.every(x=>/not its financial effect/.test(x.reviewReason||"")));
 const motions=buildMarketMotionCandidates(result.items.map(x=>({...x,
  candidateScore:94,evidence:x.evidence||[]})),[],{now:oldNow});
 assert.ok(motions.every(x=>x.verificationState==="VERIFIED"));
 assert.ok(motions.every(x=>x.marketReaction===null));
});
test("Issuer RSS cannot forge other hosts or replace original page verification",async()=>{
 const broadcom=OFFICIAL_PRESS_FEEDS.find(f=>f.host==="investors.broadcom.com")!;
 const fake="https://investors.broadcom.com.evil.example/news-releases/news-release-details/malicious";
 const fetchImpl=(async (target:RequestInfo|URL)=>{
  if(String(target)===broadcom.feed)return response(rss([
    item("Broadcom Announces Major AI Equipment Financing",fake),
    item("Broadcom Announces Major AI Equipment Financing",
      "https://investors.broadcom.com/blog/undated")
  ]),"text/xml");
  return response(rss([]),"text/xml");
 }) as typeof fetch;
 assert.deepEqual((await applyOfficialPressNewsIntake(input(),{now,fetchImpl})).items,[]);
});
