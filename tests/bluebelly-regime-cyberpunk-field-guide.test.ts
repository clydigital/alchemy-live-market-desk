import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EDITORIAL_REGIME_LENSES} from "../lib/bluebelly-editorial-architecture.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const get=(path:string)=>readFileSync(path,"utf8");
const directory=get("app/blue-desk/regime-watch/page.tsx");
const directoryCss=get("app/blue-desk/regime-watch/regime-watch.module.css");
const lens=get("app/blue-desk/regime-watch/[lensId]/page.tsx");
const lensCss=get("app/blue-desk/regime-watch/[lensId]/lens.module.css");
const crash=get("app/blue-desk/crash-opportunity/page.tsx");
const crashCss=get("app/blue-desk/crash-opportunity/crash-opportunity.module.css");

test("all nine public Regime research files retain the same exact routes and evidence owners",()=>{
 assert.equal(EDITORIAL_REGIME_LENSES.length,9);
 for(const item of EDITORIAL_REGIME_LENSES){
  assert.equal(blueDeskHostAccess("/regime-watch/"+item.id,"bluebelly-desk.vercel.app"),"public");
  assert.equal(blueDeskPresentationTarget("/regime-watch/"+item.id,"bluebelly-desk.vercel.app"),"/blue-desk/regime-watch/"+item.id);
 }
 for(const forbidden of ["/regime-watch/private","/regime-watch/fed/owner","/regime-watch/unknown"])
  assert.equal(blueDeskHostAccess(forbidden,"bluebelly-desk.vercel.app"),"blocked");
 for(const snippet of ["getPublicThesisLedger(now,38)","getPublicSourceObservations(now,24)",
  "getMarketMonitor()","getLensOutlook(lens.id)","getRegimeEditorialUpdate(lens.id)",
  "story.updatedAt","story.support","story.contradiction","story.confirmation","story.invalidation"]){
  assert.ok(lens.includes(snippet),snippet);
 }
 assert.doesNotMatch(lens,/createSupabaseAdminClient|service_role|\.insert\(|\.update\(/);
});

test("overview and each lens use the Learn-inspired cyberpunk stage without fixing theme colours",()=>{
 assert.match(directory,/data-regime-design="cyberpunk-field-guide"/);
 assert.match(directory,/id="lens-grid"/);
 assert.match(directory,/data-research-lens/);
 assert.match(directory,/RegimeOutlookMeter/);
 assert.match(directory,/getLensOutlook\(lens.id\)/);
 assert.match(lens,/data-regime-design="cyberpunk-research-file"/);
 assert.match(lens,/directionTarget/);
 assert.match(lens,/aria-label="Research file orientation"/);
 assert.ok(lens.indexOf("styles.pageNav") < lens.indexOf('id="lens-outlook"'),
  "Navigation should lead readers to the assessment, not appear after it");
 assert.match(lens,/data-lens-outlook=\{outlook.outlook\}/);
 assert.match(lens,/data-regime-editorial-verified/);
 for(const css of [directoryCss,lensCss]){
  for(const token of ["var(--bb-accent)","var(--bb-text)","var(--bb-muted)","var(--bb-card-bg)","var(--bb-card-border)"])
   assert.ok(css.includes(token),token);
  assert.match(css,/font:[^;]+var\(--bb-display\)/);
  assert.match(css,/clip-path:polygon/);
  assert.match(css,/@media\(max-width:/);
  assert.doesNotMatch(css,/#ffdb23|#49e2d0|#3da8ff|#b9e9aa/);
 }
 assert.match(directoryCss,/\.regimeMatrix\{/);
 assert.match(lensCss,/\.lensQuickStrip\{/);
 assert.match(lensCss,/\.pageNav\{position:sticky/);
});

test("Crash vs Opportunity remains a separately qualified two-sided gauge in matching visual design",()=>{
 assert.match(directory,/data-crash-watch-entry="own-research-watch"/);
 assert.match(crash,/data-regime-design="cyberpunk-cross-regime-watch"/);
 assert.match(crash,/buildCrashWatchView\(monitor\?\.rows\?\?null,now\)/);
 assert.match(crash,/data-crash-research-verdict=\{watch.position\}/);
 assert.match(crash,/watch.pillars.map/);
 assert.match(crash,/watch.readings.map/);
 assert.match(crashCss,/\.heroVisual\{/);
 assert.match(crashCss,/\.gaugeGrid\{/);
 assert.match(crashCss,/var\(--bb-accent\)/);
 assert.match(crashCss,/@media\(max-width:650px\)/);
 assert.doesNotMatch(crashCss,/#ffdb23|#49e2d0|#3da8ff|#b9e9aa/);
});
