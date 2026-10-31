import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 blueDeskHostAccess,blueDeskPresentationTarget,
} from "../lib/blue-desk-host.ts";
import {LAB_SLATE,LAB_PRICE_CARDS} from "../lib/editorial-lab-fixtures.ts";

function text(path:string){return readFileSync(new URL("../"+path,import.meta.url),"utf8");}
test("temporary no-login lab is publicly viewable only on the dedicated Bluebelly host",()=>{
 assert.equal(blueDeskHostAccess("/editorial-lab","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskHostAccess("/blue-desk/editorial-lab","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskPresentationTarget("/editorial-lab","bluebelly-desk.vercel.app"),
   "/blue-desk/editorial-lab");
 for(const host of ["alchemy-live-market-desk.vercel.app","alchemy-blue-desk.vercel.app",
  "attacker.vercel.app"]){
  assert.notEqual(blueDeskHostAccess("/editorial-lab",host),"public");
  assert.equal(blueDeskPresentationTarget("/editorial-lab",host),null);
 }
});
test("neither owner APIs nor live owner pages are unguarded by the new lab route",()=>{
 for(const path of ["/api/owner/editorial-investigate","/api/owner/editorial-generate",
 "/owner/editorial","/owner/presenter","/api/cron/research/morning","/api/admin",
 "/blue-desk/presenter/full-prep"]){
  assert.notEqual(blueDeskHostAccess(path,"bluebelly-desk.vercel.app"),"public",path);
 }
 const middleware=text("middleware.ts");
 assert.match(middleware,/if \(accessScope === "blocked"\)/);
 assert.match(middleware,/if \(accessScope === "public"\) \{/);
 assert.match(middleware,/return presentationResponse\(request\);/);
 assert.match(middleware,/retiredLivePublicDestination\(pathname, host, request\.nextUrl\.search\)/);
 assert.match(middleware,/supabase\.auth\.getClaims\(\)/);
 assert.match(middleware,/app_access_allowlist/);
});
test("lab contains no private DB reads or server model credentials and uses only local fixtures",()=>{
 const page=text("app/blue-desk/editorial-lab/page.tsx");
 const fixture=text("lib/editorial-lab-fixtures.ts");
 assert.match(page,/data-no-login-editorial-lab="synthetic-only"/);
 assert.match(page,/previewMode/);
 assert.match(page,/LAB_SLATE,LAB_PRICE_CARDS/);
 assert.match(page,/cannot access Gemini/);
 assert.doesNotMatch(page,/getLatestEditorialSlate|getMarketMonitor|createSupabase|GEMINI_API_KEY/);
 assert.doesNotMatch(fixture,/createSupabase|fetch\(|process\.env|getMarketMonitor/);
 assert.equal(LAB_PRICE_CARDS[0].status,"UNKNOWN");
 assert.equal(LAB_PRICE_CARDS[0].lastClose,null);
 assert.equal(LAB_SLATE.verificationStatus,"partial");
 assert.equal(LAB_SLATE.ideas.length,3);
 assert.ok(LAB_SLATE.ideas.every(x=>x.title.startsWith("Demo:")&&!x.sourceUrls.length));
});
test("preview actions never call live owner APIs or contaminate real owner draft storage",()=>{
 const editor=text("components/blue-desk/EditorialWorkbench.tsx");
 const investigate=text("components/blue-desk/InvestigationWorkbench.tsx");
 assert.match(editor,/const PREVIEW_STORAGE="bluebelly-editorial-lab-demo-v1"/);
 assert.match(editor,/localStorage\.getItem\(previewMode\?PREVIEW_STORAGE:STORAGE\)/);
 assert.match(editor,/localStorage\.setItem\(previewMode\?PREVIEW_STORAGE:STORAGE/);
 assert.match(editor,/if\(previewMode\)\{/);
 assert.match(editor,/Offline demo template prepared; no model\/API called/);
 assert.ok(editor.indexOf("if(previewMode){")<editor.indexOf('fetch("/api/owner/editorial-generate"'));
 assert.ok(investigate.indexOf("if(previewMode){")<investigate.indexOf('fetch("/api/owner/editorial-investigate"'));
 assert.match(investigate,/No live price observations are accessed in this public UI lab/);
 assert.match(investigate,/No model, tools, API or private account used/);
 assert.match(investigate,/Preview investigation layout \(offline\)/);
});
test("preview route remains explicitly temporary and unavailable as a producer evidence source",()=>{
 const page=text("app/blue-desk/editorial-lab/page.tsx");
 assert.match(page,/Temporary release aid/);
 assert.match(page,/remove once/);
 assert.doesNotMatch(page,/story_thesis_versions|persistSensorMemory|INSERT|UPDATE |cron/);
});
