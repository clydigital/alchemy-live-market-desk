import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("historical 4 November sector research is below the current source-qualified Newsroom feed, collapsed by default",()=>{
 const page=read("app/blue-desk/newsroom/page.tsx");
 const open=page.indexOf('<details id="historical-sector-editorial"');
 const wire=page.indexOf('<BluebellyNewsWire news={news}');
 const wireEnd=page.indexOf("</BluebellyNewsWire>");
 const story=page.indexOf('<SectorDivergenceFeature mode="newsroom"');
 assert.ok(wire>=0&&wireEnd>wire,"qualified wire must be rendered first");
 assert.ok(open>wireEnd&&story>open,"dated editorial appears after live source wire");
 assert.doesNotMatch(page.slice(open,story),/<details[^>]*\\sopen(?:\\s|=|>)/,"archive is closed by default");
 assert.equal(page.match(/<SectorDivergenceFeature mode="newsroom"/g)?.length,1,"no duplicate hero");
 assert.match(page,/data-newsroom-historical-sector="collapsed-below-news-wire"/);
 assert.match(page,/HISTORICAL RESEARCH \/ US CLOSE 4 NOVEMBER 2026/);
 assert.match(page,/Solarvest company comparison/);
});

test("sector reports and exact company deep links remain intact in historical section",()=>{
 const page=read("app/blue-desk/newsroom/page.tsx");
 const sector=read("components/blue-desk/SectorDivergenceFeature.tsx");
 const market=read("app/blue-desk/markets/page.tsx");
 assert.match(page,/articleHrefBase=\{blueDeskPublicHref\("\/blue-desk\/newsroom",host\)\}/);
 assert.match(sector,/data-bluebelly-sector-divergences=\{mode\}/);
 assert.match(sector,/data-price-session="2026-11-04"/);
 assert.match(sector,/articleHrefBase\+"\?divergence=solarvest-peers"/);
 assert.match(sector,/SOLARVEST_RESEARCH\.auditedReportUrl/);
 assert.match(sector,/SECTOR_DIVERGENCES\.map/);
 assert.match(market,/<SectorDivergenceFeature mode="markets"/);
});

test("archive disclosure is keyboard accessible and mobile friendly",()=>{
 const css=read("app/blue-desk/newsroom/newsroom.module.css");
 assert.match(css,/\.historicalEditorial>summary:focus-visible/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/\.historicalContent/);
 const page=read("app/blue-desk/newsroom/page.tsx");
 assert.doesNotMatch(page,/\.insert\(|\.upsert\(|service_role/);
});
