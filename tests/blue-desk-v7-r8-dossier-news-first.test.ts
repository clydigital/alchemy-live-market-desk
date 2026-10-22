import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";
const source = (file: string) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("native Blueberry Dossier uses the canonical stored archive and exact immutable IDs",()=>{
 const d=source("app/blue-desk/dossier/page.tsx");
 assert.match(d,/getDossierV2PresentationSelectionById\(id\)/);
 assert.match(d,/getDossierV2PresentationSelection\(\)/);
 assert.match(d,/getDossierV2HistoryIndex\(18\)/);
 assert.match(d,/isValidUuid\(id\)/);
 assert.match(d,/No other Dossier has been substituted/);
 assert.doesNotMatch(d,/\.upsert\(|\.insert\(|\.update\(|createSupabaseAdminClient\(|getMarketMonitor\(|getCurrentMarketMotion\(/);
 assert.match(d,/Exact Dossier unavailable/);
});
test("Bluebelly public reader never receives the raw canonical Dossier",()=>{
 for(const host of ["bluebelly-desk.vercel.app","alchemy-live-market-desk.vercel.app"]){
   assert.notEqual(blueDeskHostAccess("/blue-desk/dossier",host),"public");
 }
 const d=source("app/blue-desk/dossier/page.tsx");
 assert.match(d,/if \(isBlueDeskPublicReaderHost\(host\) && !bluebelly\) notFound\(\)/);
 assert.equal(blueDeskHostAccess("/blue-desk/dossier","alchemy-live-market-desk-review-rogue-magazine.vercel.app"),"private");
 const nav=source("components/blue-desk/BlueDeskHeader.tsx");
 assert.match(nav,/\["Dossier", "\/blue-desk\/dossier"\]/);
 const publicNav=nav.slice(nav.indexOf("const PUBLIC_NAV"),nav.indexOf("const NAV_ICONS"));
 assert.doesNotMatch(publicNav,/dossier|hybrid|feed|\/blue-desk\/presenter/i);
});
test("latest verified reporting opens before market observations and Dossier interpretation",()=>{
 const home=source("app/blue-desk/page.tsx");
 const news=home.indexOf('aria-labelledby="blue-desk-news-title"');
 const map=home.indexOf('aria-labelledby="daily-map-title"');
 const hero=home.indexOf('aria-label="Latest canonical Market Brief"');
 assert.ok(news>=0 && map>news && hero>map);
 assert.match(home,/getCurrentVerifiedMarketMotion\(\{ limit: 24 \}\)/);
 assert.match(home,/selectVerifiedNewsBriefs\(verifiedMotions, now, 12\)/);
 assert.match(home,/ownerResearchMotions = publicHost \? \[\]/);
 assert.match(home,/verification_state !== "VERIFIED"/);
 assert.match(home,/href="\/blue-desk\/dossier"/);
 assert.match(home,/No fresh source-verified news/);
 assert.doesNotMatch(home,/createSupabaseAdminClient\(|\.upsert\(|\.insert\(/);
});
