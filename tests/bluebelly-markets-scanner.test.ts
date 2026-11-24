import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess,blueDeskPresentationTarget,BLUEBELLY_PRESENTATION_HOST} from "../lib/blue-desk-host.ts";
test("scanner is a bounded read-only public Markets subpage",()=>{
 assert.equal(blueDeskPresentationTarget("/markets/scanner",BLUEBELLY_PRESENTATION_HOST),"/blue-desk/markets/scanner");
 assert.equal(blueDeskHostAccess("/markets/scanner",BLUEBELLY_PRESENTATION_HOST),"public");
 assert.equal(blueDeskHostAccess("/blue-desk/markets/scanner",BLUEBELLY_PRESENTATION_HOST),"public");
 assert.equal(blueDeskHostAccess("/markets/scanner/private",BLUEBELLY_PRESENTATION_HOST),"blocked");
});
test("third-party widgets are isolated from native markets page",()=>{
 const markets=readFileSync("app/blue-desk/markets/page.tsx","utf8");
 const scanner=readFileSync("app/blue-desk/markets/scanner/page.tsx","utf8");
 const widgets=readFileSync("components/blue-desk/MarketsScannerWidgets.tsx","utf8");
 assert.match(markets,/\/blue-desk\/markets\/scanner/);
 assert.doesNotMatch(markets,/MarketsScannerWidgets/);
 assert.match(scanner,/MarketsScannerWidgets/);
 assert.match(widgets,/embed-widget-stock-heatmap\.js/);
 assert.match(widgets,/tv-forex-table\.js/);
 assert.match(widgets,/embed-widget-screener\.js/);
 assert.match(widgets,/<Embed key=\{tool.id\}/);
});
