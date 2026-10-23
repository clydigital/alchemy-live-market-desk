import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess,blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const host="bluebelly-v7-review.vercel.app";

test("Bluebelly has no Hybrid UI handoff from public homepage or private Presenter",()=>{
 const home=read("app/blue-desk/page.tsx");
 const presenter=read("app/blue-desk/presenter/page.tsx");
 const full=read("app/blue-desk/presenter/full-prep/page.tsx");
 const editor=read("app/blue-desk/presenter/technical-checks/page.tsx");
 for(const value of [home,presenter,full,editor]) assert.doesNotMatch(value,/href=.{0,150}\/hybrid-output|return "\/hybrid-output\/prepare"/);
 assert.match(presenter,/return "\/presenter\/full-prep"/);
 assert.match(full,/resolvePresenterPrepExactSelection\(/);
 assert.match(full,/buildPresenterPrepSourceProjection\(/);
 assert.match(full,/<PresenterPrepSession/);
 assert.match(editor,/<PresenterTechnicalChecks\/>/);
 assert.equal(blueDeskPresentationTarget("/presenter/full-prep",host),"/blue-desk/presenter/full-prep");
 assert.equal(blueDeskPresentationTarget("/presenter/technical-checks",host),"/blue-desk/presenter/technical-checks");
 assert.equal(blueDeskHostAccess("/presenter/full-prep",host),"private");
 assert.equal(blueDeskHostAccess("/presenter/technical-checks",host),"private");
 assert.equal(blueDeskHostAccess("/api/presenter/technical-checks",host),"private");
 assert.equal(blueDeskHostAccess("/hybrid-output/prepare",host),"blocked");
});

test("Figtree is loaded and covers redesigned Learn and Presenter",()=>{
 const layout=read("app/layout.tsx");
 const style=read("app/blue-desk/blue-desk.module.css");
 const learn=read("app/blue-desk/learn/learn.module.css");
 const presenter=read("app/blue-desk/presenter/v6-studio.module.css");
 assert.match(layout,/fonts.googleapis.com\/css2\?family=Figtree/);
 for(const css of [style,learn,presenter]) assert.match(css,/font-family:Figtree|font-family: Figtree/);
 assert.doesNotMatch(learn,/Georgia/);
 assert.doesNotMatch(presenter,/Georgia/);
});
test("Homepage orders editorial material before expandable source appendix",()=>{
 const p=read("app/blue-desk/page.tsx");
 const hero=p.indexOf('<section className={styles.hero}');
 const stories=p.indexOf('aria-labelledby="stories-title"');
 const calendar=p.indexOf('className={styles.calendarOnlyGrid}');
 const news=p.indexOf('className={styles.newsFirst}');
 const market=p.indexOf('className={styles.dailyMap}');
 assert.ok(hero>=0&&hero<stories&&stories<calendar&&calendar<news&&news<market);
 assert.match(p,/homeDisclosureSummary/);
 assert.match(p,/getRecentPublishedStoryReadings\(/);
 assert.match(p,/selectVerifiedNewsBriefs\(/);
 assert.match(p,/publicMarketObservations\(/);
});
test("Surface data is admitted through existing provider and editorial contracts, not plugin calls",()=>{
 const publicPage=read("app/blue-desk/page.tsx");
 const presenter=read("app/blue-desk/presenter/page.tsx");
 const learn=read("app/blue-desk/learn/page.tsx");
 const api=read("app/api/presenter/technical-checks/route.ts");
 assert.match(publicPage,/getLiveDeskHomepageDailyBrief\(/);
 assert.match(publicPage,/getCurrentVerifiedMarketMotion\(/);
 assert.match(presenter,/selectVerifiedNewsBriefs\(/);
 assert.match(presenter,/publicMarketObservations\(/);
 assert.match(learn,/listConcepts\(/);
 assert.match(api,/app_access_allowlist/);
 assert.match(api,/expectedRevision/);
 assert.doesNotMatch(publicPage,/presenter_technical_checklists|service_role|mcp__|plugin_management/);
});
