import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {projectOriginalPressNews,type OfficialPressReceipt} from "../lib/blue-desk-original-press-news.ts";
import {combineQualifiedNews} from "../lib/blue-desk-qualified-news.ts";

const now=new Date("2026-10-22T14:00:00.000Z");
const url="https://nvidianews.nvidia.com/news/nvidia-expands-ai-infrastructure-capacity";
const title="NVIDIA Announces Expanded AI Infrastructure Investment and Capacity";
const pub="2026-10-21T10:33:00.000Z";
const proof="Original official RSS publication clock and directly linked same-host press-release HTML checked. Headline describes the announcement only, not its financial effect.";
const key=(s:string)=>"official-press:"+createHash("sha256").update(s).digest("hex").slice(0,24);
const base:OfficialPressReceipt={
 id:"11111111-1111-4111-8111-111111111111",item_key:key(url),item_type:"news",status:"accepted",
 publisher:"NVIDIA Newsroom",title,url,published_at:pub,created_at:"2026-10-21T22:08:32.877Z",
 source_quality:95,relevance:84,novelty:76,materiality:80,candidate_score:84,review_reason:proof,
 evidence_links:[{url,claim:title,title,publisher:"NVIDIA Newsroom",publishedAt:pub}],
};

test("real stored original-press schema projects source-checked announcement without Dossier",()=>{
 const got=projectOriginalPressNews([base],now);
 assert.equal(got.length,1);
 assert.equal(got[0].contentType,"NEWS_BRIEF");
 assert.equal(got[0].verification,"SOURCE_VERIFIED");
 assert.equal(got[0].sourceKind,"primary");
 assert.equal(got[0].occurredAt,pub);
 assert.equal(got[0].observedAt,"2026-10-21T22:08:32.877Z");
 assert.match(got[0].summary,/market-price reaction.*not been established/);
 assert.equal(got[0].sourceUrl,url);
});

test("only exact original-source attested receipts qualify — never transcript, article or spoof",()=>{
 const changes=[
  {item_key:"intake:creators:123"},{item_type:"video"}, {status:"unverified"},
  {review_reason:"Analyst read a news summary"},
  {source_quality:90},{candidate_score:65},
  {source_quality:100}, {materiality:45}, {novelty:20},
  {publisher:"StockedUp"}, {url:"https://nvidianews.nvidia.com.evil.example/news/fake"},
  {url:"https://nvidianews.nvidia.com/blog/fake"},{title:"NVIDIA Announces a community webinar"},
  {evidence_links:[]},
  {evidence_links:[{url,claim:"the stock rose",title,publisher:"NVIDIA Newsroom",publishedAt:pub}]},
  {published_at:"2026-10-15T10:33:00.000Z"},
  {published_at:"2026-10-23T10:33:00.000Z"},
  {created_at:"2026-10-23T12:33:00.000Z"},
  {created_at:"2026-10-20T10:33:00.000Z"},
 ];
 for(const update of changes){
  assert.deepEqual(projectOriginalPressNews([{...base,...update}],now),[],
    "unsafe mutation "+Object.keys(update)[0]+" must fail");
 }
});

test("confirmed regulator/central-bank original press also qualifies when its original receipt matches",()=>{
 const fedUrl="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261021a.htm";
 const fedTitle="Federal Reserve Board issues FOMC statement on monetary policy";
 const fed={...base,item_key:key(fedUrl),publisher:"Federal Reserve Board",title:fedTitle,url:fedUrl,
   evidence_links:[{url:fedUrl,claim:fedTitle,publisher:"Federal Reserve Board",publishedAt:pub}]};
 const result=projectOriginalPressNews([fed],now);
 assert.equal(result.length,1);
 assert.equal(result[0].sourceKind,"official");
});

test("canonical verified Motion wins on duplicate original URL, no inflated counts",()=>{
 const o=projectOriginalPressNews([base],now);
 const motion={...o[0],id:"22222222-2222-4222-8222-222222222222",headline:"Canonical source-verified announcement"};
 const combined=combineQualifiedNews([motion],o,8);
 assert.equal(combined.length,1);
 assert.equal(combined[0].id,motion.id);
 assert.deepEqual(combineQualifiedNews([],o,8),o);
 assert.deepEqual(combineQualifiedNews([{...motion,verification:"SOURCE_VERIFIED" as const,sourceUrl:"http://bad.example/a"}],[],8),[]);
});

test("homepage, daily report, and persistent Stories use identical qualified-news source",()=>{
 const paths=["../app/blue-desk/page.tsx","../app/blue-desk/daily-report/page.tsx","../app/blue-desk/key-stories/page.tsx"];
 for(const path of paths){
  const s=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.match(s,/getOriginalPressNews\(now/);
  assert.match(s,/combineQualifiedNews\(motionNews,originalPress/);
  assert.doesNotMatch(s,/insert\(|upsert\(|\.update\(/);
 }
 const reader=readFileSync(new URL("../lib/blue-desk-original-press-news-server.ts",import.meta.url),"utf8");
 assert.match(reader,/import "server-only"/);
 assert.match(reader,/\.like\("item_key","official-press:%"\)/);
 assert.doesNotMatch(reader,/\.upsert\(|\.insert\(|\.delete\(/);
});
