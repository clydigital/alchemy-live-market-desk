import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {blueDeskHostAccess} from "../lib/blue-desk-host.ts";
import {publicMarketGroup,PUBLIC_MARKET_GROUPS} from "../lib/blue-desk-public-markets.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const host="bluebelly-desk.vercel.app";

test("Public Markets is anonymous and contains no private portfolio category or link",()=>{
 assert.equal(blueDeskHostAccess("/markets",host),"public");
 assert.equal(blueDeskHostAccess("/my-reports",host),"private");
 assert.equal(publicMarketGroup("powerstack"),"all");
 assert.ok(!PUBLIC_MARKET_GROUPS.map(g=>String(g.id)).includes("powerstack"));
 const page=read("app/blue-desk/markets/page.tsx");
 assert.doesNotMatch(page,/getPowerStackResearchAssets|mergePowerStackMarketSearch|powerStack\.items|href="\/power-stack"|data-market-private-link/);
 assert.match(page,/const observations=\[\.\.\.monitoredRows,\.\.\.breadthObservations\]/);
});

test("Public CP Markets begins with breadth and keeps date-aware ETF comparison prominent",()=>{
 const page=read("app/blue-desk/markets/page.tsx");
 const screener=read("components/blue-desk/PublicMarketScreener.tsx");
 const legibility=read("app/blue-desk/markets/legibility.module.css");
 assert.match(page,/data-markets-primary="breadth-and-comparison"/);
 assert.match(page,/data-market-breadth-watch="research-first"/);
 assert.match(page,/data-breadth-research-diagnostic=\{participation.status\}/);
 assert.ok(page.indexOf('aria-labelledby="breadth-watch-heading"')<page.indexOf('aria-labelledby="market-group-heading"'));
 assert.match(page,/Source session/);
 assert.match(page,/1D/);
 assert.match(page,/3D/);
 assert.match(page,/5D/);
 assert.match(screener, /data-market-advanced="optional"/);
 assert.match(screener, /group !== "all"/);
 assert.match(screener, /comparePanel/);
 assert.match(screener, /row\.asOf === equalWeight\.asOf/);
 assert.match(legibility,/var\(--bb-accent\)/);
 assert.match(legibility,/\.breadthPrimary/);
});

test("My Desk has portfolio view without replacing daily intelligence",()=>{
 const desk=read("app/my-reports/page.tsx");
 assert.match(desk,/<OwnerDailyIntelligenceHome\/>/);
 assert.match(desk,/<OwnerDailyTopicIdeas\/>/);
 assert.match(desk,/<OwnerPortfolioHome\s+filters=\{filters\}\/>/);
 assert.match(desk,/href="\/my-reports\?view=portfolio"/);
 assert.match(desk,/data-private-desk=/);
 const nav=read("components/blue-desk/BlueDeskHeader.tsx");
 const privateNav=nav.split("const PRIVATE_NAV = [")[1]?.split("] as const;")[0]||"";
 assert.ok(privateNav.includes('["My Desk", "/my-reports"]'));
 assert.ok(!privateNav.includes('["Power Stack", "/power-stack"]'));
});

test("Private portfolio uses owner RLS and refuses public upstream or unverified snapshots",()=>{
 const view=read("components/blue-desk/OwnerPortfolioHome.tsx");
 assert.match(view,/createSupabaseServerClient/);
 assert.match(view,/supabase\.auth\.getUser\(\)/);
 assert.match(view,/app_access_allowlist/);
 assert.match(view,/power_stack_owner_snapshots/);
 assert.match(view,/\.eq\("owner_user_id",user.id\)/);
 assert.match(view,/snapshot\?\.legacy_source_retired===true/);
 assert.match(view,/ready\?positions\(snapshot\?\.snapshot\):\[\]/);
 assert.match(view,/data-portfolio-migration="pending"/);
 assert.doesNotMatch(view,/clydigital\.github\.io|holdings-fundamentals\.json|service_role|createSupabaseAdminClient/);
});

test("Portfolio quote tracking uses full owner-only scan rather than public monitor overlap",()=>{
 const view=read("components/blue-desk/OwnerPortfolioHome.tsx");
 const full=read("components/blue-desk/OwnerPowerStackFullScan.tsx");
 const parser=read("lib/bluebelly-owner-power-stack-quote-scan.ts");
 assert.match(view,/readOwnerPowerStackQuoteScan/);
 assert.match(view,/<OwnerPowerStackFullScan/);
 assert.match(full,/data-full-watchlist=\{watchlist.length\}/);
 assert.match(full,/change3d/);
 assert.match(full,/change5d/);
 assert.match(full,/Thesis and decision gates/);
 assert.match(full,/Quantit|quantity|positions/i);
 assert.match(parser,/recentSession/);
 assert.match(parser,/raw.status==="CLOSED"/);
 assert.doesNotMatch(full,/clydigital.github.io|service_role/);
});
