import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const home=read("app/blue-desk/page.tsx");
const header=read("components/blue-desk/BlueDeskHeader.tsx");
const document=read("docs/editorial/BLUEBELLY_DAILY_DELIVERY_CONTRACT.md");

test("homepage is a source-dated market utility before archived Today reading",()=>{
  const lead=home.indexOf('data-home-market-first="source-dated-terminal"');
  const old=home.indexOf('data-home-editorial-reader="legacy-on-demand"');
  assert.ok(lead>0&&old>lead,"Market terminal precedes legacy news reader");
  assert.match(home,/publicMarketObservations\(monitor\?\.rows\|\|\[\],"all"\)/);
  assert.match(home,/marketHighlights\.map/);
  assert.match(home,/formatMarketChange\(row\.change3d,row\.changeUnit\)/);
  assert.match(home,/formatMarketChange\(row\.change5d,row\.changeUnit\)/);
  assert.match(home,/row\.dataStatus!=="UNAVAILABLE_OR_STALE"/);
  assert.match(home,/row\.frequency==="daily"/);
  assert.match(home,/observedAt<=now\.getTime\(\)/);
  assert.match(home,/now\.getTime\(\)-observedAt<=7\*24\*60\*60\*1000/);
  assert.match(home,/DualTimestamp value=\{row\.asOf\}/);
  assert.match(home,/data-home-archive="on-demand"/);
  assert.match(home,/publicHost\?<ProgressiveTodayReader/);
  assert.doesNotMatch(home,/runAutomatedDailyPdfReport|runPrivateDailyHtmlFallback|generateContent|createSupabaseAdminClient/);
});

test("navigation demotes reporting, protects owner, and retains source and historical deep links",()=>{
  const nav=header.split("const PUBLIC_NAV = [")[1]?.split("] as const;")[0]||"";
  const more=header.split("const PUBLIC_MORE = [")[1]?.split("] as const;")[0]||"";
  for(const [label,href] of [["Markets","/markets"],["Calendar","/calendar"],["Watch","/key-stories"]]){
    assert.ok(nav.includes('["'+label+'", "'+href+'"]'),label);
    assert.equal(blueDeskHostAccess(href,"bluebelly-desk.vercel.app"),"public");
  }
  assert.ok(!nav.includes("Today")&&!nav.includes("Newsroom")&&!nav.includes("Daily Report"));
  assert.match(more,/Source Feed/);
  assert.match(more,/Research Archive/);
  for(const p of ["/newsroom","/research","/regime-watch","/hormuz","/learn"])
    assert.equal(blueDeskHostAccess(p,"bluebelly-desk.vercel.app"),"public",p);
  for(const p of ["/my-reports","/owner/research","/owner/daily-report"])
    assert.equal(blueDeskHostAccess(p,"bluebelly-desk.vercel.app"),"private",p);
  assert.match(header,/href="\/my-reports">My Desk/);
});

test("old Daily Intelligence mandate is superseded without deleting protected archives",()=>{
  assert.match(document,/SUPERSEDED — 7 November 2026/);
  assert.match(document,/Do not reactivate automatic HTML\/PDF/);
  const myDesk=read("app/my-reports/page.tsx");
  assert.match(myDesk,/data-private-desk="source-first-market-workspace"/);
  const reader=read("app/api/owner/html-editions/route.ts");
  assert.match(reader,/app_access_allowlist/);
  assert.match(reader,/getUser\(\)/);
});
