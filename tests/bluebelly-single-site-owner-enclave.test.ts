import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess,blueDeskPresentationTarget}
 from "../lib/blue-desk-host.ts";
import {safeOwnerReturnPath} from "../lib/supabase/owner-return-path.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";
const paths=[
 "/owner/editorial","/owner/presenter","/owner/daily-report","/owner/x-wire",
 "/api/owner/macropulse-briefs","/api/owner/daily-research",
 "/api/owner/editorial-generate","/api/owner/editorial-investigate",
 "/api/presenter/technical-checks"
];

test("Bluebelly owner-only native tools use exact private paths, never public routes",()=>{
 for(const p of ["/my-reports",...paths]){
  assert.equal(blueDeskHostAccess(p,host),"private",p);
  assert.equal(blueDeskPresentationTarget(p,host),null,p);
 }
 for(const p of ["/owner/editorial/","/owner/presenter/other",
  "/api/owner/editorial-generate/","/api/owner/editorial-investigate/x",
  "/api/presenter/technical-checks/x",
  "/owner/publications","/owner/x-wire/","/owner/daily-report/","/api/owner/daily-research/",
  "/api/owner/macropulse-briefs/","/api/owner/editorial-publish",
  "/api/cron/research/morning","/api/internal/canonical-feed",
  "/api/research-update","/hybrid-output/prepare"]){
  assert.equal(blueDeskHostAccess(p,host),"blocked",p);
 }
 for(const p of ["/","/markets","/key-stories","/calendar","/daily-report"]){
  assert.equal(blueDeskHostAccess(p,host),"public",p);
 }
 assert.equal(blueDeskHostAccess("/owner/presenter","alchemy-blue-desk.vercel.app"),"blocked");
});

test("login and callback preserve exact Bluebelly owner deep link and no arbitrary redirect",()=>{
 assert.equal(safeOwnerReturnPath(null),"/my-reports");
 assert.equal(safeOwnerReturnPath("/owner/presenter#technical-checks"),
  "/owner/presenter#technical-checks");
 assert.equal(safeOwnerReturnPath("/owner/editorial?mode=ob"),"/owner/editorial?mode=ob");
 assert.equal(safeOwnerReturnPath("//example.org"),"/my-reports");
 assert.equal(safeOwnerReturnPath("/%2fexample.org"),"/my-reports");
 const mw=read("middleware.ts");
 assert.ok(mw.indexOf('if (accessScope === "public")')<mw.indexOf("getClaims()"));
 assert.ok(mw.indexOf('if (accessScope === "blocked")')<mw.indexOf("getClaims()"));
 assert.match(mw,/app_access_allowlist/);
 const callback=read("app/auth/callback/route.ts");
 assert.match(callback,/exchangeCodeForSession\(code\)/);
 assert.match(callback,/eq\("active", true\)/);
 assert.match(callback,/new URL\(next, requestUrl\.origin\)/);
});

test("every browser API remains signed-in and field-specific, not a cross-site model endpoint",()=>{
 const generate=read("app/api/owner/editorial-generate/route.ts");
 const investigate=read("app/api/owner/editorial-investigate/route.ts");
 for(const route of [generate,investigate]){
  assert.match(route,/blueDeskHostAccess/);
  assert.match(route,/session\.auth\.getUser\(\)/);
  assert.match(route,/app_access_allowlist/);
  assert.match(route,/Cross-origin request not allowed/);
  assert.match(route,/Same-origin browser request required/);
  assert.match(route,/Cache-Control.*private, no-store/);
 }
 const checklist=read("app/api/presenter/technical-checks/route.ts");
 assert.match(checklist,/auth\.getUser\(\)/);
 assert.match(checklist,/app_access_allowlist/);
 assert.match(checklist,/eq\("user_id", user\.id\)/);
 assert.match(checklist,/expectedRevision/);
});

test("all eight main Bluebelly links remain visible while private routes stay gated",()=>{
 const header=read("components/blue-desk/BlueDeskHeader.tsx");
 const presenter=read("app/owner/presenter/page.tsx");
 const editorial=read("app/owner/editorial/page.tsx");
 const workbench=read("components/blue-desk/EditorialWorkbench.tsx");
 assert.match(header,/activePath === "\/my-reports"/);
 const nav=header.split("const PUBLIC_NAV = [")[1]?.split("] as const;")[0]||"";
 for (const [label,href] of [
  ["Today","/"],["Newsroom","/newsroom"],["Hormuz Watch","/hormuz"],["Regime Watch","/regime-watch"],
  ["Markets","/markets"],["Calendar","/calendar"],
  ["Learn","/learn"],
  ["My Desk","/my-reports"],
 ]) assert.ok(nav.includes('["'+label+'", "'+href+'"]'),label);
 assert.equal((nav.match(/\["/g)||[]).length,8);
 assert.ok(!nav.includes("/api/"));
 assert.match(presenter,/redirect\("\/my-reports"\)/);
 assert.doesNotMatch(presenter,/PresenterTechnicalChecks|EditorialWorkbench/);
 assert.doesNotMatch(presenter,/href="\/hybrid-output\/prepare"/);
 assert.match(editorial,/redirect\("\/my-reports"\)/);
 assert.doesNotMatch(editorial,/EditorialWorkbench/);
 assert.doesNotMatch(editorial,/href="\/owner\/x-wire"/);
 assert.doesNotMatch(workbench,/href="\/owner\/x-wire"/);
 for(const p of [presenter,editorial])assert.match(p,/robots:\{index:false,follow:false\}/);
});
