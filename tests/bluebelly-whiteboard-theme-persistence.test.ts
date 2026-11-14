import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildMarketCompassSummary} from "../lib/bluebelly-market-compass.ts";
import type {MarketDivergenceRead} from "../lib/bluebelly-market-divergence-watch.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("root restores only whitelisted saved theme and rail state before client hydration",()=>{
 const layout=read("app/layout.tsx");
 const prefs=read("components/blue-desk/ThemePreferences.tsx");
 const toggle=read("components/blue-desk/CommandSidebarToggle.tsx");
 assert.match(layout,/BLUEBELLY_EARLY_PREFERENCES/);
 assert.match(layout,/<head><script dangerouslySetInnerHTML/);
 assert.match(layout,/suppressHydrationWarning/);
 assert.match(layout,/bluebelly-theme/);
 assert.match(layout,/bluebelly:command-sidebar-shelved/);
 for(const theme of ["yellow-black","turquoise","neon-blue","pastel-green"]){
  assert.ok(layout.includes('theme==="'+theme+'"'));
  assert.ok(prefs.includes("'"+theme+"'"));
 }
 assert.match(toggle,/window.localStorage.getItem\(STORAGE_KEY\)/);
 assert.doesNotMatch(toggle,/return \(\)=>\{\s*root\.removeAttribute\("data-bluebelly-sidebar"\)/);
});

test("nav shelf square uses palette-driven command token with no mandatory yellow",()=>{
 const css=read("components/blue-desk/bluebelly-chrome.module.css");
 const tokens=read("app/bluebelly-tokens.css");
 assert.match(css,/background:var\(--bb-command-accent\);border:1px solid var\(--bb-command-accent\)/);
 assert.doesNotMatch(css,/\.sidebarToggle\{[^}]*background:#ffe500/);
 for(const t of ["turquoise","neon-blue","pastel-green","yellow-black"]){
  assert.ok(tokens.includes(':root[data-bluebelly-theme="'+t+'"]'));
 }
});

test("dashboard whiteboard reuses canonical existing source data and market direction engine",()=>{
 const home=read("app/blue-desk/page.tsx");
 const board=read("components/blue-desk/DeskWhiteboard.tsx");
 const css=read("components/blue-desk/DeskWhiteboard.module.css");
 assert.match(home,/const marketComparisons=buildMarketDivergenceWatch\(marketRows,"1D"\)/);
 assert.match(home,/buildMarketCompassSummary\(marketComparisons,now\)/);
 assert.match(home,/buildInvestorMindsetSnapshot\(marketRows,marketComparisons,marketCompass,verifiedNews,now\)/);
 assert.match(home,/<DeskWhiteboard compass=\{marketCompass\} news=\{verifiedNews\} theses=\{theses\}/);
 for(const lane of ["market","release","thesis","catalyst"])assert.ok(board.includes('data-whiteboard-cell="'+lane+'"'));
 assert.match(board,/MarketCompassSummary/);
 assert.match(board,/sourceCheckedReleaseImpact\(latest\)/);
 assert.match(board,/reviewedRelease\.lead/);
 assert.match(board,/reviewedRelease\.title/);

 assert.match(board,/Date.parse\(item.occurredAt\)/);
 assert.match(board,/48\*3600000/);
 assert.match(board,/sourceSession/);
 assert.match(board,/data-bluebelly-desk-whiteboard="existing-evidence-v1"/);
 assert.doesNotMatch(board,/fetch\(|generateContent|createSupabaseAdminClient|useEffect/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/grid-template-columns:1fr/);
});

test("Markets has a compact evidence-context ribbon only in all-assets view",()=>{
 const markets=read("app/blue-desk/markets/page.tsx");
 assert.match(markets,/mode==="assets"&&group==="all"/);
 assert.match(markets,/data-markets-whiteboard="market-compass-context"/);
 assert.match(markets,/marketContext.contradiction/);
 assert.match(markets,/blueDeskPublicHref\("\/blue-desk\/regime-watch",host\)/);
});

test("unmatched ETF tape does not turn the board into a made-up bullish/bearish opinion",()=>{
 const result=buildMarketCompassSummary([] as MarketDivergenceRead[],new Date("2026-11-14T03:00:00Z"));
 assert.equal(result.state,"UNMEASURED");
 assert.equal(result.sourceSession,null);
 assert.match(result.title,/not established/);
});
