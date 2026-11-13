import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sourceCheckedReleaseImpact} from "../lib/bluebelly-release-impact-brief.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";
const src=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const bls:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
 id:"test-ppi-2026-10",
 headline:"Producer Price Index for October 2026",
 summary:"Final demand PPI October 2026 +0.3% m/m and +6.5% y/y from the US government release.",
 sourceName:"U.S. Bureau of Labor Statistics",
 sourceKind:"official",
 sourceUrl:"https://www.bls.gov/news.release/archives/ppi_11132026.htm",
 occurredAt:"2026-11-13T13:30:00Z",
 observedAt:"2026-11-13T14:00:00Z",
 verification:"SOURCE_VERIFIED"
};
test("2026 October BLS source-linked PPI gets a genuine historical and pre-release comparison",()=>{
 const release=sourceCheckedReleaseImpact(bls);
 assert.ok(release);
 assert.equal(release.eventDate,"2026-11-13");
 assert.equal(release.contrasts.length,2);
 const mom=release.contrasts.find(x=>x.id==="ppi-mom")!;
 assert.equal(mom.actual,"+0.3%");
 assert.equal(mom.previous,"+1.4%");
 assert.match(mom.previousVintage,/Originally \+1\.3%/);
 assert.match(mom.expectation||"",/\+0\.4%/);
 assert.match(mom.deltaVsPrevious,/−1\.1 percentage points/);
 assert.match(mom.deltaVsExpectation||"",/−0\.1 percentage point/);
 assert.equal(mom.sourceUrls.length,2);
 const yoy=release.contrasts.find(x=>x.id==="ppi-yoy")!;
 assert.equal(yoy.actual,"+6.5%");
 assert.equal(yoy.previous,"+6.3%");
 assert.equal(yoy.expectation,null);
 assert.match(yoy.deltaVsPrevious,/\+0\.2 percentage points/);
});
test("qualitative asset gauges name a concrete mechanism and countercase, not fabricated price reaction",()=>{
 const release=sourceCheckedReleaseImpact(bls)!;
 assert.equal(release.exposures.length,4);
 assert.deepEqual(release.exposures.map(x=>x.asset),["XLI","SMH","US02Y","TLT"]);
 for(const asset of release.exposures){
  assert.ok(["ELEVATED","MODERATE","WATCH"].includes(asset.tier));
  assert.ok(asset.mechanism.length>105,asset.asset);
  assert.ok(asset.counterforce.length>70,asset.asset);
  assert.ok(asset.decidingTest.length>45,asset.asset);
  assert.match(asset.sourceUrl,/^https:\/\/www\.reuters\.com\//);
 }
 assert.equal(release.observedMarketReaction,"NOT_MEASURED");
 assert.match(release.reactionNote,/08:30 ET/);
 assert.ok(release.sourceLedger.some(x=>x.role.includes("Previous")));
 assert.ok(release.sourceLedger.some(x=>x.role.includes("consensus")));
});
test("spoofed sources, altered release vintage and incomplete facts cannot get historical overlays",()=>{
 const variants=[
  {...bls,verification:"UNVERIFIED" as NewsBriefV1["verification"]},
  {...bls,sourceKind:"reporting"},
  {...bls,sourceName:"Reuters"},
  {...bls,sourceUrl:"https://fake-bls.org/news.release/archives/ppi_11132026.htm"},
  {...bls,sourceUrl:"http://www.bls.gov/news.release/archives/ppi_11132026.htm"},
  {...bls,sourceUrl:"https://www.bls.gov/schedule/news_release/ppi.htm"},
  {...bls,occurredAt:"2026-10-13T13:30:00Z"},
  {...bls,occurredAt:"2026-11-13T12:00:00Z"},
  {...bls,summary:"Final demand PPI only +0.3% monthly; annual rate not reported."},
  {...bls,headline:"Producer Price Index for September 2026",summary:"September producer inflation rose 0.3% m/m and 6.5% y/y."},
 ];
 for(const x of variants)assert.equal(sourceCheckedReleaseImpact(x),null,JSON.stringify(x));
});
test("source-only article shows useful comparisons and asset gauges, with accessible mobile disclosure",()=>{
 const reader=src("components/blue-desk/ShortNewsRecap.tsx");
 const view=src("components/blue-desk/ReleaseComparisonDisruption.tsx");
 const css=src("components/blue-desk/ReleaseComparisonDisruption.module.css");
 assert.match(reader,/sourceCheckedReleaseImpact\(recap.rawNews\)/);
 assert.match(reader,/<ReleaseComparisonDisruption brief=\{checkedRelease\}\/>/);
 assert.match(reader,/data-bluebelly-news-recap="source-only-depth-incomplete"/);
 assert.match(reader,/data-bluebelly-coverage="review-handoff-pending"/);
 assert.doesNotMatch(reader,/No reviewed economic effect or event-window share-price response is attached/);
 assert.doesNotMatch(reader,/<ul>\{coverage.missing.map/);
 assert.match(view,/PREVIOUS/);assert.match(view,/ACTUAL/);assert.match(view,/EXPECTED/);
 assert.match(view,/data-asset-disruption=\{item.asset\}/);
 assert.match(view,/data-event-market-reaction="NOT_MEASURED"/);
 assert.match(view,/<details className=\{styles.cardDetails\}>/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/\.grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test("existing investigator and owner writer require historical vintages and exposure channels by default",()=>{
 const investigation=src("lib/editorial-investigation.ts");
 const writer=src("lib/blue-desk-narrative-playbook.ts");
 const route=src("app/api/owner/editorial-generate/route.ts");
 const editorial=src("docs/editorial/BLUEBELLY_MARKET_CONSEQUENCE_STANDARD.md");
 for(const source of [investigation,writer,route]){
  assert.match(source,/previous|PREVIOUS/i);
  assert.match(source,/revised/i);
  assert.match(source,/consensus/i);
  assert.match(source,/disruption/i);
 }
 assert.match(editorial,/14 November 2026 — Previous data/);
 assert.match(editorial,/source-only fallback/i);
 assert.doesNotMatch(route,/\.insert\(|supabase\.rpc\(/);
});
