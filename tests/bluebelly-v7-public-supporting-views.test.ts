import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Calendar CP summary binds real source-listed windows and keeps actual event/time logic",()=>{
 const page=read("app/blue-desk/calendar/page.tsx");
 const visual=read("app/blue-desk/calendar/command-calendar.module.css");
 const radar=read("components/blue-desk/CatalystCalendar.tsx");
 assert.match(page,/data-blue-desk-calendar="ET-primary"/);
 assert.match(page,/data-v7-calendar="source-dated-catalyst-command"/);
 assert.match(page,/data-calendar-graphics="source-listed-counts"/);
 assert.match(page,/getEconomicCalendar\(\)/);
 assert.match(page,/getForwardEarningsEvents\(\{ now \}\)/);
 assert.match(page,/projectBluebellyCatalysts\(calendar\.events, radar\.events, radar\.signals\)/);
 assert.match(page,/<strong>\{events\.length\}<\/strong>/);
 assert.match(page,/<strong>\{earningsHub\.length\}<\/strong>/);
 assert.match(page,/<strong>\{catalysts\.length\}<\/strong>/);
 assert.match(page,/DISPLAY AS OF · NOT AN EVENT RELEASE TIME/);
 assert.match(page,/<DualTimestamp value=\{nowDisplay\.iso\}/);
 assert.match(page,/<CatalystCalendar items=\{catalysts\} sourceCoverage=\{sourceCoverage\} nowISO=\{now\.toISOString\(\)\}/);
 assert.match(radar,/data-catalyst-calendar="v4"/);
 assert.match(radar,/const \[zone,setZone\]=useState<DisplayZone>\("UTC"\)/);
 assert.match(radar,/Asia\/Kuala_Lumpur/);
 assert.match(visual,/\.metrics\{/);
 assert.doesNotMatch(page,/Math\.random\(\)|const ASSETS\s*=/);
});

test("Watch remains dated public thesis memory; radar is explicitly decorative",()=>{
 const watch=read("components/blue-desk/LeanWatch.tsx");
 const styles=read("components/blue-desk/lean-watch.module.css");
 assert.match(watch,/data-bluebelly-watch="lean-readonly-v1"/);
 assert.match(watch,/data-v7-watch-graphic="decorative-research-radar"/);
 assert.match(watch,/className=\{ui\.heroRadar\} aria-hidden="true"/);
 assert.match(watch,/stories\.map\(story=/);
 assert.match(watch,/data-watch-story=\{story\.slug\}/);
 assert.match(watch,/dateTime=\{story\.updatedAt\}/);
 assert.match(watch,/story\.nextTest/);
 assert.match(watch,/story\.contradiction/);
 assert.match(watch,/Evidence and counterargument/);
 assert.match(watch,/No approved public thesis snapshot is available/);
 assert.match(styles,/\.radarRing\{/);
 assert.doesNotMatch(watch,/Math\.random|live signal =/);
});

test("Newsroom command counts use source-qualified server results, not a simulated tape",()=>{
 const newsroom=read("app/blue-desk/newsroom/page.tsx");
 assert.match(newsroom,/data-public-newsroom="original-source-only"/);
 assert.match(newsroom,/data-v7-newsroom-command="source-qualified"/);
 assert.match(newsroom,/\{news\.length\}/);
 assert.match(newsroom,/\{archiveResult\.items\.length\}/);
 assert.match(newsroom,/sourceFeed\.sourceReads/);
 assert.match(newsroom,/readBluebellyQualifiedNews/);
 assert.match(newsroom,/<BluebellyNewsWire news=\{news\}/);
 assert.match(newsroom,/initialCategory=\{typeof params\.category==="string"\?params\.category:"all"\}/);
 assert.match(newsroom,/initialPage=\{typeof params\.page==="string"\?params\.page:"1"\}/);
 assert.match(newsroom,/data-newsroom-deep-dives="single-editorial-destination"/);
});

test("Research archive preserves exact edition URLs, filters and pagination, moves duplicate editorial to disclosure",()=>{
 const page=read("app/blue-desk/research/page.tsx");
 const css=read("app/blue-desk/research/research.module.css");
 assert.match(page,/data-bluebelly-research-index="public-approved-dated"/);
 assert.match(page,/data-v7-research-command="dated-archive"/);
 assert.match(page,/selectPublicResearch\(q,active\)/);
 assert.match(page,/paginateReaderItems\(results/);
 assert.match(page,/defaultValue=\{q\}/);
 assert.match(page,/data-research-edition=\{item\.id\}/);
 assert.match(page,/item\.href/);
 assert.match(page,/dateTime=\{item\.asOf\}/);
 assert.match(page,/ReaderPagination label="Research Library"/);
 assert.match(page,/data-research-editorial="archived-secondary"/);
 assert.ok(page.indexOf("<ReaderPagination") < page.indexOf('data-research-editorial="archived-secondary"'));
 assert.match(page,/<CurrentMarketUpdates host=\{host\} mode="compact"\/>/);
 assert.match(css,/\.editionContext\{/);
 assert.match(css,/\.card::before/);
});

test("Support view smoke maintains source-real DOM and captures both responsive breakpoints",()=>{
 const script=read("scripts/bluebelly-regime-ui-smoke.mjs");
 assert.match(script,/\["\/calendar","calendar"/);
 assert.match(script,/\["\/research","research"/);
 assert.match(script,/__support_snapshot/);
 assert.match(script,/data-v7-calendar="source-dated-catalyst-command"/);
 assert.match(script,/data-v7-research-command="dated-archive"/);
 assert.match(script,/data-v7-newsroom-command="source-qualified"/);
 assert.match(script,/data-v7-watch-graphic="decorative-research-radar"/);
 assert.match(script,/\["desktop",1440,1200\]/);
 assert.match(script,/\["mobile",390,1200\]/);
});
